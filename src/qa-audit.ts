/**
 * QA outcome audit — Watchdog C.
 *
 * Catches the case where a mission daemon reports status='completed' but the
 * real-world state doesn't actually match its acceptance_criteria. The upstream
 * runner in scheduler.ts already parses an ACCEPTANCE: PASS line from the
 * agent's own output (self-report). That is necessary but not sufficient —
 * the agent can cheerfully claim PASS while the DB / URL / file state says
 * otherwise.
 *
 * This audit is the independent second look:
 *   1. Pick up to 3 missions from the last 24h where
 *        status='completed' AND acceptance_criteria IS NOT NULL
 *        AND no row yet in mission_verifications.
 *   2. For each, spawn a fresh SDK call scoped to the QA agent
 *      (qa CLAUDE.md, qa MCPs, qa model) and hand it the acceptance_criteria.
 *   3. Parse the final ACCEPTANCE: PASS / FAIL: <reason> line.
 *   4. Write a mission_verifications row (pass=0/1, notes=reason|result excerpt).
 *   5. On FAIL: fire a REALTIME alert to main so Rudy sees it immediately.
 *
 * Idempotent by design. The "no row yet in mission_verifications" check means
 * a single mission gets audited exactly once, even if this CLI fires twice in
 * the same 30-minute window (e.g. a manual run + the cron).
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { runAgent } from './agent.js';
import { loadAgentConfig, resolveAgentDir, resolveAgentClaudeMd } from './agent-config.js';
import { createAutoTriageMission } from './auto-triage.js';
import { STORE_DIR, setAgentOverrides } from './config.js';
import { logger } from './logger.js';

const QA_AGENT_ID = 'qa';
const AUDIT_BATCH_SIZE = 3;
const AUDIT_LOOKBACK_SECONDS = 24 * 3600;

interface CandidateRow {
  id: string;
  title: string;
  assigned_agent: string | null;
  acceptance_criteria: string;
  prompt: string;
  result: string | null;
}

export interface QaAuditResult {
  audited: number;
  passed: number;
  failed: number;
  errors: number;
}

type Verdict =
  | { kind: 'pass' }
  | { kind: 'fail'; reason: string }
  | { kind: 'missing' };

function getDb(): Database.Database {
  const dbPath = path.join(STORE_DIR, 'claudeclaw.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

/**
 * Configure the runtime to use the QA agent (cwd, model, MCPs, CLAUDE.md).
 * Mirrors the setup in src/index.ts for `--agent qa`, but for a CLI context
 * that runs outside the long-lived bot process.
 */
function applyQaAgentOverrides(): void {
  const cfg = loadAgentConfig(QA_AGENT_ID);
  const cwd = resolveAgentDir(QA_AGENT_ID);
  const claudeMdPath = resolveAgentClaudeMd(QA_AGENT_ID);
  let systemPrompt: string | undefined;
  if (claudeMdPath) {
    try {
      systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      /* no CLAUDE.md — ok */
    }
  }
  setAgentOverrides({
    agentId: QA_AGENT_ID,
    botToken: cfg.botToken,
    cwd,
    model: cfg.model,
    obsidian: cfg.obsidian,
    systemPrompt,
    mcpServers: cfg.mcpServers,
  });
}

/**
 * Parse the final ACCEPTANCE: PASS / FAIL: <reason> line from the agent's
 * output. Scans bottom-up so early mentions in reasoning don't override the
 * final verdict. Same contract as src/scheduler.ts parseAcceptanceVerdict.
 */
export function parseVerdict(text: string): Verdict {
  if (!text) return { kind: 'missing' };
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i];
    if (!raw) continue;
    const line = raw.trim().replace(/^[`*>_\s"']+|[`*_\s"']+$/g, '');
    const m = /^ACCEPTANCE\s*:\s*(PASS|FAIL(?:\s*:\s*(.*))?)\s*$/i.exec(line);
    if (!m) continue;
    const verdict = m[1].toUpperCase();
    if (verdict.startsWith('PASS')) return { kind: 'pass' };
    const reason = (m[2] || '').trim() || 'no reason provided';
    return { kind: 'fail', reason };
  }
  return { kind: 'missing' };
}

function clip(s: string | null | undefined, max: number): string {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

/**
 * Build the prompt the QA agent receives. Deliberately minimal: it gives the
 * agent just enough context to verify the real-world state (mission title +
 * original prompt excerpt + acceptance_criteria + what the runner claimed).
 * The QA agent's own CLAUDE.md handles "how" (evidence-based, DB-first).
 */
function buildAuditPrompt(row: CandidateRow): string {
  return (
    'Mission ' +
    row.id +
    ' (' +
    row.title +
    ') was marked completed by @' +
    (row.assigned_agent || 'unassigned') +
    '.\n\n' +
    'Independent second-look audit: verify each acceptance criterion is ' +
    'CURRENTLY TRUE in the real world (query the DB / open the URL / ' +
    'inspect the file). Do not trust the runner\'s self-report.\n\n' +
    '# Original prompt (for context)\n' +
    clip(row.prompt, 1500) +
    '\n\n' +
    '# Acceptance criteria (verify each)\n' +
    row.acceptance_criteria +
    '\n\n' +
    '# What the runner claimed on completion (may be wrong)\n' +
    clip(row.result, 1500) +
    '\n\n' +
    'Verify each criterion is currently true in the world. Return ' +
    'ACCEPTANCE: PASS or ACCEPTANCE: FAIL: <reason> as the final line ' +
    'of your response.'
  );
}

export async function runQaAudit(): Promise<QaAuditResult> {
  // No ALLOWED_CHAT_ID check: QA audit failures now escalate as in-band
  // auto-triage missions on @main, not as Telegram pings. Missing env vars
  // must not brick the auditor — its whole job is to catch silent failures.
  //
  // Token check is LAZY: applyQaAgentOverrides() reads QA_BOT_TOKEN via
  // loadAgentConfig('qa'), which throws if the env var is missing. We only
  // need the token when we're about to spawn the QA SDK call for a real
  // mission. If there are zero candidates, exit clean without touching it.

  const db = getDb();
  const result: QaAuditResult = { audited: 0, passed: 0, failed: 0, errors: 0 };

  try {
    const candidates = db
      .prepare(
        `SELECT m.id, m.title, m.assigned_agent, m.acceptance_criteria, m.prompt, m.result
           FROM mission_tasks m
          WHERE m.status = 'completed'
            AND m.acceptance_criteria IS NOT NULL
            AND m.acceptance_criteria != ''
            AND m.created_at > (unixepoch() - ?)
            AND NOT EXISTS (
              SELECT 1 FROM mission_verifications v WHERE v.mission_id = m.id
            )
          ORDER BY m.completed_at DESC
          LIMIT ?`,
      )
      .all(AUDIT_LOOKBACK_SECONDS, AUDIT_BATCH_SIZE) as CandidateRow[];

    if (candidates.length === 0) {
      return result;
    }

    // We have work to do — NOW configure runtime for the QA agent.
    // Safe to call multiple times; setAgentOverrides just mutates module state.
    // Throws clearly if QA_BOT_TOKEN is missing.
    applyQaAgentOverrides();

    const insertVerification = db.prepare(
      `INSERT INTO mission_verifications (mission_id, verified_at, pass, notes)
       VALUES (?, ?, ?, ?)`,
    );

    for (const row of candidates) {
      const auditPrompt = buildAuditPrompt(row);

      let text: string | null = null;
      try {
        // Fresh SDK call — no resume, new session. QA agent CLAUDE.md is
        // injected via cwd (set above). No typing callback (CLI context).
        const agentRes = await runAgent(
          auditPrompt,
          undefined,
          () => {},
        );
        text = agentRes.text;
      } catch (err) {
        logger.error(
          { err, missionId: row.id },
          'qa-audit: SDK call failed',
        );
        result.errors += 1;
        // Record the failure so this mission doesn't get retried forever.
        // pass=0, notes="audit-error: <msg>". Operator can manually clear
        // the row to retry if they fix the underlying SDK issue.
        const msg = err instanceof Error ? err.message : String(err);
        insertVerification.run(
          row.id,
          Math.floor(Date.now() / 1000),
          0,
          'audit-error: ' + clip(msg, 500),
        );
        continue;
      }

      const verdict = parseVerdict(text || '');
      const verifiedAt = Math.floor(Date.now() / 1000);

      if (verdict.kind === 'pass') {
        insertVerification.run(row.id, verifiedAt, 1, clip(text, 1000));
        result.passed += 1;
      } else {
        const reason =
          verdict.kind === 'fail'
            ? verdict.reason
            : 'verdict line missing from QA output';
        insertVerification.run(
          row.id,
          verifiedAt,
          0,
          'FAIL: ' + clip(reason, 500) + '\n\n' + clip(text, 800),
        );
        result.failed += 1;

        // Queue an auto-triage mission on @main instead of paging Rudy.
        // Main diagnoses the enabling condition and dispatches a muscle fix
        // to the right spoke. Rudy only gets pinged if a decision is needed.
        try {
          createAutoTriageMission({
            kind: 'qa_failed',
            sourceId: row.id,
            title: row.title,
            assignedAgent: row.assigned_agent,
            prompt: row.prompt,
            error:
              'Mission claimed status=completed but QA audit FAILED: ' +
              clip(reason, 1000),
            lastOutput: text,
          });
        } catch (alertErr) {
          logger.error(
            { err: alertErr, missionId: row.id },
            'qa-audit: failed to queue auto-triage mission',
          );
          result.errors += 1;
        }
      }

      result.audited += 1;
    }
  } finally {
    db.close();
  }

  return result;
}
