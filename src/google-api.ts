import fs from 'fs';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import { google, type calendar_v3, type gmail_v1 } from 'googleapis';

import { STORE_DIR } from './config.js';
import { readEnvFile } from './env.js';
import { encryptField, decryptField } from './db.js';
import { logger } from './logger.js';

// ── Token storage ────────────────────────────────────────────────

const TOKEN_FILE = path.join(STORE_DIR, 'google-tokens.json');

interface StoredTokens {
  access_token: string;   // encrypted
  refresh_token: string;  // encrypted
  expiry_date: number;
  token_type: string;
  scope: string;
}

export function loadTokens(): StoredTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

// ── Lazy singleton auth client ───────────────────────────────────

let oauthClient: OAuth2Client | null = null;

export function getOAuthClient(): OAuth2Client {
  if (oauthClient) return oauthClient;

  const env = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set in .env');
  }

  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('Google API not authorized. Run: npx tsx scripts/google-auth.ts');
  }

  oauthClient = new OAuth2Client(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    'http://localhost:9876/callback',
  );

  oauthClient.setCredentials({
    access_token: decryptField(tokens.access_token),
    refresh_token: decryptField(tokens.refresh_token),
    expiry_date: tokens.expiry_date,
    token_type: tokens.token_type,
  });

  // Auto-persist refreshed tokens
  oauthClient.on('tokens', (newTokens) => {
    try {
      const current = loadTokens();
      if (current) {
        if (newTokens.access_token) current.access_token = encryptField(newTokens.access_token);
        if (newTokens.refresh_token) current.refresh_token = encryptField(newTokens.refresh_token);
        if (newTokens.expiry_date) current.expiry_date = newTokens.expiry_date;
        saveTokens(current);
      }
      logger.info('Google API tokens refreshed and saved');
    } catch (err) {
      logger.error({ err }, 'Failed to persist refreshed Google tokens');
    }
  });

  return oauthClient;
}

// ── Public API ───────────────────────────────────────────────────

export function isGoogleApiConfigured(): boolean {
  const env = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  return !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && loadTokens());
}

/**
 * Fetch calendar events for a given date (ISO string like '2026-04-28').
 * Returns simplified event objects.
 */
export async function getCalendarEvents(
  date: string,
  calendarId = 'primary',
  maxResults = 20,
): Promise<Array<{
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  conferenceUrl?: string;
  status?: string;
}>> {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date(startOfDay).toISOString(),
    timeMax: new Date(endOfDay).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];
  return events.map((e) => ({
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || undefined,
    description: e.description ? e.description.slice(0, 200) : undefined,
    attendees: e.attendees?.map((a) => a.displayName || a.email || '').filter(Boolean),
    conferenceUrl: e.conferenceData?.entryPoints?.[0]?.uri || e.hangoutLink || undefined,
    status: e.status || undefined,
  }));
}

/**
 * Fetch calendar events for a date range.
 */
export async function getCalendarEventsRange(
  startDate: string,
  endDate: string,
  calendarId = 'primary',
  maxResults = 50,
): Promise<Array<{
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}>> {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date(`${startDate}T00:00:00`).toISOString(),
    timeMax: new Date(`${endDate}T23:59:59`).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];
  return events.map((e) => ({
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || undefined,
    attendees: e.attendees?.map((a) => a.displayName || a.email || '').filter(Boolean),
  }));
}

/**
 * Search Gmail threads. Returns snippets (not full bodies).
 */
export async function getRecentEmails(
  query = 'is:unread',
  maxResults = 10,
): Promise<Array<{
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
}>> {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = res.data.messages || [];
  const results: Array<{
    id: string;
    threadId: string;
    snippet: string;
    from: string;
    subject: string;
    date: string;
  }> = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      results.push({
        id: msg.id,
        threadId: msg.threadId || '',
        snippet: full.data.snippet || '',
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
      });
    } catch (err) {
      logger.warn({ err, msgId: msg.id }, 'Failed to fetch email metadata');
    }
  }

  return results;
}

/**
 * Get full thread content by thread ID.
 */
export async function getEmailThread(
  threadId: string,
): Promise<Array<{
  from: string;
  date: string;
  subject: string;
  body: string;
}>> {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = res.data.messages || [];
  return messages.map((msg) => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract plain text body
    let body = '';
    if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8');
    } else if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find((p) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
      }
    }

    return {
      from: getHeader('From'),
      date: getHeader('Date'),
      subject: getHeader('Subject'),
      body: body.slice(0, 2000),
    };
  });
}
