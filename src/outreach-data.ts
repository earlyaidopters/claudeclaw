// Outreach tracker data for the BID Traffic Partnership campaign and any
// future campaigns. Source of truth is store/bid-roster.json (seeded by
// scripts/import-bids-to-clickup.mjs) plus the email log written by the
// Gmail watcher (store/email-log.json) and the per-contact status (already
// in store/pipeline-status.json, keyed by company id; for the BID campaign
// we key by email instead since these contacts may not have Vendasta ids).

import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';

const ROSTER_FILE = path.join(PROJECT_ROOT, 'store', 'bid-roster.json');
const EMAIL_LOG_FILE = path.join(PROJECT_ROOT, 'store', 'email-log.json');
const OUTREACH_STATUS_FILE = path.join(PROJECT_ROOT, 'store', 'outreach-status.json');

export interface BidContact {
  entity: string;
  city: string | null;
  contact: string | null;
  email: string;
  website: string | null;
  members: number | null;
}

export interface EmailEvent {
  email: string;            // recipient (or sender, for inbound)
  direction: 'out' | 'in';
  subject: string;
  threadId?: string;
  messageId?: string;
  ts: number;               // ms epoch
  opened?: boolean;         // tracked via pixel
}

export interface OutreachRow {
  email: string;
  entity: string;
  city: string | null;
  contact: string | null;
  website: string | null;
  members: number | null;
  status: string;
  lastSentAt: number | null;
  lastSentSubject: string | null;
  lastOpenedAt: number | null;
  lastRepliedAt: number | null;
  daysSinceLastTouch: number | null;
  nextAction: string;
}

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return fallback; }
}
function writeJson(p: string, v: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

function loadRoster(): BidContact[] {
  const r = readJson<{ bids?: BidContact[] }>(ROSTER_FILE, { bids: [] });
  return r.bids ?? [];
}
function loadEmailLog(): EmailEvent[] {
  return readJson<EmailEvent[]>(EMAIL_LOG_FILE, []);
}
function loadStatuses(): Record<string, string> {
  return readJson<Record<string, string>>(OUTREACH_STATUS_FILE, {});
}
function saveStatuses(s: Record<string, string>): void {
  writeJson(OUTREACH_STATUS_FILE, s);
}

const DAY = 24 * 3600 * 1000;

function nextActionFor(status: string, lastSentAt: number | null, lastRepliedAt: number | null): string {
  const days = lastSentAt ? Math.floor((Date.now() - lastSentAt) / DAY) : null;
  if (status === 'Endorsed') return 'Move members to Tier 2 pipeline';
  if (status === 'Declined') return 'Park — quarterly re-touch';
  if (status === 'Webinar Held') return 'Confirm endorsement; send recap';
  if (status === 'Webinar Booked') return 'Send calendar invite + prep email';
  if (status === 'Replied') return 'Book the discovery webinar';
  if (status === 'Opened') return days != null && days >= 3 ? 'Follow-up #1' : 'Wait for reply';
  if (status === 'Emailed') {
    if (days == null) return 'Send opener';
    if (days < 3) return 'Wait';
    if (days < 7) return 'Follow-up #1';
    return 'Follow-up #2 or call';
  }
  return 'Send opener email';
}

/** Build the outreach tracker view from the roster + email log + status store. */
export function getOutreachData(): { generatedAt: number; rows: OutreachRow[]; statuses: string[] } {
  const roster = loadRoster();
  const log = loadEmailLog();
  const statuses = loadStatuses();

  // Index email events by lowercase address.
  const byEmail = new Map<string, EmailEvent[]>();
  for (const e of log) {
    const k = (e.email || '').toLowerCase();
    if (!k) continue;
    const arr = byEmail.get(k) ?? [];
    arr.push(e);
    byEmail.set(k, arr);
  }

  const rows: OutreachRow[] = [];
  for (const b of roster) {
    const email = (b.email || '').toLowerCase();
    if (!email) continue;
    const events = (byEmail.get(email) ?? []).sort((a, c) => a.ts - c.ts);
    const sent = events.filter(e => e.direction === 'out');
    const opens = events.filter(e => e.direction === 'out' && e.opened);
    const replies = events.filter(e => e.direction === 'in');
    const lastSent = sent.at(-1) ?? null;
    const lastOpened = opens.at(-1) ?? null;
    const lastReplied = replies.at(-1) ?? null;

    // Status — explicit user-set value wins; otherwise infer from event log.
    let status = statuses[email] || 'Not contacted';
    if (!statuses[email]) {
      if (lastReplied) status = 'Replied';
      else if (lastOpened) status = 'Opened';
      else if (lastSent) status = 'Emailed';
    }

    const lastTouch = Math.max(lastSent?.ts ?? 0, lastOpened?.ts ?? 0, lastReplied?.ts ?? 0);
    const days = lastTouch ? Math.floor((Date.now() - lastTouch) / DAY) : null;

    rows.push({
      email,
      entity: b.entity,
      city: b.city,
      contact: b.contact,
      website: b.website,
      members: b.members,
      status,
      lastSentAt: lastSent?.ts ?? null,
      lastSentSubject: lastSent?.subject ?? null,
      lastOpenedAt: lastOpened?.ts ?? null,
      lastRepliedAt: lastReplied?.ts ?? null,
      daysSinceLastTouch: days,
      nextAction: nextActionFor(status, lastSent?.ts ?? null, lastReplied?.ts ?? null),
    });
  }

  // Sort: not contacted first (highest priority for new outreach), then by
  // days since touch desc (oldest needing follow-up next), Endorsed/Declined last.
  rows.sort((a, b) => {
    const aDone = a.status === 'Endorsed' || a.status === 'Declined';
    const bDone = b.status === 'Endorsed' || b.status === 'Declined';
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.status === 'Not contacted' && b.status !== 'Not contacted') return -1;
    if (b.status === 'Not contacted' && a.status !== 'Not contacted') return 1;
    return (b.daysSinceLastTouch ?? 0) - (a.daysSinceLastTouch ?? 0);
  });

  return {
    generatedAt: Date.now(),
    rows,
    statuses: [
      'Not contacted', 'Emailed', 'Opened', 'Replied',
      'Webinar Booked', 'Webinar Held', 'Endorsed', 'Declined',
    ],
  };
}

/** Manually set the outreach status for a BID contact. */
export function setOutreachStatus(email: string, status: string): void {
  const e = email.toLowerCase().trim();
  if (!e) return;
  const s = loadStatuses();
  if (!status || status === 'Not contacted') delete s[e]; else s[e] = status;
  saveStatuses(s);
  logger.info({ email: e, status }, 'outreach: status updated');
}

/** Append an email event to the log. Called by the Gmail watcher. */
export function recordEmailEvent(ev: EmailEvent): void {
  const log = loadEmailLog();
  // Dedupe by messageId if present.
  if (ev.messageId && log.some(x => x.messageId === ev.messageId && x.direction === ev.direction)) return;
  log.push(ev);
  // Keep most recent 5000 events to bound file size.
  if (log.length > 5000) log.splice(0, log.length - 5000);
  writeJson(EMAIL_LOG_FILE, log);
}
