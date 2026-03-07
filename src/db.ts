import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { STORE_DIR } from './config.js';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id          TEXT PRIMARY KEY,
      prompt      TEXT NOT NULL,
      schedule    TEXT NOT NULL,
      next_run    INTEGER NOT NULL,
      last_run    INTEGER,
      last_result TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON scheduled_tasks(status, next_run);

    CREATE TABLE IF NOT EXISTS sessions (
      chat_id   TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     TEXT NOT NULL,
      topic_key   TEXT,
      content     TEXT NOT NULL,
      sector      TEXT NOT NULL DEFAULT 'semantic',
      salience    REAL NOT NULL DEFAULT 1.0,
      created_at  INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_chat ON memories(chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_sector ON memories(chat_id, sector);

    CREATE TABLE IF NOT EXISTS wa_message_map (
      telegram_msg_id INTEGER PRIMARY KEY,
      wa_chat_id      TEXT NOT NULL,
      contact_name    TEXT NOT NULL,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wa_outbox (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      to_chat_id  TEXT NOT NULL,
      body        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      sent_at     INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_wa_outbox_unsent ON wa_outbox(sent_at) WHERE sent_at IS NULL;

    CREATE TABLE IF NOT EXISTS wa_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id      TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      body         TEXT NOT NULL,
      timestamp    INTEGER NOT NULL,
      is_from_me   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wa_messages_chat ON wa_messages(chat_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS conversation_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     TEXT NOT NULL,
      session_id  TEXT,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_convo_log_chat ON conversation_log(chat_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS token_usage (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id         TEXT NOT NULL,
      session_id      TEXT,
      input_tokens    INTEGER NOT NULL DEFAULT 0,
      output_tokens   INTEGER NOT NULL DEFAULT 0,
      cache_read      INTEGER NOT NULL DEFAULT 0,
      context_tokens  INTEGER NOT NULL DEFAULT 0,
      cost_usd        REAL NOT NULL DEFAULT 0,
      did_compact     INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_token_usage_chat ON token_usage(chat_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS slack_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id   TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      user_name    TEXT NOT NULL,
      body         TEXT NOT NULL,
      timestamp    TEXT NOT NULL,
      is_from_me   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_slack_messages_channel ON slack_messages(channel_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS hive_mind (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id    TEXT NOT NULL,
      chat_id     TEXT NOT NULL,
      action      TEXT NOT NULL,
      summary     TEXT NOT NULL,
      artifacts   TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hive_mind_agent ON hive_mind(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_hive_mind_time ON hive_mind(created_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content=memories,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `);
}

export function initDatabase(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const dbPath = path.join(STORE_DIR, 'claudeclaw.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  createSchema(db);
  runMigrations(db);
}

/** Add columns that may not exist in older databases. */
function runMigrations(database: Database.Database): void {
  // Add context_tokens column to token_usage (introduced for accurate context tracking)
  const cols = database.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>;
  const hasContextTokens = cols.some((c) => c.name === 'context_tokens');
  if (!hasContextTokens) {
    database.exec(`ALTER TABLE token_usage ADD COLUMN context_tokens INTEGER NOT NULL DEFAULT 0`);
  }

  // Multi-agent: add agent_id columns to existing tables
  const sessionCols = database.prepare(`PRAGMA table_info(sessions)`).all() as Array<{ name: string }>;
  if (!sessionCols.some((c) => c.name === 'agent_id')) {
    database.exec(`ALTER TABLE sessions ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'`);
  }

  const taskCols = database.prepare(`PRAGMA table_info(scheduled_tasks)`).all() as Array<{ name: string }>;
  if (!taskCols.some((c) => c.name === 'agent_id')) {
    database.exec(`ALTER TABLE scheduled_tasks ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'`);
  }

  const usageCols = database.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>;
  if (!usageCols.some((c) => c.name === 'agent_id')) {
    database.exec(`ALTER TABLE token_usage ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'`);
  }

  const convoCols = database.prepare(`PRAGMA table_info(conversation_log)`).all() as Array<{ name: string }>;
  if (!convoCols.some((c) => c.name === 'agent_id')) {
    database.exec(`ALTER TABLE conversation_log ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'`);
  }
}

/** @internal - for tests only. Creates a fresh in-memory database. */
export function _initTestDatabase(): void {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  createSchema(db);
  runMigrations(db);
}

export function getSession(chatId: string, agentId = 'main'): string | undefined {
  const row = db
    .prepare('SELECT session_id FROM sessions WHERE chat_id = ? AND agent_id = ?')
    .get(chatId, agentId) as { session_id: string } | undefined;
  return row?.session_id;
}

export function setSession(chatId: string, sessionId: string, agentId = 'main'): void {
  // Delete any existing row for this chat+agent combo, then insert fresh
  db.prepare('DELETE FROM sessions WHERE chat_id = ? AND agent_id = ?').run(chatId, agentId);
  db.prepare(
    'INSERT INTO sessions (chat_id, session_id, updated_at, agent_id) VALUES (?, ?, ?, ?)',
  ).run(chatId, sessionId, new Date().toISOString(), agentId);
}

export function clearSession(chatId: string, agentId = 'main'): void {
  db.prepare('DELETE FROM sessions WHERE chat_id = ? AND agent_id = ?').run(chatId, agentId);
}

// ── Memory ──────────────────────────────────────────────────────────

export interface Memory {
  id: number;
  chat_id: string;
  topic_key: string | null;
  content: string;
  sector: string;
  salience: number;
  created_at: number;
  accessed_at: number;
}

export function saveMemory(
  chatId: string,
  content: string,
  sector = 'semantic',
  topicKey?: string,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO memories (chat_id, content, sector, topic_key, created_at, accessed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(chatId, content, sector, topicKey ?? null, now, now);
}

export function searchMemories(
  chatId: string,
  query: string,
  limit = 3,
): Memory[] {
  // Sanitize for FTS5: strip special chars, add * for prefix matching
  const sanitized = query
    .replace(/[""]/g, '"')
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(' ');

  if (!sanitized) return [];

  return db
    .prepare(
      `SELECT memories.* FROM memories
       JOIN memories_fts ON memories.id = memories_fts.rowid
       WHERE memories_fts MATCH ? AND memories.chat_id = ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(sanitized, chatId, limit) as Memory[];
}

export function getRecentMemories(chatId: string, limit = 5): Memory[] {
  return db
    .prepare(
      'SELECT * FROM memories WHERE chat_id = ? ORDER BY accessed_at DESC LIMIT ?',
    )
    .all(chatId, limit) as Memory[];
}

export function touchMemory(id: number): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'UPDATE memories SET accessed_at = ?, salience = MIN(salience + 0.1, 5.0) WHERE id = ?',
  ).run(now, id);
}

export function decayMemories(): void {
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
  db.prepare(
    'UPDATE memories SET salience = salience * 0.98 WHERE created_at < ?',
  ).run(oneDayAgo);
  db.prepare('DELETE FROM memories WHERE salience < 0.1').run();
}

// ── Scheduled Tasks ──────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string;
  next_run: number;
  last_run: number | null;
  last_result: string | null;
  status: 'active' | 'paused';
  created_at: number;
}

export function createScheduledTask(
  id: string,
  prompt: string,
  schedule: string,
  nextRun: number,
  agentId = 'main',
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO scheduled_tasks (id, prompt, schedule, next_run, status, created_at, agent_id)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  ).run(id, prompt, schedule, nextRun, now, agentId);
}

export function getDueTasks(agentId = 'main'): ScheduledTask[] {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ? AND agent_id = ? ORDER BY next_run`,
    )
    .all(now, agentId) as ScheduledTask[];
}

export function getAllScheduledTasks(agentId?: string): ScheduledTask[] {
  if (agentId) {
    return db
      .prepare('SELECT * FROM scheduled_tasks WHERE agent_id = ? ORDER BY created_at DESC')
      .all(agentId) as ScheduledTask[];
  }
  return db
    .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
    .all() as ScheduledTask[];
}

export function updateTaskAfterRun(
  id: string,
  nextRun: number,
  result: string,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE scheduled_tasks SET last_run = ?, next_run = ?, last_result = ? WHERE id = ?`,
  ).run(now, nextRun, result.slice(0, 500), id);
}

export function deleteScheduledTask(id: string): void {
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
}

export function pauseScheduledTask(id: string): void {
  db.prepare(`UPDATE scheduled_tasks SET status = 'paused' WHERE id = ?`).run(id);
}

export function resumeScheduledTask(id: string): void {
  db.prepare(`UPDATE scheduled_tasks SET status = 'active' WHERE id = ?`).run(id);
}

// ── WhatsApp message map ──────────────────────────────────────────────

export function saveWaMessageMap(telegramMsgId: number, waChatId: string, contactName: string): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT OR REPLACE INTO wa_message_map (telegram_msg_id, wa_chat_id, contact_name, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(telegramMsgId, waChatId, contactName, now);
}

export function lookupWaChatId(telegramMsgId: number): { waChatId: string; contactName: string } | null {
  const row = db
    .prepare('SELECT wa_chat_id, contact_name FROM wa_message_map WHERE telegram_msg_id = ?')
    .get(telegramMsgId) as { wa_chat_id: string; contact_name: string } | undefined;
  if (!row) return null;
  return { waChatId: row.wa_chat_id, contactName: row.contact_name };
}

export function getRecentWaContacts(limit = 20): Array<{ waChatId: string; contactName: string; lastSeen: number }> {
  const rows = db.prepare(
    `SELECT wa_chat_id, contact_name, MAX(created_at) as lastSeen
     FROM wa_message_map
     GROUP BY wa_chat_id
     ORDER BY lastSeen DESC
     LIMIT ?`,
  ).all(limit) as Array<{ wa_chat_id: string; contact_name: string; lastSeen: number }>;
  return rows.map((r) => ({ waChatId: r.wa_chat_id, contactName: r.contact_name, lastSeen: r.lastSeen }));
}

// ── WhatsApp outbox ──────────────────────────────────────────────────

export interface WaOutboxItem {
  id: number;
  to_chat_id: string;
  body: string;
  created_at: number;
}

export function enqueueWaMessage(toChatId: string, body: string): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    `INSERT INTO wa_outbox (to_chat_id, body, created_at) VALUES (?, ?, ?)`,
  ).run(toChatId, body, now);
  return result.lastInsertRowid as number;
}

export function getPendingWaMessages(): WaOutboxItem[] {
  return db.prepare(
    `SELECT id, to_chat_id, body, created_at FROM wa_outbox WHERE sent_at IS NULL ORDER BY created_at`,
  ).all() as WaOutboxItem[];
}

export function markWaMessageSent(id: number): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE wa_outbox SET sent_at = ? WHERE id = ?`).run(now, id);
}

// ── WhatsApp messages ────────────────────────────────────────────────

// ── Conversation Log ──────────────────────────────────────────────────

export interface ConversationTurn {
  id: number;
  chat_id: string;
  session_id: string | null;
  role: string;
  content: string;
  created_at: number;
}

export function logConversationTurn(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string,
  agentId = 'main',
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO conversation_log (chat_id, session_id, role, content, created_at, agent_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(chatId, sessionId ?? null, role, content, now, agentId);
}

export function getRecentConversation(
  chatId: string,
  limit = 20,
): ConversationTurn[] {
  return db
    .prepare(
      `SELECT * FROM conversation_log WHERE chat_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as ConversationTurn[];
}

/**
 * Get a page of conversation turns for the dashboard chat overlay.
 * Returns turns in reverse chronological order (newest first).
 * Use `beforeId` for cursor-based pagination (load older messages).
 */
export function getConversationPage(
  chatId: string,
  limit = 40,
  beforeId?: number,
): ConversationTurn[] {
  if (beforeId) {
    return db
      .prepare(
        `SELECT * FROM conversation_log
         WHERE chat_id = ? AND id < ?
         ORDER BY id DESC LIMIT ?`,
      )
      .all(chatId, beforeId, limit) as ConversationTurn[];
  }
  return db
    .prepare(
      `SELECT * FROM conversation_log
       WHERE chat_id = ?
       ORDER BY id DESC LIMIT ?`,
    )
    .all(chatId, limit) as ConversationTurn[];
}

/**
 * Prune old conversation_log entries, keeping only the most recent N rows per chat.
 * Called alongside memory decay to prevent unbounded disk growth.
 */
export function pruneConversationLog(keepPerChat = 500): void {
  // Get distinct chat IDs
  const chats = db
    .prepare('SELECT DISTINCT chat_id FROM conversation_log')
    .all() as Array<{ chat_id: string }>;

  const deleteStmt = db.prepare(`
    DELETE FROM conversation_log
    WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM conversation_log
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `);

  for (const chat of chats) {
    deleteStmt.run(chat.chat_id, chat.chat_id, keepPerChat);
  }
}

// ── WhatsApp messages ────────────────────────────────────────────────

export function saveWaMessage(
  chatId: string,
  contactName: string,
  body: string,
  timestamp: number,
  isFromMe: boolean,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO wa_messages (chat_id, contact_name, body, timestamp, is_from_me, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(chatId, contactName, body, timestamp, isFromMe ? 1 : 0, now);
}

// ── Slack messages ────────────────────────────────────────────────

export function saveSlackMessage(
  channelId: string,
  channelName: string,
  userName: string,
  body: string,
  timestamp: string,
  isFromMe: boolean,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO slack_messages (channel_id, channel_name, user_name, body, timestamp, is_from_me, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(channelId, channelName, userName, body, timestamp, isFromMe ? 1 : 0, now);
}

export interface SlackMessageRow {
  id: number;
  channel_id: string;
  channel_name: string;
  user_name: string;
  body: string;
  timestamp: string;
  is_from_me: number;
  created_at: number;
}

export function getRecentSlackMessages(channelId: string, limit = 20): SlackMessageRow[] {
  return db
    .prepare(
      `SELECT * FROM slack_messages WHERE channel_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(channelId, limit) as SlackMessageRow[];
}

// ── Token Usage ──────────────────────────────────────────────────────

export function saveTokenUsage(
  chatId: string,
  sessionId: string | undefined,
  inputTokens: number,
  outputTokens: number,
  cacheRead: number,
  contextTokens: number,
  costUsd: number,
  didCompact: boolean,
  agentId = 'main',
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO token_usage (chat_id, session_id, input_tokens, output_tokens, cache_read, context_tokens, cost_usd, did_compact, created_at, agent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(chatId, sessionId ?? null, inputTokens, outputTokens, cacheRead, contextTokens, costUsd, didCompact ? 1 : 0, now, agentId);
}

export interface SessionTokenSummary {
  turns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastCacheRead: number;
  lastContextTokens: number;
  totalCostUsd: number;
  compactions: number;
  firstTurnAt: number;
  lastTurnAt: number;
}

// ── Dashboard Queries ──────────────────────────────────────────────────

export interface DashboardMemoryStats {
  total: number;
  semantic: number;
  episodic: number;
  avgSalience: number;
  salienceDistribution: { bucket: string; count: number }[];
}

export function getDashboardMemoryStats(chatId: string): DashboardMemoryStats {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN sector = 'semantic' THEN 1 ELSE 0 END) as semantic,
         SUM(CASE WHEN sector = 'episodic' THEN 1 ELSE 0 END) as episodic,
         AVG(salience) as avgSalience
       FROM memories WHERE chat_id = ?`,
    )
    .get(chatId) as { total: number; semantic: number; episodic: number; avgSalience: number | null };

  const buckets = db
    .prepare(
      `SELECT
         CASE
           WHEN salience < 0.5 THEN '0-0.5'
           WHEN salience < 1.0 THEN '0.5-1'
           WHEN salience < 2.0 THEN '1-2'
           WHEN salience < 3.0 THEN '2-3'
           WHEN salience < 4.0 THEN '3-4'
           ELSE '4-5'
         END as bucket,
         COUNT(*) as count
       FROM memories WHERE chat_id = ?
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(chatId) as { bucket: string; count: number }[];

  return {
    total: counts.total,
    semantic: counts.semantic,
    episodic: counts.episodic,
    avgSalience: counts.avgSalience ?? 0,
    salienceDistribution: buckets,
  };
}

export function getDashboardLowSalienceMemories(chatId: string, limit = 10): Memory[] {
  return db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ? AND salience < 0.5
       ORDER BY salience ASC LIMIT ?`,
    )
    .all(chatId, limit) as Memory[];
}

export function getDashboardTopAccessedMemories(chatId: string, limit = 5): Memory[] {
  return db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ?
       ORDER BY salience DESC LIMIT ?`,
    )
    .all(chatId, limit) as Memory[];
}

export function getDashboardMemoryTimeline(chatId: string, days = 30): { date: string; semantic: number; episodic: number }[] {
  return db
    .prepare(
      `SELECT
         date(created_at, 'unixepoch') as date,
         SUM(CASE WHEN sector = 'semantic' THEN 1 ELSE 0 END) as semantic,
         SUM(CASE WHEN sector = 'episodic' THEN 1 ELSE 0 END) as episodic
       FROM memories
       WHERE chat_id = ? AND created_at >= unixepoch('now', ?)
       GROUP BY date
       ORDER BY date`,
    )
    .all(chatId, `-${days} days`) as { date: string; semantic: number; episodic: number }[];
}

export interface DashboardTokenStats {
  todayInput: number;
  todayOutput: number;
  todayCost: number;
  todayTurns: number;
  allTimeCost: number;
  allTimeTurns: number;
}

export function getDashboardTokenStats(chatId: string): DashboardTokenStats {
  const today = db
    .prepare(
      `SELECT
         COALESCE(SUM(input_tokens), 0) as todayInput,
         COALESCE(SUM(output_tokens), 0) as todayOutput,
         COALESCE(SUM(cost_usd), 0) as todayCost,
         COUNT(*) as todayTurns
       FROM token_usage
       WHERE chat_id = ? AND created_at >= unixepoch('now', 'start of day')`,
    )
    .get(chatId) as { todayInput: number; todayOutput: number; todayCost: number; todayTurns: number };

  const allTime = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_usd), 0) as allTimeCost,
         COUNT(*) as allTimeTurns
       FROM token_usage WHERE chat_id = ?`,
    )
    .get(chatId) as { allTimeCost: number; allTimeTurns: number };

  return { ...today, ...allTime };
}

export function getDashboardCostTimeline(chatId: string, days = 30): { date: string; cost: number; turns: number }[] {
  return db
    .prepare(
      `SELECT
         date(created_at, 'unixepoch') as date,
         SUM(cost_usd) as cost,
         COUNT(*) as turns
       FROM token_usage
       WHERE chat_id = ? AND created_at >= unixepoch('now', ?)
       GROUP BY date
       ORDER BY date`,
    )
    .all(chatId, `-${days} days`) as { date: string; cost: number; turns: number }[];
}

export interface RecentTokenUsageRow {
  id: number;
  chat_id: string;
  session_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  context_tokens: number;
  cost_usd: number;
  did_compact: number;
  created_at: number;
}

export function getDashboardRecentTokenUsage(chatId: string, limit = 20): RecentTokenUsageRow[] {
  return db
    .prepare(
      `SELECT * FROM token_usage WHERE chat_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as RecentTokenUsageRow[];
}

export function getDashboardMemoriesBySector(chatId: string, sector: string, limit = 50, offset = 0): { memories: Memory[]; total: number } {
  const total = db
    .prepare('SELECT COUNT(*) as cnt FROM memories WHERE chat_id = ? AND sector = ?')
    .get(chatId, sector) as { cnt: number };
  const memories = db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ? AND sector = ?
       ORDER BY salience DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(chatId, sector, limit, offset) as Memory[];
  return { memories, total: total.cnt };
}

// ── Hive Mind ──────────────────────────────────────────────────────

export interface HiveMindEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  summary: string;
  artifacts: string | null;
  created_at: number;
}

export function logToHiveMind(
  agentId: string,
  chatId: string,
  action: string,
  summary: string,
  artifacts?: string,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO hive_mind (agent_id, chat_id, action, summary, artifacts, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(agentId, chatId, action, summary, artifacts ?? null, now);
}

export function getHiveMindEntries(limit = 20, agentId?: string): HiveMindEntry[] {
  if (agentId) {
    return db
      .prepare('SELECT * FROM hive_mind WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(agentId, limit) as HiveMindEntry[];
  }
  return db
    .prepare('SELECT * FROM hive_mind ORDER BY created_at DESC LIMIT ?')
    .all(limit) as HiveMindEntry[];
}

export function getAgentTokenStats(agentId: string): { todayCost: number; todayTurns: number; allTimeCost: number } {
  const today = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) as todayCost, COUNT(*) as todayTurns
       FROM token_usage
       WHERE agent_id = ? AND created_at >= unixepoch('now', 'start of day')`,
    )
    .get(agentId) as { todayCost: number; todayTurns: number };

  const allTime = db
    .prepare('SELECT COALESCE(SUM(cost_usd), 0) as allTimeCost FROM token_usage WHERE agent_id = ?')
    .get(agentId) as { allTimeCost: number };

  return { ...today, allTimeCost: allTime.allTimeCost };
}

export function getSessionTokenUsage(sessionId: string): SessionTokenSummary | null {
  const row = db
    .prepare(
      `SELECT
         COUNT(*)           as turns,
         SUM(input_tokens)  as totalInputTokens,
         SUM(output_tokens) as totalOutputTokens,
         SUM(cost_usd)      as totalCostUsd,
         SUM(did_compact)   as compactions,
         MIN(created_at)    as firstTurnAt,
         MAX(created_at)    as lastTurnAt
       FROM token_usage WHERE session_id = ?`,
    )
    .get(sessionId) as {
      turns: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCostUsd: number;
      compactions: number;
      firstTurnAt: number;
      lastTurnAt: number;
    } | undefined;

  if (!row || row.turns === 0) return null;

  // Get the most recent turn's context_tokens (actual context window size from last API call)
  // Falls back to cache_read for backward compat with rows before the migration
  const lastRow = db
    .prepare(
      `SELECT cache_read, context_tokens FROM token_usage
       WHERE session_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(sessionId) as { cache_read: number; context_tokens: number } | undefined;

  return {
    turns: row.turns,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    lastCacheRead: lastRow?.cache_read ?? 0,
    lastContextTokens: lastRow?.context_tokens ?? lastRow?.cache_read ?? 0,
    totalCostUsd: row.totalCostUsd,
    compactions: row.compactions,
    firstTurnAt: row.firstTurnAt,
    lastTurnAt: row.lastTurnAt,
  };
}
