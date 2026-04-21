/**
 * Alert router — single chokepoint for every outbound Telegram message from
 * every agent (main + spokes).
 *
 * Classifies each message as REALTIME, DIGEST, or DROP.
 *  - REALTIME → sends immediately (ignores quiet hours)
 *  - DIGEST   → queued in pending_alerts; flushed hourly during waking hours
 *  - DROP     → never sent; logged to audit (if enabled)
 *
 * Kill switch: ALERT_ROUTER_MODE
 *   strict  — classify + enforce (default)
 *   lenient — only pre-run pings drop; rest behaves legacy (immediate send)
 *   off     — pure legacy passthrough (no classification, no queueing)
 *
 * Design constraints (per spec):
 *  - No LLM calls. Pure rules.
 *  - Additive-only: never replaces the bot, just gates it.
 *  - Digest CLI (separate process) drains pending_alerts; no turns burned.
 */

import Database from 'better-sqlite3';
import path from 'path';

import { STORE_DIR } from './config.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import { loadAgentConfig } from './agent-config.js';

// ── Types ────────────────────────────────────────────────────────────
export type AlertCategory =
  // REALTIME categories
  | 'error'
  | 'failure'
  | 'decision_required'
  | 'blocked'
  | 'trade_executed'
  | 'lead_booked'
  | 'deal_closed'
  | 'post_published'
  | 'post_rejected'
  | 'money_moved'
  | 'pipeline_halt'
  // DIGEST categories (explicit)
  | 'task_result'
  | 'mission_result'
  | 'anti_idle_summary'
  | 'oauth_health'
  // Other
  | string;

export type AlertSeverity = 'realtime' | 'digest' | 'drop';
export type AlertResult = 'realtime' | 'digest' | 'dropped';
export type AlertRouterMode = 'strict' | 'lenient' | 'off';

export interface SendAlertOptions {
  agentId: string;
  chatId: string;
  content: string;
  category?: AlertCategory;
  severity?: AlertSeverity;
  meta?: Record<string, unknown>;
}

// ── Env-driven config (lazy, re-read each call so crons pick up changes) ──
interface RouterConfig {
  mode: AlertRouterMode;
  perAgentMode: Record<string, AlertRouterMode>;
  quietStart: number;
  quietEnd: number;
  timezone: string;
  auditEnabled: boolean;
}

function readConfig(): RouterConfig {
  const env = {
    ...readEnvFile([
      'ALERT_ROUTER_MODE',
      'ALERT_QUIET_HOURS_START',
      'ALERT_QUIET_HOURS_END',
      'ALERT_TIMEZONE',
      'ALERT_AUDIT_ENABLED',
      'ALERT_PER_AGENT_MODE',
    ]),
    ...process.env,
  };

  const parseMode = (v: string | undefined): AlertRouterMode => {
    const s = String(v || 'strict').toLowerCase();
    return s === 'strict' || s === 'lenient' || s === 'off' ? (s as AlertRouterMode) : 'strict';
  };

  let perAgent: Record<string, AlertRouterMode> = {};
  try {
    const raw = env.ALERT_PER_AGENT_MODE || '{}';
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) perAgent[k] = parseMode(v);
  } catch {
    /* ignore malformed JSON */
  }

  return {
    mode: parseMode(env.ALERT_ROUTER_MODE),
    perAgentMode: perAgent,
    quietStart: parseInt(env.ALERT_QUIET_HOURS_START || '23', 10),
    quietEnd: parseInt(env.ALERT_QUIET_HOURS_END || '7', 10),
    timezone: env.ALERT_TIMEZONE || 'America/Los_Angeles',
    auditEnabled: (env.ALERT_AUDIT_ENABLED || 'true').toLowerCase() !== 'false',
  };
}

// ── DB handle (singleton, lazy) ──────────────────────────────────────
let _db: Database.Database | null = null;
function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(STORE_DIR, 'claudeclaw.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

// ── Classifier ───────────────────────────────────────────────────────
const REALTIME_CATEGORIES = new Set<string>([
  'error',
  'failure',
  'decision_required',
  'blocked',
  'trade_executed',
  'lead_booked',
  'deal_closed',
  'post_published',
  'post_rejected',
  'money_moved',
  'pipeline_halt',
]);

// Explicit DIGEST categories (non-error "I did a thing" summaries).
const DIGEST_CATEGORIES = new Set<string>([
  'task_result',
  'mission_result',
  'anti_idle_summary',
  'oauth_health',
  'heartbeat_summary',
]);

const REALTIME_REGEX =
  /\b(error|failed|failure|exception|traceback|timed out|blocked|needs decision|needs approval|approval required|posted|published|booked|rejected|declined|trade (executed|filled|closed)|stop loss|margin call)\b/i;

const DROP_PREFIX_REGEX =
  /^(Scheduled task running:|Mission task running:|Starting:|Kicking off:)/;

const DROP_EXACT_REGEX =
  /^(Task completed with no output|Nothing to report|No calls to fetch|Idle|Heartbeat ok)\.?$/i;

interface ClassifyResult {
  decision: AlertResult;
  rule: string;
}

export function classify(opts: {
  content: string;
  category?: string;
  severity?: AlertSeverity;
}): ClassifyResult {
  const content = (opts.content || '').trim();
  const category = opts.category;

  // Explicit severity param — highest priority
  if (opts.severity === 'realtime') return { decision: 'realtime', rule: 'severity:realtime' };
  if (opts.severity === 'drop') return { decision: 'dropped', rule: 'severity:drop' };

  // Leading tokens [URGENT] / 🚨 → realtime
  if (/^(\[URGENT\]|🚨)/i.test(content)) return { decision: 'realtime', rule: 'prefix:urgent' };

  // REALTIME category → realtime
  if (category && REALTIME_CATEGORIES.has(category)) {
    return { decision: 'realtime', rule: `category:${category}` };
  }

  // Explicit digest severity (don't let regex below promote to realtime)
  if (opts.severity === 'digest') return { decision: 'digest', rule: 'severity:digest' };

  // Explicit DIGEST category — skip the realtime regex.
  // "Task succeeded" often contains trigger words like "posted", but a
  // task_result categorisation means the caller already classified intent.
  if (category && DIGEST_CATEGORIES.has(category)) {
    // Still drop pure no-ops.
    if (DROP_EXACT_REGEX.test(content)) return { decision: 'dropped', rule: 'drop:noop' };
    if (DROP_PREFIX_REGEX.test(content)) return { decision: 'dropped', rule: 'drop:prerun' };
    return { decision: 'digest', rule: `category:${category}` };
  }

  // DROP: pre-run announcements
  if (DROP_PREFIX_REGEX.test(content)) return { decision: 'dropped', rule: 'drop:prerun' };

  // DROP: pure no-op results
  if (DROP_EXACT_REGEX.test(content)) return { decision: 'dropped', rule: 'drop:noop' };

  // REALTIME regex (fallback for uncategorised callers)
  if (REALTIME_REGEX.test(content)) return { decision: 'realtime', rule: 'regex:realtime' };

  // Default: DIGEST
  return { decision: 'digest', rule: 'default:digest' };
}

// ── Quiet-hours check ────────────────────────────────────────────────
export function isQuietHours(cfg: RouterConfig, now: Date = new Date()): boolean {
  // Get hour in the configured timezone without pulling in a tz library.
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.timezone,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return false;

  if (cfg.quietStart === cfg.quietEnd) return false;
  if (cfg.quietStart < cfg.quietEnd) {
    return hour >= cfg.quietStart && hour < cfg.quietEnd;
  }
  // Wraps midnight (e.g. 23→7)
  return hour >= cfg.quietStart || hour < cfg.quietEnd;
}

// ── Telegram sender (token-based, no grammy dep so the CLI path works) ──
/**
 * Per-agent bot token env var map.
 *
 * FAIL-LOUD contract (amendment to e02337a9, 2026-04-20): every outbound
 * Telegram message resolves its bot token via this map. Silent fallback
 * to main's token is how content-agent completions ended up in main's
 * chat — we refuse to paper over a missing env var.
 */
const AGENT_BOT_TOKEN_ENV: Record<string, string> = {
  main: 'TELEGRAM_BOT_TOKEN',
  research: 'RESEARCH_BOT_TOKEN',
  builder: 'BUILDER_BOT_TOKEN',
  content: 'CONTENT_BOT_TOKEN',
  ops: 'OPS_BOT_TOKEN',
  s2l: 'S2L_BOT_TOKEN',
  qa: 'QA_BOT_TOKEN',
  rainmaker: 'RAINMAKER_BOT_TOKEN',
  trader: 'TRADER_BOT_TOKEN',
};

function resolveBotToken(agentId: string): string {
  const explicitEnv = AGENT_BOT_TOKEN_ENV[agentId];
  if (explicitEnv) {
    const env = {
      ...readEnvFile([explicitEnv]),
      ...process.env,
    };
    const token = env[explicitEnv] || '';
    if (!token) {
      throw new Error(
        `Missing bot token for agent '${agentId}' — set ${explicitEnv} in .env`,
      );
    }
    return token;
  }
  // Fallback for custom agents not in the explicit map: read their agent.yaml.
  // loadAgentConfig already throws a clear "Bot token not found" error if the
  // configured env var is missing — preserves fail-loud behaviour.
  try {
    const cfg = loadAgentConfig(agentId);
    if (!cfg.botToken) {
      throw new Error(
        `Missing bot token for agent '${agentId}' — set ${cfg.botTokenEnv} in .env`,
      );
    }
    return cfg.botToken;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Missing bot token for agent '${agentId}' — ${msg}`,
    );
  }
}

const MAX_TG_LEN = 4096;

function splitForTelegram(text: string): string[] {
  if (text.length <= MAX_TG_LEN) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_TG_LEN) {
    const chunk = remaining.slice(0, MAX_TG_LEN);
    const nl = chunk.lastIndexOf('\n');
    const splitAt = nl > MAX_TG_LEN / 2 ? nl : MAX_TG_LEN;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

async function telegramSend(token: string, chatId: string, text: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`telegram ${res.status}: ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendRealtime(agentId: string, chatId: string, content: string): Promise<void> {
  // resolveBotToken throws with a clear "Missing bot token for agent '<id>'"
  // message — let it propagate so the caller sees the failure loud.
  const token = resolveBotToken(agentId);
  for (const chunk of splitForTelegram(content)) {
    try {
      await telegramSend(token, chatId, chunk);
    } catch (err) {
      logger.error({ err, agentId, chatId }, 'alert-router: realtime send failed');
      return;
    }
  }
}

// ── Audit log ────────────────────────────────────────────────────────
function audit(agentId: string, content: string, decision: AlertResult, rule: string): void {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO alert_decisions (agent_id, content_preview, classified_as, rule_hit, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(agentId, content.slice(0, 200), decision, rule, now);
  } catch (err) {
    logger.warn({ err }, 'alert-router: audit insert failed');
  }
}

export function pruneAuditLog(maxAgeDays = 7): number {
  try {
    const db = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400;
    const res = db.prepare(`DELETE FROM alert_decisions WHERE created_at < ?`).run(cutoff);
    return res.changes;
  } catch {
    return 0;
  }
}

// ── Queue (pending_alerts) ───────────────────────────────────────────
function queueDigest(agentId: string, chatId: string, content: string, category: string): void {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO pending_alerts (agent_id, chat_id, content, category, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(agentId, chatId, content, category, now);
  } catch (err) {
    logger.error({ err, agentId }, 'alert-router: queue insert failed');
  }
}

// ── Main entry point ─────────────────────────────────────────────────
export async function sendAlert(opts: SendAlertOptions): Promise<AlertResult> {
  const cfg = readConfig();
  const mode = cfg.perAgentMode[opts.agentId] ?? cfg.mode;

  // `off` — pure legacy passthrough (immediate send, no classification)
  if (mode === 'off') {
    await sendRealtime(opts.agentId, opts.chatId, opts.content);
    return 'realtime';
  }

  const { decision, rule } = classify({
    content: opts.content,
    category: opts.category,
    severity: opts.severity,
  });

  // `lenient` — only pre-run pings are dropped; everything else sends immediately
  if (mode === 'lenient') {
    if (decision === 'dropped' && rule === 'drop:prerun') {
      if (cfg.auditEnabled) audit(opts.agentId, opts.content, 'dropped', rule);
      return 'dropped';
    }
    await sendRealtime(opts.agentId, opts.chatId, opts.content);
    if (cfg.auditEnabled) audit(opts.agentId, opts.content, 'realtime', `lenient:${rule}`);
    return 'realtime';
  }

  // `strict` — full behaviour
  if (decision === 'dropped') {
    logger.debug({ agentId: opts.agentId, rule }, 'alert-router: dropped');
    if (cfg.auditEnabled) audit(opts.agentId, opts.content, 'dropped', rule);
    return 'dropped';
  }

  if (decision === 'realtime') {
    // Realtime ignores quiet hours by design.
    await sendRealtime(opts.agentId, opts.chatId, opts.content);
    if (cfg.auditEnabled) audit(opts.agentId, opts.content, 'realtime', rule);
    return 'realtime';
  }

  // digest
  queueDigest(opts.agentId, opts.chatId, opts.content, opts.category || 'task_result');
  if (cfg.auditEnabled) audit(opts.agentId, opts.content, 'digest', rule);
  return 'digest';
}

// ── Digest flush (called by alert-digest-cli) ────────────────────────
interface PendingRow {
  id: number;
  agent_id: string;
  chat_id: string;
  content: string;
  category: string;
  created_at: number;
}

export interface DigestResult {
  flushed: boolean;
  rowCount: number;
  reason?: string;
  text?: string;
}

function agentDisplayName(agentId: string): string {
  if (agentId === 'main') return 'Main';
  try {
    return loadAgentConfig(agentId).name;
  } catch {
    return agentId.charAt(0).toUpperCase() + agentId.slice(1);
  }
}

function formatHour(date: Date, tz: string): string {
  // "7pm" style, lowercase, no leading zero
  const hour12 = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: true,
  }).format(date);
  return hour12.toLowerCase().replace(/\s/g, '');
}

function tzLabel(tz: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(date);
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    return name || tz;
  } catch {
    return tz;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  task_result: 'Completed',
  mission_result: 'Missions',
  anti_idle_summary: 'Anti-idle',
  oauth_health: 'OAuth',
  heartbeat_summary: 'Heartbeat',
};

const MAX_DIGEST_LINES = 20;
const MAX_LINE_CHARS = 200;

function formatDigest(
  agentId: string,
  rows: PendingRow[],
  cfg: RouterConfig,
  now: Date,
): string {
  const name = agentDisplayName(agentId);
  const tz = tzLabel(cfg.timezone, now);

  // Title hour-range: earliest row's hour → now's hour
  const earliest = new Date(Math.min(...rows.map((r) => r.created_at * 1000)));
  const startLabel = formatHour(earliest, cfg.timezone);
  const endLabel = formatHour(now, cfg.timezone);
  const title = `🕐 ${name} digest — ${startLabel}–${endLabel} ${tz}`;

  // Group by category
  const byCat = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const cat = r.category || 'task_result';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(r);
  }

  const lines: string[] = [title];
  const bodyLines: string[] = [];
  for (const [cat, items] of byCat.entries()) {
    const label = CATEGORY_LABELS[cat] || cat;
    bodyLines.push(`${label} (${items.length}):`);
    for (const r of items) {
      const firstLine = r.content.split('\n')[0].trim();
      const clipped =
        firstLine.length > MAX_LINE_CHARS ? firstLine.slice(0, MAX_LINE_CHARS - 1) + '…' : firstLine;
      bodyLines.push(`• ${clipped}`);
    }
  }

  // Cap at MAX_DIGEST_LINES (title counts separately)
  let truncated: string[];
  if (bodyLines.length > MAX_DIGEST_LINES) {
    const overflow = bodyLines.length - (MAX_DIGEST_LINES - 1);
    truncated = bodyLines.slice(0, MAX_DIGEST_LINES - 1);
    truncated.push(`…and ${overflow} more — see dashboard`);
  } else {
    truncated = bodyLines;
  }

  return [...lines, ...truncated].join('\n');
}

/**
 * Flush pending_alerts for one agent.
 * Called by dist/alert-digest-cli.js (scheduled hourly) — no LLM involved.
 *
 * Quiet-hours semantics: if we're currently in quiet hours, skip the flush
 * entirely (rows stay queued). First waking-hour run flushes all accumulated
 * overnight entries.
 */
export async function flushDigestForAgent(agentId: string): Promise<DigestResult> {
  const cfg = readConfig();
  const now = new Date();

  if (isQuietHours(cfg, now)) {
    return { flushed: false, rowCount: 0, reason: 'quiet_hours' };
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, agent_id, chat_id, content, category, created_at
         FROM pending_alerts
        WHERE agent_id = ? AND sent_at IS NULL
        ORDER BY created_at ASC`,
    )
    .all(agentId) as PendingRow[];

  if (rows.length === 0) {
    return { flushed: false, rowCount: 0, reason: 'empty' };
  }

  // All rows share the same chat target (the agent's own chat).
  // If they diverge, group by chat and send separately.
  const byChat = new Map<string, PendingRow[]>();
  for (const r of rows) {
    if (!byChat.has(r.chat_id)) byChat.set(r.chat_id, []);
    byChat.get(r.chat_id)!.push(r);
  }

  const sentIds: number[] = [];
  let combinedText: string | undefined;

  for (const [chatId, group] of byChat.entries()) {
    const text = formatDigest(agentId, group, cfg, now);
    combinedText = combinedText ? `${combinedText}\n\n${text}` : text;
    try {
      await sendRealtime(agentId, chatId, text);
      for (const r of group) sentIds.push(r.id);
    } catch (err) {
      logger.error({ err, agentId, chatId }, 'alert-router: digest send failed');
      // Leave rows queued — they'll retry next hour.
    }
  }

  if (sentIds.length > 0) {
    const markSent = db.prepare(`UPDATE pending_alerts SET sent_at = ? WHERE id = ?`);
    const ts = Math.floor(Date.now() / 1000);
    const tx = db.transaction((ids: number[]) => {
      for (const id of ids) markSent.run(ts, id);
    });
    tx(sentIds);
  }

  // Opportunistic audit prune — cheap, runs once per hour per agent.
  pruneAuditLog(7);

  return { flushed: true, rowCount: sentIds.length, text: combinedText };
}

// ── Test hooks ───────────────────────────────────────────────────────
export function _resetDbForTest(): void {
  if (_db) {
    try { _db.close(); } catch {}
  }
  _db = null;
}

// Re-export readConfig for tooling/testing
export { readConfig as _readConfigForTest };
