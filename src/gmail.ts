/**
 * Gmail service module.
 *
 * Uses GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET + GMAIL_REFRESH_TOKEN
 * from the environment to mint access tokens at runtime. No filesystem state —
 * works on Fly.io with secrets, locally with .env.
 *
 * For the existing on-host flow that stores encrypted tokens in
 * store/google-tokens.json (calendar + read-only gmail watcher), see
 * src/google-api.ts. These two paths are intentionally separate.
 */

import { OAuth2Client } from 'google-auth-library';
import { google, type gmail_v1 } from 'googleapis';

import {
  GMAIL_REFRESH_TOKEN,
  GMAIL_FROM_ADDRESS,
} from './config.js';
import { readEnvFile } from './env.js';

// ── OAuth client (lazy singleton) ────────────────────────────────────

let cachedClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (cachedClient) return cachedClient;

  const env = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Gmail OAuth not configured: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing.',
    );
  }
  if (!GMAIL_REFRESH_TOKEN) {
    throw new Error(
      'GMAIL_REFRESH_TOKEN is not set. Run `npx tsx src/gmail-auth.ts` locally to mint one, ' +
      'then `fly secrets set GMAIL_REFRESH_TOKEN=<token> -a claudeclaw-impactworks`.',
    );
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  cachedClient = client;
  return client;
}

function gmailClient(): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: getOAuthClient() });
}

// ── MIME helpers ─────────────────────────────────────────────────────

/**
 * RFC 2047 encode the display portion of a header value so non-ASCII subjects
 * and From names survive transit.
 */
function encodeHeader(value: string): string {
  // Only encode if there's a non-ASCII byte; otherwise leave plain.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

/**
 * Build a single multipart/alternative MIME message. Returns the URL-safe
 * base64 form Gmail's API expects in `raw`.
 */
interface MimeOpts {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  inReplyTo?: string;
  references?: string;
}

function buildMime(opts: MimeOpts): string {
  const boundary = `=_cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const headers: string[] = [];
  headers.push(`From: ${encodeHeader(opts.from)}`);
  headers.push(`To: ${opts.to}`);
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  headers.push(`Subject: ${encodeHeader(opts.subject)}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  headers.push('MIME-Version: 1.0');

  const text = opts.bodyText ?? (opts.bodyHtml ? stripHtml(opts.bodyHtml) : '');
  const html = opts.bodyHtml ?? '';

  let body: string;
  if (html && text) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body =
      `--${boundary}\r\n` +
      'Content-Type: text/plain; charset="UTF-8"\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n\r\n' +
      `${text}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: text/html; charset="UTF-8"\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n\r\n' +
      `${html}\r\n` +
      `--${boundary}--`;
  } else if (html) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 7bit');
    body = html;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 7bit');
    body = text;
  }

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeBody(data?: string | null): string {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/**
 * Recursively pull the best plain/html body out of a Gmail payload.
 */
function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { text: string; html: string } {
  if (!payload) return { text: '', html: '' };
  let text = '';
  let html = '';

  const walk = (part: gmail_v1.Schema$MessagePart): void => {
    const mime = part.mimeType || '';
    if (mime === 'text/plain' && part.body?.data && !text) {
      text = decodeBody(part.body.data);
    } else if (mime === 'text/html' && part.body?.data && !html) {
      html = decodeBody(part.body.data);
    }
    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  };
  walk(payload);

  if (!text && payload.body?.data) {
    text = decodeBody(payload.body.data);
  }
  return { text, html };
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  if (!headers) return '';
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

// ── Public API ───────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  /** HTML body. */
  body?: string;
  /** Plain-text body. If both provided, sends multipart/alternative. */
  bodyText?: string;
  from?: string;
}

export interface SendEmailResult {
  id: string;
  threadId: string;
}

/** Send a new email. Either `body` (HTML) or `bodyText` is required. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.to) throw new Error('sendEmail: `to` is required');
  if (!input.subject) throw new Error('sendEmail: `subject` is required');
  if (!input.body && !input.bodyText) {
    throw new Error('sendEmail: at least one of `body` or `bodyText` is required');
  }

  const raw = buildMime({
    from: input.from || GMAIL_FROM_ADDRESS,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    bodyHtml: input.body,
    bodyText: input.bodyText,
  });

  const res = await gmailClient().users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return {
    id: res.data.id || '',
    threadId: res.data.threadId || '',
  };
}

export interface EmailSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
}

export interface FullEmail extends EmailSummary {
  cc: string;
  bcc: string;
  bodyText: string;
  bodyHtml: string;
  labels: string[];
}

function summariseMessage(msg: gmail_v1.Schema$Message): EmailSummary {
  const headers = msg.payload?.headers;
  return {
    id: msg.id || '',
    threadId: msg.threadId || '',
    snippet: msg.snippet || '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    unread: (msg.labelIds || []).includes('UNREAD'),
  };
}

/** Fetch full body + headers for one message. */
export async function readEmail(messageId: string): Promise<FullEmail> {
  if (!messageId) throw new Error('readEmail: messageId is required');
  const res = await gmailClient().users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const msg = res.data;
  const summary = summariseMessage(msg);
  const { text, html } = extractBody(msg.payload);
  return {
    ...summary,
    cc: getHeader(msg.payload?.headers, 'Cc'),
    bcc: getHeader(msg.payload?.headers, 'Bcc'),
    bodyText: text,
    bodyHtml: html,
    labels: msg.labelIds || [],
  };
}

/** Search Gmail with the same query syntax the web client uses. */
export async function searchEmails(
  query: string,
  maxResults = 20,
): Promise<EmailSummary[]> {
  if (!query) throw new Error('searchEmails: query is required');
  const gmail = gmailClient();
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  const messages = list.data.messages || [];
  const results: EmailSummary[] = [];
  for (const m of messages) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    });
    results.push(summariseMessage(full.data));
  }
  return results;
}

/** Most recent inbox messages (newest first). Convenience over searchEmails. */
export async function listInbox(maxResults = 20): Promise<EmailSummary[]> {
  return searchEmails('in:inbox', maxResults);
}

export interface ReplyEmailInput {
  /** Original messageId we're replying to. */
  messageId: string;
  threadId: string;
  /** HTML body of the reply. */
  body?: string;
  bodyText?: string;
  /** Override the reply-all recipients. Defaults to original sender. */
  to?: string;
  cc?: string;
  from?: string;
}

/** Reply on an existing thread, preserving In-Reply-To / References headers. */
export async function replyToEmail(input: ReplyEmailInput): Promise<SendEmailResult> {
  if (!input.messageId) throw new Error('replyToEmail: messageId is required');
  if (!input.threadId) throw new Error('replyToEmail: threadId is required');
  if (!input.body && !input.bodyText) {
    throw new Error('replyToEmail: at least one of `body` or `bodyText` is required');
  }

  const gmail = gmailClient();

  // Fetch original headers so we can wire In-Reply-To / References / Subject.
  const original = await gmail.users.messages.get({
    userId: 'me',
    id: input.messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References'],
  });
  const headers = original.data.payload?.headers;
  const origMessageId = getHeader(headers, 'Message-ID');
  const origReferences = getHeader(headers, 'References');
  const origSubject = getHeader(headers, 'Subject');
  const origFrom = getHeader(headers, 'From');

  const replySubject = /^re:/i.test(origSubject) ? origSubject : `Re: ${origSubject}`;
  const references = [origReferences, origMessageId].filter(Boolean).join(' ');

  const raw = buildMime({
    from: input.from || GMAIL_FROM_ADDRESS,
    to: input.to || origFrom,
    cc: input.cc,
    subject: replySubject,
    bodyHtml: input.body,
    bodyText: input.bodyText,
    inReplyTo: origMessageId,
    references: references || undefined,
  });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: input.threadId,
    },
  });

  return {
    id: res.data.id || '',
    threadId: res.data.threadId || '',
  };
}

export interface CreateDraftInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body?: string;
  bodyText?: string;
  from?: string;
}

export interface CreateDraftResult {
  draftId: string;
  messageId: string;
  threadId: string;
}

/** Save a draft (does not send). */
export async function createDraft(input: CreateDraftInput): Promise<CreateDraftResult> {
  if (!input.to) throw new Error('createDraft: `to` is required');
  if (!input.subject) throw new Error('createDraft: `subject` is required');
  if (!input.body && !input.bodyText) {
    throw new Error('createDraft: at least one of `body` or `bodyText` is required');
  }

  const raw = buildMime({
    from: input.from || GMAIL_FROM_ADDRESS,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    bodyHtml: input.body,
    bodyText: input.bodyText,
  });

  const res = await gmailClient().users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });

  return {
    draftId: res.data.id || '',
    messageId: res.data.message?.id || '',
    threadId: res.data.message?.threadId || '',
  };
}

/** Quick health check the CLI can use without sending anything. */
export function isGmailConfigured(): boolean {
  const env = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || '';
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  return !!(id && secret && GMAIL_REFRESH_TOKEN);
}
