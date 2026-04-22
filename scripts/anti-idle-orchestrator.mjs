#!/usr/bin/env node
/**
 * Anti-Idle Orchestrator (claudeclaw port)
 *
 * Layer 2 of 2. Consumes dispatcher JSON, creates mission-cli tasks, and
 * reconciles completion against durable Kanban state.
 *
 * Ownership/session registry lives in the claudeclaw SQLite DB in a new table
 * `anti_idle_sessions` (auto-created on first run). No Supabase dependency.
 *
 * Conservative completion principle (from /clawd spec, 2026-04-05):
 *   A task is complete only when durable Kanban state says so — a mission-task
 *   claiming done on its own is NOT sufficient.
 *
 * Env:
 *   ANTI_IDLE_DRY_RUN=1             — log decisions; do not write to DB or post
 *   ANTI_IDLE_NOTIFY_DISABLED=1     — skip Telegram posting (legacy: ANTI_IDLE_DISCORD_DISABLED=1 also honored)
 *   ANTI_IDLE_KANBAN_SOURCE=supabase — pass through to dispatcher + reconciler
 *
 * 2026-04-20: Alert delivery moved from Discord to Telegram via notify.sh.
 * 2026-04-20: notify.sh hop removed — alerts now call sendAlert() directly
 *             from dist/alert-router.js so meta fields survive and we skip
 *             the shell+node spawn on every dispatch.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { sendAlert } from '../dist/alert-router.js';

// ── Constants ─────────────────────────────────────────────────────
const ROOT_DIR = '/Users/aditya_office_ai_assistant/claudeclaw';
const DISPATCHER_SCRIPT = `${ROOT_DIR}/scripts/anti-idle-check.mjs`;
const DB_PATH = `${ROOT_DIR}/store/claudeclaw.db`;
const STATE_DIR = `${ROOT_DIR}/store/anti-idle`;
const EVENTS_PATH = `${STATE_DIR}/orchestrator-events.jsonl`;
const LOCK_PATH = `${STATE_DIR}/orchestrator.lock`;

const DISPATCHER_SUPPORTED_MAJOR = 2;
const LOCK_STALE_MS = 8 * 60 * 1000;
const LEASE_HOURS = 8;
const GRACE_MINUTES = 15;
const DRY_RUN = process.env.ANTI_IDLE_DRY_RUN === '1' || process.env.ANTI_IDLE_ORCH_DRY_RUN === '1';
const NOTIFY_DISABLED = process.env.ANTI_IDLE_NOTIFY_DISABLED === '1' || process.env.ANTI_IDLE_DISCORD_DISABLED === '1';
const KANBAN_SOURCE = (process.env.ANTI_IDLE_KANBAN_SOURCE || 'sqlite').toLowerCase();

// ── Helpers ───────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
const nowUnix = () => Math.floor(Date.now() / 1000);
const eventId = (prefix = 'evt') => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

function toMs(v) {
  if (!v) return null;
  const n = typeof v === 'number' ? (v < 10_000_000_000 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function addMs(iso, ms) {
  const base = toMs(iso) || Date.now();
  return new Date(base + ms).toISOString();
}

async function appendJsonl(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

async function acquireLock(instanceId) {
  try {
    await fs.mkdir(path.dirname(LOCK_PATH), { recursive: true });
    const fd = await fs.open(LOCK_PATH, 'wx');
    await fd.writeFile(JSON.stringify({ instance_id: instanceId, started_at: nowIso() }));
    await fd.close();
    return true;
  } catch {
    try {
      const raw = await fs.readFile(LOCK_PATH, 'utf8');
      const lock = safeJsonParse(raw, {});
      const startedMs = toMs(lock.started_at);
      if (!startedMs || Date.now() - startedMs > LOCK_STALE_MS) {
        await fs.unlink(LOCK_PATH).catch(() => {});
        return acquireLock(instanceId);
      }
    } catch {
      await fs.unlink(LOCK_PATH).catch(() => {});
      return acquireLock(instanceId);
    }
    return false;
  }
}

async function releaseLock() {
  await fs.unlink(LOCK_PATH).catch(() => {});
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`CMD_EXIT_${code}:${(stderr || stdout).slice(0, 200)}`));
    });
  });
}

// ── Database (single connection, shared for the run) ──────────────
function openDb() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  // anti_idle_sessions: auto-created, does NOT interfere with main db.js schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS anti_idle_sessions (
      session_key              TEXT PRIMARY KEY,
      dispatch_run_id          TEXT NOT NULL,
      task_id                  TEXT NOT NULL,
      mission_task_id          TEXT,
      routing_target           TEXT NOT NULL,
      orchestrator_instance_id TEXT NOT NULL,
      status                   TEXT NOT NULL DEFAULT 'running',
      started_at               INTEGER NOT NULL,
      last_heartbeat_at        INTEGER NOT NULL,
      lease_expires_at         INTEGER NOT NULL,
      error                    TEXT,
      completion_correlation_id TEXT,
      kanban_prev_updated_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_anti_idle_sessions_status ON anti_idle_sessions(status, task_id);
    CREATE INDEX IF NOT EXISTS idx_anti_idle_sessions_dispatch ON anti_idle_sessions(dispatch_run_id);
  `);
  return db;
}

// ── State-machine helpers ─────────────────────────────────────────
function mapColumnToState(columnId) {
  const c = String(columnId || '').toLowerCase();
  if (c === 'todo') return 'todo';
  if (c === 'claimed') return 'claimed';
  if (c === 'inprogress' || c === 'in_progress') return 'inprogress';
  if (['done', 'completed', 'complete'].includes(c)) return 'completed';
  if (['failed', 'failure'].includes(c)) return 'failed';
  if (['blocked', 'onhold', 'on_hold'].includes(c)) return 'blocked';
  return 'inprogress';
}

const TERMINAL = new Set(['completed', 'failed', 'blocked', 'orphaned', 'quarantined']);
const isTerminal = (s) => TERMINAL.has(s);

function validateTransition(from, to) {
  const allowed = new Set([
    'running->completed', 'running->failed', 'running->blocked',
    'running->orphaned', 'running->quarantined',
    'orphaned->blocked', 'orphaned->failed',
  ]);
  return allowed.has(`${from}->${to}`) || from === to;
}

function findDispatchRunInNotes(notes, runId) {
  const text = String(notes || '');
  if (!text || !runId) return false;
  return text.includes(`"dispatch_run_id":"${runId}"`) || text.includes(`dispatch_run_id=${runId}`);
}

// ── Dispatcher runner ─────────────────────────────────────────────
async function runDispatcher() {
  if (process.env.ANTI_IDLE_ORCH_MOCK_DISPATCH_FILE) {
    const raw = await fs.readFile(process.env.ANTI_IDLE_ORCH_MOCK_DISPATCH_FILE, 'utf8');
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('MOCK_DISPATCH_INVALID_JSON');
    return parsed;
  }
  const out = await runCmd('node', [DISPATCHER_SCRIPT], {
    cwd: ROOT_DIR,
    env: { ...process.env },
  });
  const parsed = safeJsonParse(String(out.stdout || '').trim(), null);
  if (!parsed) throw new Error(`DISPATCHER_INVALID_JSON:${out.stderr.slice(0, 200)}`);
  return parsed;
}

function validateDispatcher(dispatch, db) {
  const errors = [];
  const schemaVersion = Number(dispatch.schema_version ?? dispatch.version);
  if (!Number.isFinite(schemaVersion)) errors.push('schema_version_missing');
  const major = Math.trunc(schemaVersion);
  if (Number.isFinite(schemaVersion) && major !== DISPATCHER_SUPPORTED_MAJOR) {
    errors.push(`schema_version_unsupported:${schemaVersion}`);
  }

  const decision = String(dispatch.decision || 'silent');
  if (!['dispatch', 'escalate', 'silent'].includes(decision)) errors.push('decision_invalid');

  const selected = Array.isArray(dispatch.selected_task_ids) ? dispatch.selected_task_ids : [];
  if (decision === 'dispatch') {
    if (!selected.length) errors.push('selected_task_ids_missing');
    if (new Set(selected).size !== selected.length) errors.push('selected_task_ids_non_unique');
    if (!dispatch.dispatch_run_id) errors.push('dispatch_run_id_missing');
  }

  const slots = Number(dispatch.available_wip_slots ?? 0);
  if (decision === 'dispatch' && selected.length > slots) errors.push('selected_exceeds_wip_slots');

  const routes = dispatch.routing_targets || {};
  for (const id of selected) if (!routes[id]) errors.push(`missing_route_target:${id}`);

  if (decision === 'dispatch' && dispatch.dispatch_run_id) {
    const existing = db.prepare(`SELECT 1 FROM anti_idle_sessions WHERE dispatch_run_id = ? AND status = 'running' LIMIT 1`).get(dispatch.dispatch_run_id);
    if (existing) errors.push('dispatch_run_already_active');
  }

  return { ok: errors.length === 0, errors, schemaVersion, decision, selected, routes };
}

// ── Kanban atomic claim + fetch ───────────────────────────────────
function fetchKanbanRow(db, taskId) {
  if (KANBAN_SOURCE === 'supabase') {
    // Reconcile via SQLite mirror only; Supabase reconcile not implemented in v1.
    throw new Error('SUPABASE_RECONCILE_UNSUPPORTED_IN_V1');
  }
  return db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(taskId);
}

function atomicClaimKanban(db, taskRow, dispatchRunId, reason, routingTarget) {
  // Claim: todo → inprogress, append dispatch marker to notes,
  // guard on prev updated_at to detect concurrent moves.
  const marker = JSON.stringify({
    dispatch_run_id: dispatchRunId,
    ts: nowIso(),
    reason: String(reason || '').slice(0, 200),
    route_target: routingTarget,
  });
  const notesNew = taskRow.notes ? `${taskRow.notes}\nAUTO_DISPATCH: ${marker}` : `AUTO_DISPATCH: ${marker}`;
  const updatedAtNew = nowUnix();
  const res = db.prepare(`
    UPDATE kanban_tasks
       SET column_id = 'inprogress',
           notes = ?,
           updated_at = ?
     WHERE id = ?
       AND column_id = 'todo'
       AND updated_at = ?
  `).run(notesNew, updatedAtNew, taskRow.id, taskRow.updated_at);
  return { ok: res.changes === 1, updatedAtNew, notesNew };
}

// ── Mission task creation ─────────────────────────────────────────
function agentForRoute(target) {
  const t = String(target || '').toLowerCase();
  if (['builder', 'content', 'research', 'ops'].includes(t)) return t;
  return null;
}

function buildMissionPrompt(task, dispatch, routingTarget, dispatchRunId) {
  const title = String(task.title || 'Untitled task').trim();
  const description = String(task.description || task.notes || '');

  const extract = (labels) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = description.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`, 'i'));
      if (m?.[1]) return m[1].trim();
    }
    return '';
  };

  const why = extract(['WHY', 'REASON']) || '(not provided)';
  const objective = extract(['OBJECTIVE', 'GOAL']) || '(not provided)';
  const outcome = extract(['DESIRED OUTCOME', 'OUTCOME', 'SUCCESS CRITERIA']) || '(not provided)';
  const blocker = extract(['BLOCKER', 'BLOCKED BY']) || 'none';
  const nextStep = extract(['NEXT STEP', 'NEXT ACTION']) || '(not provided)';

  return [
    `ANTI-IDLE DISPATCH → ${routingTarget.toUpperCase()}`,
    `kanban_task_id: ${task.id}`,
    `dispatch_run_id: ${dispatchRunId}`,
    `routing_reason: ${dispatch.reason_code || 'kanban_dispatch'}`,
    '',
    `Title: ${title}`,
    `WHY: ${why}`,
    `OBJECTIVE: ${objective}`,
    `DESIRED OUTCOME: ${outcome}`,
    `BLOCKER: ${blocker}`,
    `NEXT STEP: ${nextStep}`,
    '',
    'COMPLETION PROTOCOL (conservative-completion principle):',
    '  1. Execute the task per NEXT STEP.',
    '  2. When done, update kanban_tasks.column_id = "done" AND append',
    `     "dispatch_run_id=${dispatchRunId}" to notes. That is the authoritative`,
    '     completion signal.',
    '  3. If blocked, move to column_id="blocked" with reason in notes.',
    '  4. Do NOT claim success from chat output alone — the orchestrator',
    '     reconciles against durable Kanban state on its next run.',
    '',
    'Original description follows:',
    '---',
    description || '(no description)',
  ].join('\n');
}

function createMissionTaskRow(db, { missionId, title, prompt, agent, priority = 5 }) {
  const now = nowUnix();
  db.prepare(`
    INSERT INTO mission_tasks (id, title, prompt, assigned_agent, status, created_by, priority, created_at)
    VALUES (?, ?, ?, ?, 'queued', 'anti-idle-orchestrator', ?, ?)
  `).run(missionId, title, prompt, agent, priority, now);
}

// ── Reconciliation: conservative completion ───────────────────────
function reconcileSessions(db, orchestratorInstanceId) {
  const running = db.prepare(`SELECT * FROM anti_idle_sessions WHERE status = 'running'`).all();
  const summary = { reconciled: 0, completed: 0, failed: 0, blocked: 0, orphaned: 0, quarantined: 0, invalid_transition: 0 };
  if (!running.length) return summary;

  const heartbeatStmt = db.prepare(`UPDATE anti_idle_sessions SET last_heartbeat_at = ?, lease_expires_at = ? WHERE session_key = ?`);
  const transitionStmt = db.prepare(`UPDATE anti_idle_sessions SET status = ?, error = ?, completion_correlation_id = ?, last_heartbeat_at = ? WHERE session_key = ?`);
  const missionStatusStmt = db.prepare(`SELECT status FROM mission_tasks WHERE id = ?`);

  for (const s of running) {
    // Only SQLite reconcile supported in v1; Supabase path would go here.
    const row = fetchKanbanRow(db, s.task_id);
    const heartbeatAtMs = (s.last_heartbeat_at || s.started_at) * 1000;
    const leaseMs = heartbeatAtMs + LEASE_HOURS * 3_600_000;
    const graceMs = leaseMs + GRACE_MINUTES * 60_000;

    if (!row) {
      if (Date.now() > graceMs) {
        transitionStmt.run('orphaned', 'kanban_row_missing', null, nowUnix(), s.session_key);
        summary.orphaned += 1;
        summary.reconciled += 1;
      }
      continue;
    }

    const next = mapColumnToState(row.column_id);
    if (next === 'inprogress') {
      // Keep lease alive
      const hb = nowUnix();
      heartbeatStmt.run(hb, hb + LEASE_HOURS * 3600, s.session_key);
      continue;
    }

    const correlated = findDispatchRunInNotes(row.notes, s.dispatch_run_id);
    const missionRow = s.mission_task_id ? missionStatusStmt.get(s.mission_task_id) : null;
    const missionStatus = missionRow?.status || null;

    if (next === 'completed') {
      // Authoritative only if the kanban row carries our dispatch-run correlation.
      if (!correlated) {
        if (validateTransition(s.status, 'quarantined')) {
          transitionStmt.run('quarantined', 'completion_missing_correlation', null, nowUnix(), s.session_key);
          summary.quarantined += 1;
          summary.reconciled += 1;
        } else {
          summary.invalid_transition += 1;
        }
        continue;
      }
      if (validateTransition(s.status, 'completed')) {
        const corrId = `${s.dispatch_run_id}:${s.task_id}`;
        transitionStmt.run('completed', null, corrId, nowUnix(), s.session_key);
        summary.completed += 1;
        summary.reconciled += 1;
      } else {
        summary.invalid_transition += 1;
      }
      continue;
    }

    if (next === 'failed' || next === 'blocked') {
      const err = missionStatus === 'failed' ? 'mission_task_failed' : `kanban_state_${next}`;
      if (validateTransition(s.status, next)) {
        transitionStmt.run(next, err, null, nowUnix(), s.session_key);
        summary[next] = (summary[next] || 0) + 1;
        summary.reconciled += 1;
      } else {
        summary.invalid_transition += 1;
      }
      continue;
    }

    if (next === 'todo') {
      // Manual override — treat as orphaned
      transitionStmt.run('orphaned', 'manual_override_to_todo', null, nowUnix(), s.session_key);
      summary.orphaned += 1;
      summary.reconciled += 1;
      continue;
    }

    // Lease-expired catch-all
    if (Date.now() > graceMs && !isTerminal(s.status)) {
      if (validateTransition(s.status, 'orphaned')) {
        transitionStmt.run('orphaned', 'lease_expired', null, nowUnix(), s.session_key);
        summary.orphaned += 1;
        summary.reconciled += 1;
      } else {
        summary.invalid_transition += 1;
      }
    }
  }
  return summary;
}

// ── Notify (Telegram via alert router — Discord deprecated 2026-04-20) ──
// Amendment to mission e02337a9 (2026-04-20): the orchestrator itself runs
// under ops (cron 34bfa65e), so its OWN summary/error messages route through
// the OPS bot, not main. Individual mission completions route through each
// target agent's bot via scheduler.ts → sendAlert().
//
// 2026-04-20 (mission: migrate-direct-emitters): moved from notify.sh shell
// hop to a direct sendAlert() import from dist/alert-router.js so the
// `meta` field rides along with the alert and we skip the shell+node spawn.
// Category drives severity:
//   'anti_idle_summary' — digest (routine dispatch summary)
//   'error'             — realtime (validation failures, escalations, crashes)
async function postNotify(content, { category = 'anti_idle_summary', meta } = {}) {
  if (DRY_RUN || NOTIFY_DISABLED) {
    return { ok: false, skipped: true, reason: DRY_RUN ? 'dry_run' : 'disabled' };
  }
  const text = `[anti-idle] ${String(content || '').slice(0, 3900)}`;
  const chatId = process.env.ALLOWED_CHAT_ID || '';
  if (!chatId) {
    return { ok: false, reason: 'ALLOWED_CHAT_ID unset' };
  }
  try {
    await sendAlert({
      agentId: 'ops',
      chatId,
      content: text,
      category,
      meta,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const orchestratorInstanceId = `orchestrator_${crypto.randomBytes(6).toString('hex')}`;
  const startedAt = nowIso();
  let locked = false;
  let db;

  const event = {
    schema_version: 1,
    timestamp: startedAt,
    event_id: eventId('orchestrator'),
    orchestrator_instance_id: orchestratorInstanceId,
    kanban_source: KANBAN_SOURCE,
    dispatch_run_id: null,
    decision: 'silent',
    task_ids: [],
    routing_targets: {},
    mission_tasks: {},
    spawn_result: {},
    reconcile_summary: null,
    dry_run: DRY_RUN,
    error: null,
  };

  try {
    await fs.mkdir(STATE_DIR, { recursive: true });
    locked = await acquireLock(orchestratorInstanceId);
    if (!locked) {
      event.error = 'orchestrator_lock_active';
      await appendJsonl(EVENTS_PATH, event);
      console.log('ANTI-IDLE: lock active, skipping');
      return;
    }

    db = openDb();

    // 1. Reconcile first (heartbeats + conservative-completion)
    event.reconcile_summary = reconcileSessions(db, orchestratorInstanceId);

    // 2. Run dispatcher
    const dispatch = await runDispatcher();
    event.dispatch_run_id = dispatch.dispatch_run_id || null;
    event.decision = dispatch.decision || 'silent';

    const validation = validateDispatcher(dispatch, db);
    if (!validation.ok) {
      event.error = `validation_failed:${validation.errors.join(',')}`;
      await appendJsonl(EVENTS_PATH, event);
      console.log(`ANTI-IDLE BLOCKED — dispatcher schema invalid: ${validation.errors.join(', ')}`);
      await postNotify(`⚠️ dispatcher validation failed (${validation.errors.join(', ')})`, {
        category: 'error',
        meta: { errors: validation.errors, dispatchRunId: dispatch.dispatch_run_id || null },
      });
      return;
    }

    if (validation.decision === 'silent') {
      await appendJsonl(EVENTS_PATH, event);
      console.log('ANTI-IDLE: silent (queue healthy)');
      return; // exit 0 silently per spec
    }

    if (validation.decision === 'escalate') {
      const blocker = dispatch.blocker_summary || dispatch.reason_code || 'human-resolvable blocker';
      event.error = `escalate:${blocker}`;
      await appendJsonl(EVENTS_PATH, event);
      console.log(`ANTI-IDLE ESCALATE — ${blocker}`);
      await postNotify(`🛑 escalate: ${blocker}`, {
        category: 'error',
        meta: { blocker, dispatchRunId: dispatch.dispatch_run_id || null },
      });
      return;
    }

    // 3. decision = dispatch — create mission tasks
    const selectedIds = validation.selected;
    const routes = validation.routes;
    const spawnResults = [];

    for (const taskId of selectedIds) {
      const route = routes[taskId];
      const agent = agentForRoute(route);
      if (!agent) {
        spawnResults.push({ task_id: taskId, ok: false, reason: 'unsupported_route', route });
        continue;
      }

      // Skip if task already owned by a running session
      const active = db.prepare(`SELECT session_key FROM anti_idle_sessions WHERE task_id = ? AND status = 'running' LIMIT 1`).get(taskId);
      if (active) {
        spawnResults.push({ task_id: taskId, ok: false, skipped: true, reason: 'active_owner_exists' });
        continue;
      }

      // Durable load of current kanban row
      const row = fetchKanbanRow(db, taskId);
      if (!row) {
        spawnResults.push({ task_id: taskId, ok: false, reason: 'kanban_row_missing' });
        continue;
      }
      if (String(row.column_id || '').toLowerCase() !== 'todo') {
        spawnResults.push({ task_id: taskId, ok: false, skipped: true, reason: `not_todo:${row.column_id}` });
        continue;
      }

      // Wrap claim + mission + session in a transaction
      const missionId = crypto.randomBytes(4).toString('hex');
      const sessionKey = `session_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const prompt = buildMissionPrompt(row, dispatch, route, dispatch.dispatch_run_id);
      const title = `[anti-idle] ${String(row.title || '').slice(0, 80)}`;

      if (DRY_RUN) {
        spawnResults.push({
          task_id: taskId, ok: true, dry_run: true,
          route, mission_task_id: `dryrun-${missionId}`, session_key: `dryrun-${sessionKey}`,
        });
        continue;
      }

      const txn = db.transaction(() => {
        const claim = atomicClaimKanban(db, row, dispatch.dispatch_run_id, dispatch.reason_code || 'anti_idle_dispatch', route);
        if (!claim.ok) return { ok: false, reason: 'claim_conflict' };

        createMissionTaskRow(db, { missionId, title, prompt, agent, priority: 5 });

        const now = nowUnix();
        db.prepare(`
          INSERT INTO anti_idle_sessions
            (session_key, dispatch_run_id, task_id, mission_task_id, routing_target,
             orchestrator_instance_id, status, started_at, last_heartbeat_at, lease_expires_at,
             kanban_prev_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)
        `).run(
          sessionKey, dispatch.dispatch_run_id, taskId, missionId, route,
          orchestratorInstanceId, now, now, now + LEASE_HOURS * 3600,
          String(row.updated_at ?? '')
        );
        return { ok: true };
      });

      const result = txn();
      if (!result.ok) {
        spawnResults.push({ task_id: taskId, ok: false, reason: result.reason });
        continue;
      }
      spawnResults.push({ task_id: taskId, ok: true, route, mission_task_id: missionId, session_key: sessionKey });
      event.mission_tasks[taskId] = missionId;
    }

    event.task_ids = selectedIds;
    event.routing_targets = routes;
    event.spawn_result = { results: spawnResults };

    await appendJsonl(EVENTS_PATH, event);

    // 4. Build summary line + post to Telegram
    const successes = spawnResults.filter((r) => r.ok);
    const reconciled = event.reconcile_summary?.reconciled ?? 0;
    if (successes.length > 0) {
      const pieces = successes.map((r) => {
        const row = fetchKanbanRow(db, r.task_id);
        const title = (row?.title || r.task_id).slice(0, 50);
        return `${r.route}:${r.mission_task_id} "${title}"`;
      });
      const summary = DRY_RUN
        ? `🧪 [dry-run] would dispatch: ${pieces.join(' | ')}`
        : `🤖 dispatched ${successes.length}: ${pieces.join(' | ')}`;
      console.log(summary);
      const posted = await postNotify(summary, {
        category: 'anti_idle_summary',
        meta: {
          kanbanTasksReconciled: reconciled,
          missionsDispatched: successes.length,
          dispatchRunId: dispatch.dispatch_run_id || null,
          dryRun: DRY_RUN,
        },
      });
      if (!posted.ok && !posted.skipped) console.error('[anti-idle] Telegram post failed:', posted.reason);
    } else {
      const reasons = spawnResults.map((r) => `${r.task_id}:${r.reason}`).join(', ');
      const summary = `ANTI-IDLE BLOCKED — no dispatch succeeded (${reasons || 'n/a'})`;
      console.log(summary);
      await postNotify(`⚠️ ${summary}`, {
        category: 'error',
        meta: {
          kanbanTasksReconciled: reconciled,
          missionsDispatched: 0,
          dispatchRunId: dispatch.dispatch_run_id || null,
          reasons: spawnResults.map((r) => ({ task_id: r.task_id, reason: r.reason })),
        },
      });
    }
  } catch (error) {
    event.error = String(error?.message || error);
    await appendJsonl(EVENTS_PATH, event).catch(() => {});
    console.error('[anti-idle-orchestrator] error:', event.error);
    try {
      await postNotify(`💥 orchestrator error: ${event.error.slice(0, 200)}`, {
        category: 'error',
        meta: { orchestratorInstanceId, error: event.error.slice(0, 500) },
      });
    } catch {}
    process.exitCode = 1;
  } finally {
    try { db?.close(); } catch {}
    if (locked) await releaseLock();
  }
}

main();
