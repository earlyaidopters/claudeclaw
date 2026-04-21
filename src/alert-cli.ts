#!/usr/bin/env node
/**
 * Alert CLI — thin wrapper over sendAlert() for shell callers (notify.sh).
 *
 * Usage:
 *   alert-cli --agent <id> --chat <chatId> [--severity realtime|digest|drop]
 *             [--category <category>] <message>
 *
 * Reads STDIN as message if no positional message passed.
 *
 * Exit code 0 on success (routed), 2 on config error, 1 on send failure.
 */

import { sendAlert, AlertSeverity } from './alert-router.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';

interface Args {
  agent: string;
  chat: string;
  severity?: AlertSeverity;
  category?: string;
  message: string;
}

function parseArgs(argv: string[]): Args {
  // Amendment to e02337a9 (2026-04-20): if CLAUDECLAW_AGENT_ID is unset AND
  // no --agent flag is provided, default to main but WARN to stderr so
  // misuse (forgetting to export CLAUDECLAW_AGENT_ID from a spoke process)
  // is visible. Silent fallback is what caused the content-in-main-chat bug.
  const envAgent = process.env.CLAUDECLAW_AGENT_ID;
  let agent = envAgent || 'main';
  let agentSource: 'flag' | 'env' | 'default' = envAgent ? 'env' : 'default';
  let chat = '';
  let severity: AlertSeverity | undefined;
  let category: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') { agent = argv[++i] ?? agent; agentSource = 'flag'; continue; }
    if (a.startsWith('--agent=')) { agent = a.slice('--agent='.length); agentSource = 'flag'; continue; }
    if (a === '--chat') { chat = argv[++i] ?? chat; continue; }
    if (a.startsWith('--chat=')) { chat = a.slice('--chat='.length); continue; }
    if (a === '--severity') { severity = argv[++i] as AlertSeverity; continue; }
    if (a.startsWith('--severity=')) { severity = a.slice('--severity='.length) as AlertSeverity; continue; }
    if (a === '--category') { category = argv[++i]; continue; }
    if (a.startsWith('--category=')) { category = a.slice('--category='.length); continue; }
    positional.push(a);
  }

  if (agentSource === 'default') {
    process.stderr.write(
      "alert-cli: WARNING — no --agent flag and CLAUDECLAW_AGENT_ID unset; defaulting to 'main'. " +
      'Set CLAUDECLAW_AGENT_ID in the calling env so spoke agents route through their own bot.\n',
    );
  }

  if (!chat) {
    const envFile = readEnvFile(['ALLOWED_CHAT_ID']);
    chat = process.env.ALLOWED_CHAT_ID || envFile.ALLOWED_CHAT_ID || '';
  }

  const message = positional.join(' ');
  return { agent, chat, severity, category, message };
}

async function readStdin(): Promise<string> {
  return await new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let message = args.message;
  if (!message && !process.stdin.isTTY) {
    message = (await readStdin()).trim();
  }

  if (!message) {
    console.error('alert-cli: no message (positional or stdin)');
    process.exit(2);
  }
  if (!args.chat) {
    console.error('alert-cli: --chat (or ALLOWED_CHAT_ID env) required');
    process.exit(2);
  }

  try {
    const result = await sendAlert({
      agentId: args.agent,
      chatId: args.chat,
      content: message,
      category: args.category,
      severity: args.severity,
    });
    // Print the decision so shell callers can inspect if they want.
    process.stdout.write(result + '\n');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'alert-cli: sendAlert failed');
    process.exit(1);
  }
}

main();
