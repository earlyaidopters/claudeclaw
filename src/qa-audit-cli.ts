#!/usr/bin/env node
/**
 * QA outcome audit CLI — one-shot wrapper around runQaAudit().
 *
 * Designed to be called by a 30-minute cron registered via schedule-cli.
 *
 * Contract:
 *   - Exits 0 on a normal run (including zero audited).
 *   - Exits 0 even if ALLOWED_CHAT_ID / bot tokens are unset — QA FAIL
 *     verdicts escalate via in-band mission_tasks on @main, not Telegram.
 *   - Exits 1 only on unexpected exception.
 */

import { runQaAudit } from './qa-audit.js';
import { initDatabase } from './db.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  try {
    initDatabase();
    const res = await runQaAudit();
    process.stdout.write(
      JSON.stringify({
        ok: true,
        audited: res.audited,
        passed: res.passed,
        failed: res.failed,
        errors: res.errors,
      }) + '\n',
    );
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'qa-audit-cli: fatal');
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    process.stderr.write(`qa-audit-cli: ${msg}\n`);
    process.exit(1);
  }
}

main();
