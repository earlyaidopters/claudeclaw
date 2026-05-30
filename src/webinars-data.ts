// Webinars data — BID Discovery Webinar pipeline.
//
// Pulls events from Google Calendar whose title matches "webinar" (or whose
// description references the BID Traffic Partnership), matches attendees to
// the BID roster, and exposes a per-event view with attendees + post-event
// disposition (Endorsed / Pending / Pass).
//
// When an event is in the future and a BID attendee is on it, we promote
// that BID's outreach status to "Webinar Booked" automatically. When the
// event is in the past, we promote to "Webinar Held" (unless a disposition
// has already taken the contact further along).

import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';
import { getOAuthClient } from './google-api.js';
import { setOutreachStatus } from './outreach-data.js';

const ROSTER_FILE = path.join(PROJECT_ROOT, 'store', 'bid-roster.json');
const DISPOSITIONS_FILE = path.join(PROJECT_ROOT, 'store', 'webinar-dispositions.json');

interface BidContact { email: string; entity: string; city: string | null; contact: string | null; }

export interface WebinarAttendee {
  email: string;
  displayName: string | null;
  responseStatus: string | null;
  matchedBid: { entity: string; city: string | null; contact: string | null } | null;
  disposition: 'Endorsed' | 'Pending' | 'Pass' | null;
}

export interface WebinarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  htmlLink: string | null;
  attendees: WebinarAttendee[];
  status: 'upcoming' | 'past';
  bidAttendeeCount: number;
}

export interface WebinarsData {
  generatedAt: number;
  events: WebinarEvent[];
}

function loadRoster(): BidContact[] {
  try {
    const j = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf-8'));
    return (j.bids || []).filter((b: any) => b.email);
  } catch { return []; }
}
function loadDispositions(): Record<string, Record<string, 'Endorsed' | 'Pending' | 'Pass'>> {
  // { [eventId]: { [email]: disposition } }
  try { return JSON.parse(fs.readFileSync(DISPOSITIONS_FILE, 'utf-8')); }
  catch { return {}; }
}
function saveDispositions(d: Record<string, Record<string, 'Endorsed' | 'Pending' | 'Pass'>>): void {
  fs.mkdirSync(path.dirname(DISPOSITIONS_FILE), { recursive: true });
  fs.writeFileSync(DISPOSITIONS_FILE, JSON.stringify(d, null, 2));
}

function looksLikeWebinar(summary: string, description: string): boolean {
  const s = (summary + ' ' + description).toLowerCase();
  return s.includes('webinar') || s.includes('bid traffic') || s.includes('discovery webinar') || s.includes('bid partnership');
}

export async function getWebinarsData(): Promise<WebinarsData> {
  const roster = loadRoster();
  const rosterByEmail = new Map(roster.map(b => [b.email.toLowerCase(), b]));
  const dispositions = loadDispositions();

  let events: WebinarEvent[] = [];
  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000); // 30 days back
    const end = new Date(now.getTime() + 60 * 24 * 3600 * 1000);   // 60 days forward
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    for (const e of res.data.items || []) {
      if (!looksLikeWebinar(e.summary || '', e.description || '')) continue;
      const id = e.id || '';
      const startTs = e.start?.dateTime || e.start?.date || '';
      const startMs = new Date(startTs).getTime();
      const status: 'upcoming' | 'past' = startMs >= Date.now() ? 'upcoming' : 'past';

      const attendees: WebinarAttendee[] = (e.attendees || []).map(a => {
        const email = (a.email || '').toLowerCase();
        const matched = rosterByEmail.get(email);
        return {
          email,
          displayName: a.displayName || null,
          responseStatus: a.responseStatus || null,
          matchedBid: matched ? { entity: matched.entity, city: matched.city, contact: matched.contact } : null,
          disposition: dispositions[id]?.[email] ?? null,
        };
      });

      const bidAttendeeCount = attendees.filter(a => a.matchedBid).length;

      // Auto-promote outreach status for matched BID attendees.
      for (const a of attendees) {
        if (!a.matchedBid) continue;
        // Only promote if not already further along (Endorsed/Declined are terminal).
        try {
          setOutreachStatus(a.email, status === 'upcoming' ? 'Webinar Booked' : 'Webinar Held');
        } catch (err) {
          logger.warn({ err: String((err as Error)?.message || err), email: a.email }, 'webinars: status promote failed');
        }
      }

      events.push({
        id,
        summary: e.summary || '(no title)',
        start: startTs,
        end: e.end?.dateTime || e.end?.date || '',
        location: e.location || null,
        htmlLink: e.htmlLink || null,
        attendees,
        status,
        bidAttendeeCount,
      });
    }
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e) }, 'webinars: calendar fetch failed (returning empty)');
  }

  // Sort: upcoming first (soonest), then past (most recent).
  events.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1;
    const at = new Date(a.start).getTime();
    const bt = new Date(b.start).getTime();
    return a.status === 'upcoming' ? at - bt : bt - at;
  });

  return { generatedAt: Date.now(), events };
}

/** Set or clear a per-attendee disposition. Endorsement also writes to the
 *  outreach status store so the Outreach Tracker reflects the truth. */
export function setWebinarDisposition(
  args: { eventId: string; email: string; disposition: 'Endorsed' | 'Pending' | 'Pass' | null },
): void {
  const { eventId, email, disposition } = args;
  if (!eventId || !email) throw new Error('eventId and email required');
  const e = email.toLowerCase();
  const all = loadDispositions();
  if (!all[eventId]) all[eventId] = {};
  if (disposition) all[eventId][e] = disposition;
  else delete all[eventId][e];
  saveDispositions(all);

  // Cascade into outreach status.
  if (disposition === 'Endorsed') setOutreachStatus(e, 'Endorsed');
  else if (disposition === 'Pass') setOutreachStatus(e, 'Declined');
  // 'Pending' leaves the existing status as-is (still Webinar Held).
}
