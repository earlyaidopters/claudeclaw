#!/usr/bin/env node
/**
 * Alert Digest CLI — drains pending_alerts for one agent and sends a single
 * combined digest message to that agent's chat.
 *
 * Pure Node/SQLite. No LLM. Runs in <1s. Scheduled hourly per agent.
 *
 * Usage:
 *   node dist/alert-digest-cli.js --agent <id>
 *
 * Exit codes:
 *   0 — flushed (or nothing to flush, or in quiet hours)
 *   1 — runtime error
 */

import { flushDigestForAgent } from './alert-router.js';
import { logger } from './logger.js';

function parseAgentFlag(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') return argv[i + 1] ?? 'main';
    if (a.startsWith('--agent=')) return a.slice('--agent='.length);
  }
  return process.env.CLAUDECLAW_AGENT_ID || 'main';
}

async function main(): Promise<void> {
  const agent = parseAgentFlag(process.argv.slice(2));

  try {
    const result = await flushDigestForAgent(agent);
    if (result.flushed) {
      console.log(`[digest:${agent}] sent ${result.rowCount} row(s)`);
    } else {
      console.log(`[digest:${agent}] no flush (${result.reason})`);
    }
    process.exit(0);
  } catch (err) {
    logger.error({ err, agent }, 'alert-digest-cli: flush failed');
    process.exit(1);
  }
}

main();
