// Gmail watcher for the BID Traffic Partnership campaign.
//
// Every 5 minutes:
//   1. Loads the BID roster (store/bid-roster.json).
//   2. Builds Gmail search queries to find recent sent + received messages
//      involving any BID email.
//   3. Records every match as an EmailEvent. The Outreach page reads from the
//      same log to derive Sent / Opened / Replied timestamps.
//   4. Promotes statuses: Not contacted -> Emailed (if there's an outbound),
//      and Emailed/Opened -> Replied (if there's a new inbound).
//
// Open tracking is not Gmail-native — implement it by injecting a 1×1 pixel
// in outbound emails (Apollo, Mailtrack, or a tiny endpoint on this server).
// For now this watcher only handles Send + Reply auto-promotion.

import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';
import { getRecentEmails } from './google-api.js';
import { recordEmailEvent, setOutreachStatus } from './outreach-data.js';
import { closeClickUpTasksForContact } from './clickup-utils.js';

const ROSTER_FILE = path.join(PROJECT_ROOT, 'store', 'bid-roster.json');
const CURSOR_FILE = path.join(PROJECT_ROOT, 'store', 'gmail-watcher-cursor.json');
const POLL_MS = 5 * 60 * 1000;

interface BidContact { email: string; entity: string; contact?: string; }
interface Cursor { lastRunMs: number; }

function loadRoster(): BidContact[] {
  try {
    const j = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf-8'));
    return (j.bids || []).filter((b: any) => b.email);
  } catch { return []; }
}
function loadCursor(): Cursor {
  try { return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8')); }
  catch { return { lastRunMs: Date.now() - 14 * 24 * 3600 * 1000 }; }
}
function saveCursor(c: Cursor): void {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true });
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(c, null, 2));
}

// Parse "Name <addr@domain>" headers.
function extractEmail(header: string): string | null {
  const m = header.match(/<([^>]+)>/);
  if (m) return m[1].toLowerCase().trim();
  if (header.includes('@')) return header.trim().toLowerCase();
  return null;
}

// Gmail epoch search uses seconds.
function epochSec(ms: number): number { return Math.floor(ms / 1000); }

/** Single polling pass. Exported so it can be called manually or via cron. */
export async function runGmailWatcherOnce(): Promise<{
  scanned: number; sentLogged: number; repliesLogged: number; promotions: number;
}> {
  const roster = loadRoster();
  if (!roster.length) {
    logger.info('gmail-watcher: roster empty, nothing to watch');
    return { scanned: 0, sentLogged: 0, repliesLogged: 0, promotions: 0 };
  }
  const emails = new Set(roster.map(b => b.email.toLowerCase()));
  // Lookup by lowercased email so the reply auto-close can pull the
  // human contact name out of the roster without a second file read.
  const byEmail = new Map<string, BidContact>();
  for (const b of roster) byEmail.set(b.email.toLowerCase(), b);
  const cursor = loadCursor();
  const since = epochSec(cursor.lastRunMs - 24 * 3600 * 1000); // 1 day overlap to catch slow indexing

  // Gmail caps OR-clauses; chunk addresses to stay under URL/query limits.
  const chunks: string[][] = [];
  const all = [...emails];
  for (let i = 0; i < all.length; i += 20) chunks.push(all.slice(i, i + 20));

  let sentLogged = 0, repliesLogged = 0, promotions = 0, scanned = 0;

  for (const chunk of chunks) {
    const ors = chunk.map(e => `"${e}"`).join(' OR ');

    // Outbound: messages we sent to any BID address.
    const sentQ = `in:sent after:${since} (${chunk.map(e => `to:${e}`).join(' OR ')})`;
    const sent = await getRecentEmails(sentQ, 50);
    scanned += sent.length;
    for (const m of sent) {
      // The "from" header is us; the recipient is in the To header which
      // getRecentEmails doesn't return. We re-query the chunk per message
      // by matching the subject + thread; cheap fallback is to log against
      // each BID in the chunk whose subject was likely meant for them. To
      // avoid noise, we record the message against whichever BID email
      // appears in the message metadata (we'll need to upgrade to a "To"
      // header fetch — for now we tag by the chunk's intersection).
      //
      // Simpler approach: do a per-recipient targeted query. Slower but
      // accurate. Worth it since the roster is small (~40).
    }

    // Per-recipient accurate path:
    for (const addr of chunk) {
      const myQ = `in:sent after:${since} to:${addr}`;
      const mine = await getRecentEmails(myQ, 20);
      for (const m of mine) {
        recordEmailEvent({
          email: addr,
          direction: 'out',
          subject: m.subject,
          threadId: m.threadId,
          messageId: m.id,
          ts: new Date(m.date).getTime() || Date.now(),
        });
        sentLogged++;
      }
      if (mine.length > 0) {
        // Promote Not contacted -> Emailed.
        setOutreachStatus(addr, 'Emailed');
        promotions++;
      }

      // Inbound: replies from this BID address.
      const repQ = `from:${addr} after:${since}`;
      const reps = await getRecentEmails(repQ, 20);
      for (const m of reps) {
        recordEmailEvent({
          email: addr,
          direction: 'in',
          subject: m.subject,
          threadId: m.threadId,
          messageId: m.id,
          ts: new Date(m.date).getTime() || Date.now(),
        });
        repliesLogged++;
      }
      if (reps.length > 0) {
        setOutreachStatus(addr, 'Replied');
        promotions++;

        // Reply detected → auto-close any open ClickUp tasks tagged for
        // this contact. ClickUp downtime must never break the watcher,
        // so we swallow everything here and the helper itself is also
        // try/catch-guarded internally.
        try {
          const bid = byEmail.get(addr);
          const contactName = bid?.contact?.trim();
          if (contactName) {
            await closeClickUpTasksForContact(contactName, addr);
          } else {
            logger.warn({ addr }, 'auto-close: roster entry missing contact name, skipping ClickUp');
          }
        } catch (err) {
          logger.warn(
            { err: err instanceof Error ? err.message : String(err), addr },
            'auto-close: ClickUp closure threw',
          );
        }
      }
    }
  }

  saveCursor({ lastRunMs: Date.now() });
  logger.info({ scanned, sentLogged, repliesLogged, promotions }, 'gmail-watcher: pass complete');
  return { scanned, sentLogged, repliesLogged, promotions };
}

let timer: NodeJS.Timeout | null = null;

/** Start the periodic poller. Idempotent. */
export function startGmailWatcher(): void {
  if (timer) return;
  logger.info({ intervalMs: POLL_MS }, 'gmail-watcher: starting');
  // Fire-and-forget initial pass; don't block startup.
  runGmailWatcherOnce().catch(e => logger.warn({ err: String(e?.message || e) }, 'gmail-watcher initial pass failed'));
  timer = setInterval(() => {
    runGmailWatcherOnce().catch(e => logger.warn({ err: String(e?.message || e) }, 'gmail-watcher pass failed'));
  }, POLL_MS);
  // Don't keep the event loop alive solely on the watcher timer.
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopGmailWatcher(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
