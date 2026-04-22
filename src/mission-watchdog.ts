/**
 * Mission watchdog — surfaces silent failures by queueing auto-triage
 * missions on @main (opus). Covers three signals:
 *
 *   1. Failed missions (last 24h) that haven't been escalated.
 *   2. Stuck missions: status='running' for > 1 hour.
 *   3. Failed scheduled_tasks (last 1h): last_status='failed' OR last_result
 *      contains "Failed"/"Error", with a 1-hour de-dupe window so a cron that
 *      fails every 10 min doesn't spam triage missions.
 *
 * Escalation = create a priority-9 mission on @main (NOT a Telegram ping).
 * Main owns the triage → dispatches a reduced-scope muscle fix to the right
 * spoke, and only bothers Rudy if a permission/decision is needed.
 *
 * Idempotent: each source row gets escalated_at stamped after triage so the
 * same failure never triggers twice (within the 1h window for scheduled_tasks).
 */

import Database from 'better-sqlite3';
import path from 'path';

import { STORE_DIR } from './config.js';
import { logger } from './logger.js';
import { createAutoTriageMission } from './auto-triage.js';

const SCHEDULED_TASK_DEDUP_SECONDS = 3600; // 1 hour

interface FailedMissionRow {
  id: string;
  title: string;
  assigned_agent: string | null;
  error: string | null;
  prompt: string;
  result: string | null;
}

interface StuckMissionRow {
  id: string;
  title: string;
  assigned_agent: string | null;
  prompt: string;
  started_at: number;
}

interface FailedScheduledRow {
  id: string;
  prompt: string;
  schedule: string;
  agent_id: string | null;
  last_status: string | null;
  last_result: string | null;
  last_run: number;
}

export interface WatchdogResult {
  failedEscalated: number;
  stuckEscalated: number;
  scheduledEscalated: number;
  errors: number;
  triagedMissions: string[];
}

function getDb(): Database.Database {
  const dbPath = path.join(STORE_DIR, 'claudeclaw.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

/**
 * Run the watchdog once. Returns a structured result — the caller (CLI or
 * scheduler) decides how to surface it.
 *
 * NOTE: deliberately takes no chatId / no Telegram routing. All escalation
 * is in-band via mission_tasks. That makes the watchdog resilient to a
 * missing ALLOWED_CHAT_ID / bot-token misconfig — its whole job is to catch
 * failures, so it must not itself fail on an env-var issue.
 */
export async function runMissionWatchdog(): Promise<WatchdogResult> {
  const db = getDb();
  const result: WatchdogResult = {
    failedEscalated: 0,
    stuckEscalated: 0,
    scheduledEscalated: 0,
    errors: 0,
    triagedMissions: [],
  };

  try {
    // ── 1. Failed missions (last 24h, not yet escalated) ──────────────
    const failedRows = db
      .prepare(
        `SELECT id, title, assigned_agent, error, prompt, result
           FROM mission_tasks
          WHERE status = 'failed'
            AND escalated_at IS NULL
            AND created_at > strftime('%s','now','-24 hours')`,
      )
      .all() as FailedMissionRow[];

    const stampFailed = db.prepare(
      `UPDATE mission_tasks SET escalated_at = unixepoch() WHERE id = ?`,
    );

    for (const row of failedRows) {
      try {
        const triageId = createAutoTriageMission({
          kind: 'mission_failed',
          sourceId: row.id,
          title: row.title,
          assignedAgent: row.assigned_agent,
          prompt: row.prompt,
          error: row.error,
          lastOutput: row.result,
        });
        stampFailed.run(row.id);
        result.failedEscalated += 1;
        result.triagedMissions.push(triageId);
      } catch (err) {
        logger.error(
          { err, missionId: row.id },
          'mission-watchdog: failed to queue auto-triage for failed mission',
        );
        result.errors += 1;
      }
    }

    // ── 2. Stuck missions (running > 1h, not yet escalated) ──────────
    const stuckRows = db
      .prepare(
        `SELECT id, title, assigned_agent, prompt, started_at
           FROM mission_tasks
          WHERE status = 'running'
            AND escalated_at IS NULL
            AND started_at IS NOT NULL
            AND started_at < (unixepoch() - 3600)`,
      )
      .all() as StuckMissionRow[];

    const stampStuck = db.prepare(
      `UPDATE mission_tasks SET escalated_at = unixepoch() WHERE id = ?`,
    );

    for (const row of stuckRows) {
      const ageMin = Math.floor((Date.now() / 1000 - row.started_at) / 60);
      try {
        const triageId = createAutoTriageMission({
          kind: 'mission_stuck',
          sourceId: row.id,
          title: row.title,
          assignedAgent: row.assigned_agent,
          prompt: row.prompt,
          error: `Mission has been status='running' for ${ageMin} min with no completion.`,
          stuckMinutes: ageMin,
        });
        stampStuck.run(row.id);
        result.stuckEscalated += 1;
        result.triagedMissions.push(triageId);
      } catch (err) {
        logger.error(
          { err, missionId: row.id },
          'mission-watchdog: failed to queue auto-triage for stuck mission',
        );
        result.errors += 1;
      }
    }

    // ── 3. Failed scheduled_tasks (last 1h, not escalated recently) ──
    // Only run this if the column has been migrated — keeps the watchdog
    // forward-compatible with older DBs.
    if (hasColumn(db, 'scheduled_tasks', 'escalated_at')) {
      const failedScheduled = db
        .prepare(
          `SELECT id, prompt, schedule, agent_id, last_status, last_result, last_run
             FROM scheduled_tasks
            WHERE last_run IS NOT NULL
              AND last_run > strftime('%s','now','-1 hour')
              AND (
                last_status = 'failed'
                OR last_result LIKE '%Failed%'
                OR last_result LIKE '%Error%'
              )
              AND (escalated_at IS NULL OR escalated_at < unixepoch() - ?)`,
        )
        .all(SCHEDULED_TASK_DEDUP_SECONDS) as FailedScheduledRow[];

      const stampScheduled = db.prepare(
        `UPDATE scheduled_tasks SET escalated_at = unixepoch() WHERE id = ?`,
      );

      for (const row of failedScheduled) {
        // Derive a usable title from the first line of the prompt — scheduled_tasks
        // don't have a dedicated title column.
        const firstLine = (row.prompt || '').split('\n')[0].trim();
        const title = firstLine.length > 100 ? firstLine.slice(0, 99) + '…' : firstLine;
        const errBlurb =
          row.last_status === 'failed'
            ? `scheduled_task last_status='failed'`
            : `scheduled_task last_result contains a failure marker`;
        try {
          const triageId = createAutoTriageMission({
            kind: 'scheduled_task_failed',
            sourceId: row.id,
            title: title || `scheduled_task ${row.id}`,
            assignedAgent: row.agent_id,
            schedule: row.schedule,
            prompt: row.prompt,
            error: errBlurb + ` (last_run=${row.last_run})`,
            lastOutput: row.last_result,
          });
          stampScheduled.run(row.id);
          result.scheduledEscalated += 1;
          result.triagedMissions.push(triageId);
        } catch (err) {
          logger.error(
            { err, scheduledTaskId: row.id },
            'mission-watchdog: failed to queue auto-triage for scheduled_task',
          );
          result.errors += 1;
        }
      }
    } else {
      logger.warn(
        'mission-watchdog: scheduled_tasks.escalated_at column missing — skipping scheduled_tasks scan. Run `npm run migrate`.',
      );
    }
  } finally {
    db.close();
  }

  return result;
}
