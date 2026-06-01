#!/usr/bin/env node
/**
 * ClaudeClaw Gmail CLI
 *
 * Used by the Telegram bot agent via the Bash tool. All commands print clean
 * JSON to stdout so the agent can parse output without scraping prose. Errors
 * print JSON to stderr and exit non-zero.
 *
 * Usage:
 *   node dist/gmail-cli.js send --to a@b.com [--cc x] [--bcc y] --subject "Hi" --body "..."
 *   node dist/gmail-cli.js search "from:dan after:2026/05/01" [--limit 20]
 *   node dist/gmail-cli.js inbox [--limit 10]
 *   node dist/gmail-cli.js read <messageId>
 *   node dist/gmail-cli.js reply --id <messageId> --thread <threadId> --body "..." [--to x] [--cc y]
 *   node dist/gmail-cli.js draft --to a@b.com --subject "Hi" --body "..." [--cc x]
 *   node dist/gmail-cli.js status
 */

import {
  sendEmail,
  searchEmails,
  listInbox,
  readEmail,
  replyToEmail,
  createDraft,
  isGmailConfigured,
} from './gmail.js';

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getNumFlag(name: string, fallback: number): number {
  const v = getFlag(name);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Strip recognised flag pairs out of argv so positional args remain clean. */
function positional(): string[] {
  const FLAGS = new Set([
    'to', 'cc', 'bcc', 'subject', 'body', 'body-text', 'bodyText',
    'id', 'thread', 'limit', 'from',
  ]);
  const skip = new Set<number>();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--') && FLAGS.has(a.slice(2))) {
      skip.add(i);
      skip.add(i + 1);
    }
  }
  return process.argv.filter((_, i) => i >= 2 && !skip.has(i));
}

function out(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function fail(message: string, code = 1): never {
  process.stderr.write(JSON.stringify({ ok: false, error: message }) + '\n');
  process.exit(code);
}

async function main(): Promise<void> {
  const pos = positional();
  const command = pos[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`Gmail CLI

  node dist/gmail-cli.js send    --to A --subject S --body HTML [--cc X] [--bcc Y] [--body-text TXT]
  node dist/gmail-cli.js search  "QUERY" [--limit N]
  node dist/gmail-cli.js inbox   [--limit N]
  node dist/gmail-cli.js read    MESSAGE_ID
  node dist/gmail-cli.js reply   --id MSG --thread TID --body HTML [--to X] [--cc X]
  node dist/gmail-cli.js draft   --to A --subject S --body HTML [--cc X]
  node dist/gmail-cli.js status
`);
    return;
  }

  if (command === 'status') {
    const configured = isGmailConfigured();
    out({ ok: true, configured });
    if (!configured) process.exit(1);
    return;
  }

  if (!isGmailConfigured()) {
    fail(
      'Gmail not configured. Need GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, ' +
      'and GMAIL_REFRESH_TOKEN. Run `npx tsx src/gmail-auth.ts` to mint a refresh token.',
    );
  }

  try {
    switch (command) {
      case 'send': {
        const to = getFlag('to');
        const subject = getFlag('subject');
        const body = getFlag('body');
        const bodyText = getFlag('body-text') ?? getFlag('bodyText');
        if (!to) fail('send: --to is required');
        if (!subject) fail('send: --subject is required');
        if (!body && !bodyText) fail('send: --body or --body-text is required');
        const res = await sendEmail({
          to: to!,
          cc: getFlag('cc'),
          bcc: getFlag('bcc'),
          subject: subject!,
          body,
          bodyText,
          from: getFlag('from'),
        });
        out({ ok: true, ...res });
        return;
      }

      case 'search': {
        const query = pos[1];
        if (!query) fail('search: query is required (positional)');
        const limit = getNumFlag('limit', 20);
        const results = await searchEmails(query!, limit);
        out({ ok: true, count: results.length, results });
        return;
      }

      case 'inbox': {
        const limit = getNumFlag('limit', 10);
        const results = await listInbox(limit);
        out({ ok: true, count: results.length, results });
        return;
      }

      case 'read': {
        const id = pos[1];
        if (!id) fail('read: MESSAGE_ID is required (positional)');
        const msg = await readEmail(id!);
        out({ ok: true, message: msg });
        return;
      }

      case 'reply': {
        const id = getFlag('id');
        const thread = getFlag('thread');
        const body = getFlag('body');
        const bodyText = getFlag('body-text') ?? getFlag('bodyText');
        if (!id) fail('reply: --id is required');
        if (!thread) fail('reply: --thread is required');
        if (!body && !bodyText) fail('reply: --body or --body-text is required');
        const res = await replyToEmail({
          messageId: id!,
          threadId: thread!,
          body,
          bodyText,
          to: getFlag('to'),
          cc: getFlag('cc'),
          from: getFlag('from'),
        });
        out({ ok: true, ...res });
        return;
      }

      case 'draft': {
        const to = getFlag('to');
        const subject = getFlag('subject');
        const body = getFlag('body');
        const bodyText = getFlag('body-text') ?? getFlag('bodyText');
        if (!to) fail('draft: --to is required');
        if (!subject) fail('draft: --subject is required');
        if (!body && !bodyText) fail('draft: --body or --body-text is required');
        const res = await createDraft({
          to: to!,
          cc: getFlag('cc'),
          bcc: getFlag('bcc'),
          subject: subject!,
          body,
          bodyText,
          from: getFlag('from'),
        });
        out({ ok: true, ...res });
        return;
      }

      default:
        fail(`Unknown command: ${command}. Try: send | search | inbox | read | reply | draft | status`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      fail('Gmail refresh token rejected. Re-mint: npx tsx src/gmail-auth.ts');
    }
    fail(msg);
  }
}

main();
