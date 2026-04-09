#!/usr/bin/env node
/**
 * ClaudeClaw Slack CLI
 *
 * Thin wrapper around src/slack.ts for use by Claude via the Bash tool.
 *
 * Usage:
 *   node dist/slack-cli.js list [--limit N]
 *   node dist/slack-cli.js read <channel_id> [--limit N]
 *   node dist/slack-cli.js thread <channel_id> <thread_ts>
 *   node dist/slack-cli.js send <channel_id> <message> [--thread-ts TS]
 *   node dist/slack-cli.js search <query>
 */

import { initDatabase } from './db.js';
import {
  getSlackConversations,
  getSlackMessages,
  getSlackThreadReplies,
  sendSlackMessage,
} from './slack.js';

initDatabase();

const [, , command, ...rest] = process.argv;

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

async function main() {
  switch (command) {
    case 'list': {
      const limit = parseInt(parseFlag(rest, '--limit') || '20', 10);
      const convos = await getSlackConversations(limit);
      console.log(JSON.stringify(convos, null, 2));
      break;
    }

    case 'read': {
      const channelId = rest[0];
      if (!channelId || channelId.startsWith('--')) {
        console.error('Usage: slack-cli read <channel_id> [--limit N]');
        process.exit(1);
      }
      const limit = parseInt(parseFlag(rest, '--limit') || '15', 10);
      const messages = await getSlackMessages(channelId, limit);
      console.log(JSON.stringify(messages, null, 2));
      break;
    }

    case 'send': {
      const channelId = rest[0];
      const message = rest[1];
      if (!channelId || !message) {
        console.error('Usage: slack-cli send <channel_id> "message" [--thread-ts TS]');
        process.exit(1);
      }
      const threadTs = parseFlag(rest, '--thread-ts');
      await sendSlackMessage(channelId, message, channelId, threadTs);
      console.log(JSON.stringify({ ok: true, channel: channelId }));
      break;
    }

    case 'thread': {
      const channelId = rest[0];
      const threadTs = rest[1];
      if (!channelId || !threadTs || channelId.startsWith('--')) {
        console.error('Usage: slack-cli thread <channel_id> <thread_ts>');
        process.exit(1);
      }
      const replies = await getSlackThreadReplies(channelId, threadTs);
      console.log(JSON.stringify(replies, null, 2));
      break;
    }

    case 'search': {
      const query = rest[0];
      if (!query) {
        console.error('Usage: slack-cli search <query>');
        process.exit(1);
      }
      const all = await getSlackConversations(100);
      const q = query.toLowerCase();
      const matches = all.filter((c) => c.name.toLowerCase().includes(q));
      console.log(JSON.stringify(matches, null, 2));
      break;
    }

    default:
      console.error('Commands: list | read | thread | send | search');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
