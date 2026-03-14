/**
 * Dispatch Worker
 *
 * Standalone process that polls the dispatch_queue for pending tasks
 * and executes them via Claude Code. Run one or more workers alongside
 * the main bot to enable parallel task execution.
 *
 * Usage:
 *   node dist/worker.js                          # general worker
 *   node dist/worker.js --hint research           # research-focused worker
 *   node dist/worker.js --hint coding             # coding-focused worker
 *   node dist/worker.js --hint content            # content-focused worker
 *
 * Workers claim tasks atomically from the shared SQLite queue.
 * Multiple workers can run safely — each task is claimed by exactly one worker.
 *
 * The worker loads its CLAUDE.md from either:
 *   1. agents/<hint>/CLAUDE.md (if the directory exists)
 *   2. CLAUDECLAW_CONFIG/CLAUDE.md (main bot's personality)
 *   3. The repo's CLAUDE.md (template)
 *
 * Manage workers with any process supervisor: pm2, systemd, launchd, or just
 * run them in terminal tabs during development.
 */

import fs from 'fs';
import path from 'path';

import { runAgent } from './agent.js';
import { PROJECT_ROOT, CLAUDECLAW_CONFIG, expandHome } from './config.js';
import {
  claimTask,
  completeTask,
  failTask,
  initDispatch,
  resetStaleTasks,
} from './dispatch.js';
import { initDatabase, logToHiveMind } from './db.js';
import { logger } from './logger.js';

const POLL_INTERVAL_MS = 5_000;
const STALE_RESET_INTERVAL_MS = 60_000;

// ── CLI args ─────────────────────────────────────────────────────────

function parseArgs(): { hint: string } {
  const args = process.argv.slice(2);
  const hintIndex = args.indexOf('--hint');
  const hint = hintIndex !== -1 && hintIndex + 1 < args.length
    ? args[hintIndex + 1]
    : 'general';
  return { hint };
}

// ── Worker CWD resolution ────────────────────────────────────────────

/**
 * Resolve the working directory for a worker.
 * If an agent directory exists for this hint, use it (loads agent-specific CLAUDE.md).
 * Otherwise use the project root (loads main bot's CLAUDE.md).
 */
function resolveWorkerCwd(hint: string): string {
  // Check for agent-specific directory
  const agentDir = path.resolve(PROJECT_ROOT, 'agents', hint);
  if (fs.existsSync(agentDir)) {
    return agentDir;
  }
  return PROJECT_ROOT;
}

/**
 * Load the system prompt for a worker.
 * Priority: agents/<hint>/CLAUDE.md → CLAUDECLAW_CONFIG/CLAUDE.md → null
 */
function loadWorkerSystemPrompt(hint: string): string | undefined {
  // Agent-specific CLAUDE.md
  const agentClaudeMd = path.resolve(PROJECT_ROOT, 'agents', hint, 'CLAUDE.md');
  if (fs.existsSync(agentClaudeMd)) {
    try {
      return fs.readFileSync(agentClaudeMd, 'utf-8');
    } catch { /* fall through */ }
  }

  // External config CLAUDE.md (same as main bot)
  const externalClaudeMd = path.join(expandHome(CLAUDECLAW_CONFIG), 'CLAUDE.md');
  if (fs.existsSync(externalClaudeMd)) {
    try {
      return fs.readFileSync(externalClaudeMd, 'utf-8');
    } catch { /* fall through */ }
  }

  return undefined;
}

// ── Task execution ───────────────────────────────────────────────────

async function processTask(hint: string): Promise<boolean> {
  const task = claimTask(hint);
  if (!task) return false;

  const cwd = resolveWorkerCwd(hint);
  const systemPrompt = loadWorkerSystemPrompt(hint);

  logger.info(
    { taskId: task.id, hint, promptLen: task.prompt.length, cwd },
    'Claimed task',
  );

  const startTime = Date.now();

  // Build prompt with optional system prompt prefix
  const promptParts: string[] = [];
  if (systemPrompt) {
    promptParts.push(`[Agent role — follow these instructions]\n${systemPrompt}\n[End agent role]`);
  }
  promptParts.push(task.prompt);
  const fullPrompt = promptParts.join('\n\n');

  try {
    const result = await runAgent(
      fullPrompt,
      task.session_id ?? undefined,
      () => {},  // No typing indicator (no Telegram context)
      undefined, // No progress callback
      undefined, // Default model
      undefined, // No abort controller
    );

    const text = result.text?.trim() || 'Task completed with no output.';
    completeTask(task.id, text, result.newSessionId);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.info({ taskId: task.id, hint, elapsed }, 'Task completed');

    // Log to hive mind so other agents can see what was done
    logToHiveMind(
      `worker:${hint}`,
      task.chat_id,
      'dispatch_completed',
      `${task.prompt.slice(0, 80)} → ${text.slice(0, 120)}`,
    );

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    failTask(task.id, errorMsg);

    logger.error({ err, taskId: task.id, hint }, 'Task failed');

    logToHiveMind(
      `worker:${hint}`,
      task.chat_id,
      'dispatch_failed',
      `${task.prompt.slice(0, 80)} → ERROR: ${errorMsg.slice(0, 100)}`,
    );

    return true; // We processed a task (even though it failed)
  }
}

// ── Main loop ────────────────────────────────────────────────────────

async function mainLoop(hint: string): Promise<void> {
  logger.info({ hint, pollIntervalMs: POLL_INTERVAL_MS }, 'Worker starting');

  // Periodically reset stale tasks (stuck in 'claimed' > 10min)
  setInterval(() => {
    resetStaleTasks(600);
  }, STALE_RESET_INTERVAL_MS);

  // Periodic cleanup of old completed tasks (every hour)
  const { pruneOldTasks } = await import('./dispatch.js');
  setInterval(() => {
    pruneOldTasks(7);
  }, 60 * 60 * 1000);

  // Main poll loop
  while (true) {
    try {
      const processed = await processTask(hint);
      if (!processed) {
        // No task available, wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      // If we processed a task, immediately check for another
    } catch (err) {
      logger.error({ err }, 'Unexpected error in worker loop');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 2));
    }
  }
}

// ── Entry point ──────────────────────────────────────────────────────

const { hint } = parseArgs();

// Initialize database (same SQLite file as main bot, WAL mode handles concurrent access)
const database = initDatabase();
initDispatch(database);

console.log(`\n  ClaudeClaw worker [${hint}] starting...\n`);

mainLoop(hint).catch((err) => {
  logger.fatal({ err }, 'Worker crashed');
  process.exit(1);
});
