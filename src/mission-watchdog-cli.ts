#!/usr/bin/env node
/**
 * Mission watchdog CLI — one-shot wrapper around runMissionWatchdog().
 *
 * Designed to be called by a 10-minute cron registered via schedule-cli.
 *
 * Contract:
 *   - Exits 0 on any normal run (including "nothing to escalate").
 *   - Exits 0 even if ALLOWED_CHAT_ID / TELEGRAM_BOT_TOKEN are unset — the
 *     watchdog escalates via in-band mission_tasks, not Telegram.
 *   - Exits 1 only on an unexpected exception (DB corruption, module load
 *     failure, etc.) so the operator notices an actual outage.
 *
 * Always writes a structured summary line to stdout so log scraping works.
 */

import { runMissionWatchdog } from './mission-watchdog.js';
import { initDatabase } from './db.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  try {
    initDatabase();
    const res = await runMissionWatchdog();
    const summary = {
      ok: true,
      failedEscalated: res.failedEscalated,
      stuckEscalated: res.stuckEscalated,
      scheduledEscalated: res.scheduledEscalated,
      errors: res.errors,
      triagedMissions: res.triagedMissions,
    };
    process.stdout.write(JSON.stringify(summary) + '\n');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'mission-watchdog-cli: fatal');
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    process.stderr.write(`mission-watchdog-cli: ${msg}\n`);
    process.exit(1);
  }
}

main();
