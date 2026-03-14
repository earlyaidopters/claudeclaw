/**
 * Dispatch Queue
 *
 * SQLite-backed task queue for background worker execution.
 * Tasks are enqueued by the main bot (e.g. from the compound message
 * decomposer) and claimed by worker processes polling the queue.
 *
 * Lifecycle: pending → claimed → completed | failed
 *
 * Workers claim tasks atomically (single UPDATE with WHERE status='pending')
 * so multiple workers can safely poll the same queue without conflicts.
 */

import crypto from 'crypto';
import Database from 'better-sqlite3';

import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

export type DispatchStatus = 'pending' | 'claimed' | 'completed' | 'failed';

export interface DispatchTask {
  id: string;
  chat_id: string;
  prompt: string;
  worker_hint: string;
  status: DispatchStatus;
  result: string | null;
  error: string | null;
  session_id: string | null;
  created_at: number;
  claimed_at: number | null;
  completed_at: number | null;
  agent_id: string;
}

// ── Schema ───────────────────────────────────────────────────────────

/**
 * Create the dispatch_queue table if it doesn't exist.
 * Called during database initialization.
 */
export function createDispatchSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_queue (
      id            TEXT PRIMARY KEY,
      chat_id       TEXT NOT NULL,
      prompt        TEXT NOT NULL,
      worker_hint   TEXT NOT NULL DEFAULT 'general',
      status        TEXT NOT NULL DEFAULT 'pending',
      result        TEXT,
      error         TEXT,
      session_id    TEXT,
      created_at    INTEGER NOT NULL,
      claimed_at    INTEGER,
      completed_at  INTEGER,
      agent_id      TEXT NOT NULL DEFAULT 'main'
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_status ON dispatch_queue(status, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_dispatch_chat ON dispatch_queue(chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dispatch_hint ON dispatch_queue(worker_hint, status);
  `);
}

// ── Database reference ───────────────────────────────────────────────
// Set by initDispatch() during startup. Workers and the main bot share
// the same SQLite file via WAL mode.

let db: Database.Database;

export function initDispatch(database: Database.Database): void {
  db = database;
  createDispatchSchema(db);
}

// ── Queue operations ─────────────────────────────────────────────────

/**
 * Add a task to the dispatch queue.
 * Returns the generated task ID.
 */
export function enqueueTask(
  chatId: string,
  prompt: string,
  workerHint = 'general',
  agentId = 'main',
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO dispatch_queue (id, chat_id, prompt, worker_hint, status, created_at, agent_id)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(id, chatId, prompt, workerHint, now, agentId);

  logger.info({ taskId: id, workerHint, chatId }, 'Task enqueued');
  return id;
}

/**
 * Enqueue multiple tasks atomically (e.g. from a compound decomposition).
 * Returns the generated task IDs in order.
 */
export function enqueueBatch(
  chatId: string,
  tasks: Array<{ prompt: string; workerHint: string }>,
  agentId = 'main',
): string[] {
  const ids: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  const insert = db.prepare(
    `INSERT INTO dispatch_queue (id, chat_id, prompt, worker_hint, status, created_at, agent_id)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  );

  const batch = db.transaction(() => {
    for (const task of tasks) {
      const id = crypto.randomUUID();
      insert.run(id, chatId, task.prompt, task.workerHint, now, agentId);
      ids.push(id);
    }
  });

  batch();

  logger.info({ taskCount: ids.length, chatId }, 'Batch enqueued');
  return ids;
}

/**
 * Claim the next pending task matching the worker hint.
 * Uses an atomic UPDATE + SELECT to prevent race conditions
 * between multiple worker processes.
 *
 * Claim priority:
 * - Specialized workers (e.g. 'research') try their hint first, then any task
 * - General workers claim any pending task regardless of hint
 *
 * This ensures a single general worker can drain the entire queue,
 * while specialized workers preferentially handle their domain.
 *
 * @param workerHint  The worker type to claim for (e.g. 'research', 'coding').
 *                    Pass 'general' or omit to claim any task.
 * @returns The claimed task, or null if no matching tasks are pending.
 */
export function claimTask(workerHint?: string): DispatchTask | null {
  const now = Math.floor(Date.now() / 1000);

  // Specialized workers: try matching hint first, then any task
  if (workerHint && workerHint !== 'general') {
    // Try specific hint first
    const specific = db.prepare(
      `UPDATE dispatch_queue
       SET status = 'claimed', claimed_at = ?
       WHERE id = (
         SELECT id FROM dispatch_queue
         WHERE status = 'pending' AND worker_hint = ?
         ORDER BY created_at ASC
         LIMIT 1
       )
       RETURNING *`,
    ).get(now, workerHint) as DispatchTask | undefined;

    if (specific) {
      logger.info({ taskId: specific.id, workerHint }, 'Task claimed (specific hint)');
      return specific;
    }
  }

  // Fall through: claim any pending task (general or unmatched)
  const any = db.prepare(
    `UPDATE dispatch_queue
     SET status = 'claimed', claimed_at = ?
     WHERE id = (
       SELECT id FROM dispatch_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
     )
     RETURNING *`,
  ).get(now) as DispatchTask | undefined;

  if (any) {
    logger.info({ taskId: any.id, workerHint: any.worker_hint, claimedBy: workerHint ?? 'general' }, 'Task claimed (fallback)');
    return any;
  }

  return null;
}

/**
 * Mark a task as completed with its result.
 */
export function completeTask(id: string, result: string, sessionId?: string): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE dispatch_queue
     SET status = 'completed', result = ?, session_id = ?, completed_at = ?
     WHERE id = ?`,
  ).run(result.slice(0, 10000), sessionId ?? null, now, id);

  logger.info({ taskId: id }, 'Task completed');
}

/**
 * Mark a task as failed with an error message.
 */
export function failTask(id: string, error: string): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE dispatch_queue
     SET status = 'failed', error = ?, completed_at = ?
     WHERE id = ?`,
  ).run(error.slice(0, 2000), now, id);

  logger.info({ taskId: id, error: error.slice(0, 100) }, 'Task failed');
}

/**
 * Reset tasks stuck in 'claimed' state for longer than the timeout.
 * This handles worker crashes — tasks are returned to 'pending' so
 * another worker can pick them up.
 *
 * @param timeoutSeconds  How long a claimed task can be held before reset (default: 10 min)
 * @returns Number of tasks reset
 */
export function resetStaleTasks(timeoutSeconds = 600): number {
  const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
  const result = db.prepare(
    `UPDATE dispatch_queue
     SET status = 'pending', claimed_at = NULL
     WHERE status = 'claimed' AND claimed_at < ?`,
  ).run(cutoff);

  if (result.changes > 0) {
    logger.warn({ reset: result.changes, timeoutSeconds }, 'Reset stale dispatch tasks');
  }
  return result.changes;
}

/**
 * Get tasks by chat ID (for result polling).
 */
export function getTasksByChatId(
  chatId: string,
  status?: DispatchStatus,
  limit = 20,
): DispatchTask[] {
  if (status) {
    return db.prepare(
      'SELECT * FROM dispatch_queue WHERE chat_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?',
    ).all(chatId, status, limit) as DispatchTask[];
  }
  return db.prepare(
    'SELECT * FROM dispatch_queue WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(chatId, limit) as DispatchTask[];
}

/**
 * Get completed/failed tasks that haven't been notified yet.
 * Used by the result poller to deliver results back to Telegram.
 */
export function getUnnotifiedResults(): DispatchTask[] {
  return db.prepare(
    `SELECT * FROM dispatch_queue
     WHERE status IN ('completed', 'failed') AND session_id IS NOT NULL
     ORDER BY completed_at ASC`,
  ).all() as DispatchTask[];
}

/**
 * Get queue statistics for monitoring/dashboard.
 */
export function getQueueStats(): {
  pending: number;
  claimed: number;
  completed: number;
  failed: number;
} {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM dispatch_queue
  `).get() as { pending: number; claimed: number; completed: number; failed: number };

  return {
    pending: row.pending ?? 0,
    claimed: row.claimed ?? 0,
    completed: row.completed ?? 0,
    failed: row.failed ?? 0,
  };
}

/**
 * Clean up old completed/failed tasks.
 * Called periodically to prevent unbounded table growth.
 *
 * @param maxAgeDays  Delete completed/failed tasks older than this (default: 7 days)
 * @returns Number of tasks deleted
 */
export function pruneOldTasks(maxAgeDays = 7): number {
  const cutoff = Math.floor(Date.now() / 1000) - (maxAgeDays * 86400);
  const result = db.prepare(
    `DELETE FROM dispatch_queue
     WHERE status IN ('completed', 'failed') AND completed_at < ?`,
  ).run(cutoff);

  if (result.changes > 0) {
    logger.info({ deleted: result.changes, maxAgeDays }, 'Pruned old dispatch tasks');
  }
  return result.changes;
}
