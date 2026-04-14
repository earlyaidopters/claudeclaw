import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { DB_ENCRYPTION_KEY, STORE_DIR } from './config.js';
import { cosineSimilarity } from './embeddings.js';
import { logger } from './logger.js';

// ── Field-Level Encryption (AES-256-GCM) ────────────────────────────
// All message bodies (WhatsApp, Slack) are encrypted before storage
// and decrypted on read. The key lives in .env (DB_ENCRYPTION_KEY).

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  const hex = DB_ENCRYPTION_KEY;
  if (!hex || hex.length < 32) {
    throw new Error(
      'DB_ENCRYPTION_KEY is missing or too short. Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" and add to .env',
    );
  }
  encryptionKey = Buffer.from(hex, 'hex');
  return encryptionKey;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a compact string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string produced by encryptField().
 * Returns the original plaintext. If decryption fails (wrong key, tampered),
 * returns the raw input unchanged (graceful fallback for pre-encryption data).
 */
export function decryptField(ciphertext: string): string {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext; // Not encrypted, return as-is
    const [ivHex, authTagHex, dataHex] = parts;
    if (!ivHex || !authTagHex || !dataHex) return ciphertext;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Decryption failed: probably pre-encryption plaintext data
    return ciphertext;
  }
}

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
      chat_id    TEXT NOT NULL,
      agent_id   TEXT NOT NULL DEFAULT 'main',
      session_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (chat_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       TEXT NOT NULL,
      source        TEXT NOT NULL DEFAULT 'conversation',
      raw_text      TEXT NOT NULL,
      summary       TEXT NOT NULL,
      entities      TEXT NOT NULL DEFAULT '[]',
      topics        TEXT NOT NULL DEFAULT '[]',
      connections   TEXT NOT NULL DEFAULT '[]',
      importance    REAL NOT NULL DEFAULT 0.5,
      salience      REAL NOT NULL DEFAULT 1.0,
      consolidated  INTEGER NOT NULL DEFAULT 0,
      embedding     TEXT,
      created_at    INTEGER NOT NULL,
      accessed_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_chat ON memories(chat_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS consolidations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       TEXT NOT NULL,
      source_ids    TEXT NOT NULL,
      summary       TEXT NOT NULL,
      insight       TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_consolidations_chat ON consolidations(chat_id, created_at DESC);

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

    CREATE TABLE IF NOT EXISTS inter_agent_tasks (
      id            TEXT PRIMARY KEY,
      from_agent    TEXT NOT NULL,
      to_agent      TEXT NOT NULL,
      chat_id       TEXT NOT NULL,
      prompt        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      result        TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inter_agent_tasks_status ON inter_agent_tasks(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS mission_tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      prompt          TEXT NOT NULL,
      assigned_agent  TEXT,
      status          TEXT NOT NULL DEFAULT 'queued',
      result          TEXT,
      error           TEXT,
      created_by      TEXT NOT NULL DEFAULT 'dashboard',
      priority        INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      started_at      INTEGER,
      completed_at    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_mission_status
      ON mission_tasks(assigned_agent, status, priority DESC, created_at ASC);

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id    TEXT NOT NULL DEFAULT 'main',
      chat_id     TEXT NOT NULL DEFAULT '',
      action      TEXT NOT NULL,
      detail      TEXT NOT NULL DEFAULT '',
      blocked     INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_id, created_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      summary,
      raw_text,
      entities,
      topics,
      content=memories,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, summary, raw_text, entities, topics)
        VALUES (new.id, new.summary, new.raw_text, new.entities, new.topics);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text, entities, topics)
        VALUES ('delete', old.id, old.summary, old.raw_text, old.entities, old.topics);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text, entities, topics)
        VALUES ('delete', old.id, old.summary, old.raw_text, old.entities, old.topics);
      INSERT INTO memories_fts(rowid, summary, raw_text, entities, topics)
        VALUES (new.id, new.summary, new.raw_text, new.entities, new.topics);
    END;
  `);
}

export function initDatabase(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const dbPath = path.join(STORE_DIR, 'claudeclaw.db');

  // Validate encryption key is available before proceeding
  getEncryptionKey();

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  createSchema(db);
  runMigrations(db);

  // Restrict database file permissions (owner-only read/write)
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      const f = dbPath + suffix;
      if (fs.existsSync(f)) fs.chmodSync(f, 0o600);
    }
    fs.chmodSync(STORE_DIR, 0o700);
  } catch { /* non-fatal on platforms that don't support chmod */ }
}

/** Add columns that may not exist in older databases. */
function runMigrations(database: Database.Database): void {
  // Add context_tokens column to token_usage (introduced for accurate context tracking)
  const cols = database.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>;
  const hasContextTokens = cols.some((c) => c.name === 'context_tokens');
  if (!hasContextTokens) {
    database.exec(`ALTER TABLE token_usage ADD COLUMN context_tokens INTEGER NOT NULL DEFAULT 0`);
  }

  // Multi-agent: migrate sessions table to composite primary key (chat_id, agent_id)
  // Check if PK is composite by looking at pk column count in pragma
  const sessionCols = database.prepare(`PRAGMA table_info(sessions)`).all() as Array<{ name: string; pk: number }>;
  const pkCount = sessionCols.filter((c) => c.pk > 0).length;
  if (pkCount < 2) {
    // Need to recreate table with composite PK
    database.exec(`
      CREATE TABLE sessions_new (
        chat_id    TEXT NOT NULL,
        agent_id   TEXT NOT NULL DEFAULT 'main',
        session_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (chat_id, agent_id)
      );
      INSERT OR IGNORE INTO sessions_new (chat_id, agent_id, session_id, updated_at)
        SELECT chat_id, COALESCE(agent_id, 'main'), session_id, updated_at FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;
    `);
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

  // Task state machine: add started_at and last_status columns
  const taskColNames = taskCols.map((c) => c.name);
  if (!taskColNames.includes('started_at')) {
    database.exec(`ALTER TABLE scheduled_tasks ADD COLUMN started_at INTEGER`);
  }
  if (!taskColNames.includes('last_status')) {
    database.exec(`ALTER TABLE scheduled_tasks ADD COLUMN last_status TEXT`);
  }

  // ── Memory V2 migration ──────────────────────────────────────────────
  // Detect old schema (has 'sector' column but no 'importance') and migrate.
  const memCols = database.prepare(`PRAGMA table_info(memories)`).all() as Array<{ name: string }>;
  const memColNames = memCols.map((c) => c.name);
  const isOldSchema = memColNames.includes('sector') && !memColNames.includes('importance');

  if (isOldSchema) {
    database.exec(`
      -- Drop old FTS triggers first
      DROP TRIGGER IF EXISTS memories_fts_insert;
      DROP TRIGGER IF EXISTS memories_fts_delete;
      DROP TRIGGER IF EXISTS memories_fts_update;

      -- Drop old FTS table
      DROP TABLE IF EXISTS memories_fts;

      -- Drop old indexes (they'll conflict with new table's indexes)
      DROP INDEX IF EXISTS idx_memories_chat;
      DROP INDEX IF EXISTS idx_memories_sector;

      -- Backup old memories table
      ALTER TABLE memories RENAME TO memories_v1_backup;

      -- Create new memories table
      CREATE TABLE memories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id       TEXT NOT NULL,
        source        TEXT NOT NULL DEFAULT 'conversation',
        raw_text      TEXT NOT NULL,
        summary       TEXT NOT NULL,
        entities      TEXT NOT NULL DEFAULT '[]',
        topics        TEXT NOT NULL DEFAULT '[]',
        connections   TEXT NOT NULL DEFAULT '[]',
        importance    REAL NOT NULL DEFAULT 0.5,
        salience      REAL NOT NULL DEFAULT 1.0,
        consolidated  INTEGER NOT NULL DEFAULT 0,
        embedding     TEXT,
        created_at    INTEGER NOT NULL,
        accessed_at   INTEGER NOT NULL
      );

      CREATE INDEX idx_memories_chat ON memories(chat_id, created_at DESC);
      CREATE INDEX idx_memories_importance ON memories(chat_id, importance DESC);
      CREATE INDEX idx_memories_unconsolidated ON memories(chat_id, consolidated);

      -- Create consolidations table
      CREATE TABLE IF NOT EXISTS consolidations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id       TEXT NOT NULL,
        source_ids    TEXT NOT NULL,
        summary       TEXT NOT NULL,
        insight       TEXT NOT NULL,
        created_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_consolidations_chat ON consolidations(chat_id, created_at DESC);

      -- Create new FTS table
      CREATE VIRTUAL TABLE memories_fts USING fts5(
        summary,
        raw_text,
        entities,
        topics,
        content=memories,
        content_rowid=id
      );

      -- Create new triggers
      CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, summary, raw_text, entities, topics)
          VALUES (new.id, new.summary, new.raw_text, new.entities, new.topics);
      END;

      CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text, entities, topics)
          VALUES ('delete', old.id, old.summary, old.raw_text, old.entities, old.topics);
      END;

      CREATE TRIGGER memories_fts_update AFTER UPDATE OF summary, raw_text, entities, topics ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text, entities, topics)
          VALUES ('delete', old.id, old.summary, old.raw_text, old.entities, old.topics);
        INSERT INTO memories_fts(rowid, summary, raw_text, entities, topics)
          VALUES (new.id, new.summary, new.raw_text, new.entities, new.topics);
      END;
    `);
    logger.info('Memory V2 migration: backed up old memories, created new schema');
  }

  // Ensure memory V2 indexes exist (covers both migrated and fresh installs)
  const memColsPost = database.prepare(`PRAGMA table_info(memories)`).all() as Array<{ name: string }>;
  if (memColsPost.some((c) => c.name === 'importance')) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(chat_id, importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_unconsolidated ON memories(chat_id, consolidated);
    `);
  }

  // Add embedding column if missing (V2 tables created before embedding support)
  if (memColsPost.some((c) => c.name === 'importance') && !memColsPost.some((c) => c.name === 'embedding')) {
    database.exec(`ALTER TABLE memories ADD COLUMN embedding TEXT`);
    logger.info('Migration: added embedding column to memories table');
  }

  // Hive Mind V2: Add agent_id to memories for attribution
  if (!memColsPost.some((c: { name: string }) => c.name === 'agent_id')) {
    database.exec(`ALTER TABLE memories ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'`);
    logger.info('Migration: added agent_id column to memories table');
  }

  // Hive Mind V2: Add embedding + model tracking to consolidations
  const consolCols = database.prepare('PRAGMA table_info(consolidations)').all() as Array<{ name: string }>;
  if (!consolCols.some((c) => c.name === 'embedding')) {
    database.exec(`ALTER TABLE consolidations ADD COLUMN embedding TEXT`);
    logger.info('Migration: added embedding column to consolidations table');
  }
  if (!consolCols.some((c) => c.name === 'embedding_model')) {
    database.exec(`ALTER TABLE consolidations ADD COLUMN embedding_model TEXT DEFAULT 'embedding-001'`);
  }

  // Add embedding_model to memories too (future-proofing)
  if (!memColsPost.some((c: { name: string }) => c.name === 'embedding_model')) {
    database.exec(`ALTER TABLE memories ADD COLUMN embedding_model TEXT DEFAULT 'embedding-001'`);
  }

  // Hive Mind V2: Fix FTS5 update trigger to only fire on content column changes.
  // The old trigger fires on every UPDATE (including salience/importance-only changes),
  // causing massive write amplification during decay sweeps.
  const triggerCheck = database.prepare(
    `SELECT sql FROM sqlite_master WHERE type='trigger' AND name='memories_fts_update'`,
  ).get() as { sql: string } | undefined;
  if (triggerCheck?.sql && !triggerCheck.sql.includes('UPDATE OF')) {
    database.exec(`
      DROP TRIGGER IF EXISTS memories_fts_update;
      CREATE TRIGGER memories_fts_update AFTER UPDATE OF summary, raw_text, entities, topics ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text, entities, topics)
          VALUES ('delete', old.id, old.summary, old.raw_text, old.entities, old.topics);
        INSERT INTO memories_fts(rowid, summary, raw_text, entities, topics)
          VALUES (new.id, new.summary, new.raw_text, new.entities, new.topics);
      END;
    `);
    logger.info('Migration: restricted FTS5 update trigger to content columns only');
  }

  // Hive Mind V2: Add superseded_by for contradiction resolution
  if (!memColsPost.some((c: { name: string }) => c.name === 'superseded_by')) {
    database.exec(`ALTER TABLE memories ADD COLUMN superseded_by INTEGER REFERENCES memories(id)`);
    logger.info('Migration: added superseded_by column to memories table');
  }

  // Hive Mind V2: Add pinned flag for permanent memories that never decay.
  // Memories are only pinned explicitly by the user ("remember this permanently")
  // or via /pin command. No auto-pinning: the user controls what's permanent.
  if (!memColsPost.some((c: { name: string }) => c.name === 'pinned')) {
    database.exec(`ALTER TABLE memories ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
    logger.info('Migration: added pinned column to memories table');
  }

  // Mission Control: migrate assigned_agent from NOT NULL to nullable (allow unassigned tasks)
  const missionCols = database.prepare(`PRAGMA table_info(mission_tasks)`).all() as Array<{ name: string; notnull: number }>;
  const assignedCol = missionCols.find((c) => c.name === 'assigned_agent');
  if (assignedCol && assignedCol.notnull === 1) {
    database.exec(`
      CREATE TABLE mission_tasks_new (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, prompt TEXT NOT NULL,
        assigned_agent TEXT, status TEXT NOT NULL DEFAULT 'queued',
        result TEXT, error TEXT, created_by TEXT NOT NULL DEFAULT 'dashboard',
        priority INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
        started_at INTEGER, completed_at INTEGER
      );
      INSERT INTO mission_tasks_new SELECT * FROM mission_tasks;
      DROP TABLE mission_tasks;
      ALTER TABLE mission_tasks_new RENAME TO mission_tasks;
      CREATE INDEX IF NOT EXISTS idx_mission_status
        ON mission_tasks(assigned_agent, status, priority DESC, created_at ASC);
    `);
    logger.info('Migration: made mission_tasks.assigned_agent nullable');
  }
}

/** @internal - for tests only. Creates a fresh in-memory database. */
export function _initTestDatabase(): void {
  // Use a test encryption key for field-level encryption
  encryptionKey = crypto.randomBytes(32);
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
  db.prepare(
    'INSERT OR REPLACE INTO sessions (chat_id, agent_id, session_id, updated_at) VALUES (?, ?, ?, ?)',
  ).run(chatId, agentId, sessionId, new Date().toISOString());
}

export function clearSession(chatId: string, agentId = 'main'): void {
  db.prepare('DELETE FROM sessions WHERE chat_id = ? AND agent_id = ?').run(chatId, agentId);
}

// ── Memory (V2: structured with LLM extraction) ────────────────────

export interface Memory {
  id: number;
  chat_id: string;
  source: string;
  agent_id: string;
  raw_text: string;
  summary: string;
  entities: string;    // JSON array
  topics: string;      // JSON array
  connections: string; // JSON array
  importance: number;
  salience: number;
  consolidated: number;
  pinned: number;      // 1 = permanent, never decays
  embedding: string | null; // JSON array of floats
  created_at: number;
  accessed_at: number;
}

export interface Consolidation {
  id: number;
  chat_id: string;
  source_ids: string;  // JSON array of memory IDs
  summary: string;
  insight: string;
  created_at: number;
  embedding?: string;
  embedding_model?: string;
}

export function saveStructuredMemory(
  chatId: string,
  rawText: string,
  summary: string,
  entities: string[],
  topics: string[],
  importance: number,
  source = 'conversation',
  agentId = 'main',
): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    `INSERT INTO memories (chat_id, source, raw_text, summary, entities, topics, importance, agent_id, created_at, accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    chatId,
    source,
    rawText,
    summary,
    JSON.stringify(entities),
    JSON.stringify(topics),
    importance,
    agentId,
    now,
    now,
  );
  return result.lastInsertRowid as number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'it', 'its', 'my', 'me', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'i', 'up',
  'down', 'get', 'got', 'like', 'make', 'know', 'think', 'take',
  'come', 'go', 'see', 'look', 'find', 'give', 'tell', 'say',
  'much', 'many', 'well', 'also', 'back', 'use', 'way',
  'feel', 'mark', 'marks', 'does', 'how',
]);

/**
 * Extract meaningful keywords from a query, stripping stop words and short tokens.
 */
function extractKeywords(query: string): string[] {
  return query
    .replace(/[""]/g, '"')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Search memories using embedding similarity (primary) with FTS5/LIKE fallback.
 * The queryEmbedding parameter is optional; if provided, vector search is used first.
 * If not provided (or no embeddings in DB), falls back to keyword search.
 */
export function searchMemories(
  chatId: string,
  query: string,
  limit = 5,
  queryEmbedding?: number[],
): Memory[] {
  // Strategy 1: Vector similarity search (if embedding provided)
  if (queryEmbedding && queryEmbedding.length > 0) {
    const candidates = getMemoriesWithEmbeddings(chatId);
    if (candidates.length > 0) {
      const scored = candidates
        .map((c) => ({ id: c.id, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .filter((s) => s.score > 0.3) // minimum similarity threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length > 0) {
        const ids = scored.map((s) => s.id);
        const placeholders = ids.map(() => '?').join(',');
        const rows = db
          .prepare(`SELECT * FROM memories WHERE id IN (${placeholders}) AND superseded_by IS NULL`)
          .all(...ids) as Memory[];
        // Preserve similarity-score ordering (SQL IN doesn't guarantee order)
        const rowMap = new Map(rows.map((r) => [r.id, r]));
        return ids.map((id) => rowMap.get(id)).filter(Boolean) as Memory[];
      }
    }
  }

  // Strategy 2: FTS5 keyword search with OR
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const ftsQuery = keywords.map((w) => `"${w}"*`).join(' OR ');
  let results = db
    .prepare(
      `SELECT memories.* FROM memories
       JOIN memories_fts ON memories.id = memories_fts.rowid
       WHERE memories_fts MATCH ? AND memories.chat_id = ? AND memories.superseded_by IS NULL
       ORDER BY rank
       LIMIT ?`,
    )
    .all(ftsQuery, chatId, limit) as Memory[];

  if (results.length > 0) return results;

  // Strategy 3: LIKE fallback on summary + entities + topics
  const likeConditions = keywords.map(() =>
    `(summary LIKE ? OR entities LIKE ? OR topics LIKE ? OR raw_text LIKE ?)`,
  ).join(' OR ');
  const likeParams: string[] = [];
  for (const kw of keywords) {
    const pattern = `%${kw}%`;
    likeParams.push(pattern, pattern, pattern, pattern);
  }

  results = db
    .prepare(
      `SELECT * FROM memories
       WHERE chat_id = ? AND superseded_by IS NULL AND (${likeConditions})
       ORDER BY importance DESC, accessed_at DESC
       LIMIT ?`,
    )
    .all(chatId, ...likeParams, limit) as Memory[];

  return results;
}

export function saveMemoryEmbedding(memoryId: number, embedding: number[]): void {
  db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(JSON.stringify(embedding), memoryId);
}

export function getMemoriesWithEmbeddings(chatId: string): Array<{ id: number; embedding: number[]; summary: string; importance: number }> {
  const rows = db
    .prepare('SELECT id, embedding, summary, importance FROM memories WHERE chat_id = ? AND embedding IS NOT NULL AND superseded_by IS NULL')
    .all(chatId) as Array<{ id: number; embedding: string; summary: string; importance: number }>;
  return rows.map((r) => ({
    id: r.id,
    embedding: JSON.parse(r.embedding) as number[],
    summary: r.summary,
    importance: r.importance,
  }));
}

export function getRecentHighImportanceMemories(chatId: string, limit = 5): Memory[] {
  return db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ? AND importance >= 0.5
       ORDER BY accessed_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as Memory[];
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

export function penalizeMemory(memoryId: number): void {
  db.prepare(
    `UPDATE memories SET salience = MAX(0.05, salience - 0.05) WHERE id = ?`,
  ).run(memoryId);
}

/**
 * Batch-update salience for multiple memories in a single transaction.
 * Reduces SQLite lock contention when multiple agents finish concurrently.
 */
export function batchUpdateMemoryRelevance(
  allIds: number[],
  usefulIds: Set<number>,
): void {
  const txn = db.transaction(() => {
    for (const id of allIds) {
      if (usefulIds.has(id)) {
        touchMemory(id);
      } else {
        penalizeMemory(id);
      }
    }
  });
  txn();
}

/**
 * Importance-weighted decay. High-importance memories decay slower.
 * Pinned memories are exempt from decay entirely.
 * - pinned:             no decay (permanent)
 * - importance >= 0.8:  1% per day (retains ~460 days)
 * - importance >= 0.5:  2% per day (retains ~230 days)
 * - importance < 0.5:   5% per day (retains ~90 days)
 */
export function decayMemories(): void {
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
  db.prepare(`
    UPDATE memories SET salience = salience * CASE
      WHEN importance >= 0.8 THEN 0.99
      WHEN importance >= 0.5 THEN 0.98
      ELSE 0.95
    END
    WHERE created_at < ? AND pinned = 0
  `).run(oneDayAgo);
  db.prepare('DELETE FROM memories WHERE salience < 0.05 AND pinned = 0').run();
}

export function pinMemory(memoryId: number): void {
  db.prepare('UPDATE memories SET pinned = 1 WHERE id = ?').run(memoryId);
}

export function unpinMemory(memoryId: number): void {
  db.prepare('UPDATE memories SET pinned = 0 WHERE id = ?').run(memoryId);
}

// ── Consolidation CRUD ──────────────────────────────────────────────

export function getUnconsolidatedMemories(chatId: string, limit = 20): Memory[] {
  return db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ? AND consolidated = 0
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as Memory[];
}

export function saveConsolidation(
  chatId: string,
  sourceIds: number[],
  summary: string,
  insight: string,
): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    `INSERT INTO consolidations (chat_id, source_ids, summary, insight, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(chatId, JSON.stringify(sourceIds), summary, insight, now);
  return result.lastInsertRowid as number;
}

export function saveConsolidationEmbedding(consolidationId: number, embedding: number[]): void {
  db.prepare('UPDATE consolidations SET embedding = ?, embedding_model = ? WHERE id = ?')
    .run(JSON.stringify(embedding), 'embedding-001', consolidationId);
}

export function getConsolidationsWithEmbeddings(chatId: string): Array<{ id: number; embedding: number[]; summary: string; insight: string }> {
  const rows = db
    .prepare('SELECT id, embedding, summary, insight FROM consolidations WHERE chat_id = ? AND embedding IS NOT NULL AND embedding_model = ?')
    .all(chatId, 'embedding-001') as Array<{ id: number; embedding: string; summary: string; insight: string }>;
  return rows.map((r) => ({ ...r, embedding: JSON.parse(r.embedding) as number[] }));
}

export function supersedeMemory(oldId: number, newId: number): void {
  db.prepare(
    `UPDATE memories SET superseded_by = ?, importance = importance * 0.3, salience = salience * 0.5 WHERE id = ?`,
  ).run(newId, oldId);
}

export function updateMemoryConnections(memoryId: number, connections: Array<{ linked_to: number; relationship: string }>): void {
  const row = db.prepare('SELECT connections FROM memories WHERE id = ?').get(memoryId) as { connections: string } | undefined;
  if (!row) return;
  const existing: Array<{ linked_to: number; relationship: string }> = JSON.parse(row.connections);
  const merged = [...existing, ...connections];
  // Deduplicate by linked_to to prevent unbounded growth on re-consolidation
  const seen = new Set<number>();
  const deduped = merged.filter((c) => {
    if (seen.has(c.linked_to)) return false;
    seen.add(c.linked_to);
    return true;
  });
  db.prepare('UPDATE memories SET connections = ? WHERE id = ?').run(JSON.stringify(deduped), memoryId);
}

export function markMemoriesConsolidated(ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE memories SET consolidated = 1 WHERE id IN (${placeholders})`).run(...ids);
}

export function getRecentConsolidations(chatId: string, limit = 5): Consolidation[] {
  return db
    .prepare(
      `SELECT * FROM consolidations WHERE chat_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as Consolidation[];
}

export function searchConsolidations(chatId: string, query: string, limit = 3): Consolidation[] {
  // Simple LIKE search on consolidation summaries and insights
  const pattern = `%${query.replace(/[%_]/g, '')}%`;
  return db
    .prepare(
      `SELECT * FROM consolidations
       WHERE chat_id = ? AND (summary LIKE ? OR insight LIKE ?)
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chatId, pattern, pattern, limit) as Consolidation[];
}

// ── Scheduled Tasks ──────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string;
  next_run: number;
  last_run: number | null;
  last_result: string | null;
  status: 'active' | 'paused' | 'running';
  created_at: number;
  agent_id: string;
  started_at: number | null;
  last_status: 'success' | 'failed' | 'timeout' | null;
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

/**
 * Mark a task as running and optionally advance its next_run to the next
 * scheduled occurrence. Advancing next_run immediately prevents the scheduler
 * from re-firing the same task on subsequent ticks while it is still executing
 * (double-fire bug), and survives process restarts since the value is persisted.
 */
export function markTaskRunning(id: string, tentativeNextRun?: number): void {
  const now = Math.floor(Date.now() / 1000);
  if (tentativeNextRun !== undefined) {
    db.prepare(
      `UPDATE scheduled_tasks SET status = 'running', started_at = ?, next_run = ? WHERE id = ?`,
    ).run(now, tentativeNextRun, id);
  } else {
    db.prepare(
      `UPDATE scheduled_tasks SET status = 'running', started_at = ? WHERE id = ?`,
    ).run(now, id);
  }
}

export function updateTaskAfterRun(
  id: string,
  nextRun: number,
  result: string,
  lastStatus: 'success' | 'failed' | 'timeout' = 'success',
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE scheduled_tasks SET status = 'active', last_run = ?, next_run = ?, last_result = ?, last_status = ?, started_at = NULL WHERE id = ?`,
  ).run(now, nextRun, result.slice(0, 4000), lastStatus, id);
}

export function resetStuckTasks(agentId: string): number {
  const result = db.prepare(
    `UPDATE scheduled_tasks SET status = 'active', started_at = NULL WHERE status = 'running' AND agent_id = ?`,
  ).run(agentId);
  return result.changes;
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

/**
 * Get recent scheduled task outputs for a given agent.
 * Used to inject context into the next user message so Claude knows
 * what was just shown to the user via a scheduled task.
 *
 * Returns tasks that ran in the last `withinMinutes` (default 30).
 */
export function getRecentTaskOutputs(
  agentId: string,
  withinMinutes = 30,
): Array<{ prompt: string; last_result: string; last_run: number }> {
  const cutoff = Math.floor(Date.now() / 1000) - withinMinutes * 60;
  return db
    .prepare(
      `SELECT prompt, last_result, last_run FROM scheduled_tasks
       WHERE agent_id = ? AND last_status = 'success' AND last_run > ?
       ORDER BY last_run DESC LIMIT 3`,
    )
    .all(agentId, cutoff) as Array<{ prompt: string; last_result: string; last_run: number }>;
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
  ).run(toChatId, encryptField(body), now);
  return result.lastInsertRowid as number;
}

export function getPendingWaMessages(): WaOutboxItem[] {
  const rows = db.prepare(
    `SELECT id, to_chat_id, body, created_at FROM wa_outbox WHERE sent_at IS NULL ORDER BY created_at`,
  ).all() as WaOutboxItem[];
  return rows.map((r) => ({ ...r, body: decryptField(r.body) }));
}

export function markWaMessageSent(id: number): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE wa_outbox SET sent_at = ? WHERE id = ?`).run(now, id);
}

// ── WhatsApp messages ────────────────────────────────────────────────

/**
 * Prune WhatsApp messages older than the given number of days.
 * Covers wa_messages, wa_outbox (sent only), and wa_message_map.
 */
export function pruneWaMessages(retentionDays = 3): { messages: number; outbox: number; map: number } {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;

  const msgResult = db.prepare(
    'DELETE FROM wa_messages WHERE created_at < ?',
  ).run(cutoff);

  const outboxResult = db.prepare(
    'DELETE FROM wa_outbox WHERE sent_at IS NOT NULL AND created_at < ?',
  ).run(cutoff);

  const mapResult = db.prepare(
    'DELETE FROM wa_message_map WHERE created_at < ?',
  ).run(cutoff);

  return {
    messages: msgResult.changes,
    outbox: outboxResult.changes,
    map: mapResult.changes,
  };
}

/**
 * Prune Slack messages older than the given number of days.
 */
export function pruneSlackMessages(retentionDays = 3): number {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const result = db.prepare(
    'DELETE FROM slack_messages WHERE created_at < ?',
  ).run(cutoff);
  return result.changes;
}

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
 * Search conversation_log by keywords. Used when the user asks about
 * past conversations ("remember when we...", "what did we talk about").
 * Returns recent turns that match any keyword, grouped chronologically.
 */
export function searchConversationHistory(
  chatId: string,
  query: string,
  agentId?: string,
  daysBack = 7,
  limit = 20,
): ConversationTurn[] {
  const cutoff = Math.floor(Date.now() / 1000) - (daysBack * 86400);
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 8);
  if (keywords.length === 0) return [];

  const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
  const params: (string | number)[] = [chatId, cutoff];
  for (const kw of keywords) {
    params.push(`%${kw}%`);
  }

  const agentFilter = agentId ? ' AND agent_id = ?' : '';
  if (agentId) params.push(agentId);

  return db
    .prepare(
      `SELECT * FROM conversation_log
       WHERE chat_id = ? AND created_at > ? AND (${conditions})${agentFilter}
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params, limit) as ConversationTurn[];
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
  ).run(chatId, contactName, encryptField(body), timestamp, isFromMe ? 1 : 0, now);
}

export interface WaMessageRow {
  id: number;
  chat_id: string;
  contact_name: string;
  body: string;
  timestamp: number;
  is_from_me: number;
  created_at: number;
}

export function getRecentWaMessages(chatId: string, limit = 20): WaMessageRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM wa_messages WHERE chat_id = ?
       ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(chatId, limit) as WaMessageRow[];
  return rows.map((r) => ({ ...r, body: decryptField(r.body) }));
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
  ).run(channelId, channelName, userName, encryptField(body), timestamp, isFromMe ? 1 : 0, now);
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
  const rows = db
    .prepare(
      `SELECT * FROM slack_messages WHERE channel_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(channelId, limit) as SlackMessageRow[];
  return rows.map((r) => ({ ...r, body: decryptField(r.body) }));
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
  pinned: number;
  consolidations: number;
  avgImportance: number;
  avgSalience: number;
  importanceDistribution: { bucket: string; count: number }[];
}

export function getDashboardMemoryStats(chatId: string): DashboardMemoryStats {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         AVG(importance) as avgImportance,
         AVG(salience) as avgSalience
       FROM memories WHERE chat_id = ?`,
    )
    .get(chatId) as { total: number; avgImportance: number | null; avgSalience: number | null };

  const consolidationCount = db
    .prepare('SELECT COUNT(*) as cnt FROM consolidations WHERE chat_id = ?')
    .get(chatId) as { cnt: number };

  const pinnedCount = db
    .prepare('SELECT COUNT(*) as cnt FROM memories WHERE chat_id = ? AND pinned = 1')
    .get(chatId) as { cnt: number };

  const buckets = db
    .prepare(
      `SELECT
         CASE
           WHEN importance < 0.2 THEN '0-0.2'
           WHEN importance < 0.4 THEN '0.2-0.4'
           WHEN importance < 0.6 THEN '0.4-0.6'
           WHEN importance < 0.8 THEN '0.6-0.8'
           ELSE '0.8-1.0'
         END as bucket,
         COUNT(*) as count
       FROM memories WHERE chat_id = ?
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(chatId) as { bucket: string; count: number }[];

  return {
    total: counts.total,
    pinned: pinnedCount.cnt,
    consolidations: consolidationCount.cnt,
    avgImportance: counts.avgImportance ?? 0,
    avgSalience: counts.avgSalience ?? 0,
    importanceDistribution: buckets,
  };
}

export function getDashboardPinnedMemories(chatId: string): Memory[] {
  return db
    .prepare('SELECT * FROM memories WHERE chat_id = ? AND pinned = 1 ORDER BY importance DESC')
    .all(chatId) as Memory[];
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
      `SELECT * FROM memories WHERE chat_id = ? AND importance >= 0.5
       ORDER BY accessed_at DESC LIMIT ?`,
    )
    .all(chatId, limit) as Memory[];
}

export function getDashboardMemoryTimeline(chatId: string, days = 30): { date: string; count: number }[] {
  return db
    .prepare(
      `SELECT
         date(created_at, 'unixepoch') as date,
         COUNT(*) as count
       FROM memories
       WHERE chat_id = ? AND created_at >= unixepoch('now', ?)
       GROUP BY date
       ORDER BY date`,
    )
    .all(chatId, `-${days} days`) as { date: string; count: number }[];
}

export function getDashboardConsolidations(chatId: string, limit = 5): Consolidation[] {
  return getRecentConsolidations(chatId, limit);
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
         COALESCE(SUM(input_tokens), 0) as allTimeInput,
         COALESCE(SUM(output_tokens), 0) as allTimeOutput,
         COALESCE(SUM(cost_usd), 0) as allTimeCost,
         COUNT(*) as allTimeTurns
       FROM token_usage WHERE chat_id = ?`,
    )
    .get(chatId) as { allTimeInput: number; allTimeOutput: number; allTimeCost: number; allTimeTurns: number };

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

export function getDashboardMemoriesList(chatId: string, limit = 50, offset = 0, sortBy: 'importance' | 'salience' | 'recent' = 'importance'): { memories: Memory[]; total: number } {
  const total = db
    .prepare('SELECT COUNT(*) as cnt FROM memories WHERE chat_id = ?')
    .get(chatId) as { cnt: number };

  let orderClause: string;
  switch (sortBy) {
    case 'salience':
      orderClause = 'ORDER BY salience DESC, created_at DESC';
      break;
    case 'recent':
      orderClause = 'ORDER BY created_at DESC';
      break;
    default:
      orderClause = 'ORDER BY importance DESC, created_at DESC';
  }

  const memories = db
    .prepare(
      `SELECT * FROM memories WHERE chat_id = ? ${orderClause} LIMIT ? OFFSET ?`,
    )
    .all(chatId, limit, offset) as Memory[];
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

/**
 * Get recent hive_mind entries from agents OTHER than the given one.
 * Used to give each agent awareness of what teammates have been doing.
 */
export function getOtherAgentActivity(
  excludeAgentId: string,
  hoursBack = 24,
  limit = 10,
): HiveMindEntry[] {
  const cutoff = Math.floor(Date.now() / 1000) - (hoursBack * 3600);
  return db
    .prepare(
      `SELECT * FROM hive_mind
       WHERE agent_id != ? AND created_at > ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(excludeAgentId, cutoff, limit) as HiveMindEntry[];
}

/**
 * Get conversation turns for a specific session, ordered chronologically.
 * Used for hive-mind auto-commit on session end.
 */
export function getSessionConversation(sessionId: string, limit = 40): ConversationTurn[] {
  return db
    .prepare(
      `SELECT * FROM conversation_log WHERE session_id = ?
       ORDER BY created_at ASC LIMIT ?`,
    )
    .all(sessionId, limit) as ConversationTurn[];
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

export function getAgentRecentConversation(agentId: string, chatId: string, limit = 4): ConversationTurn[] {
  return db
    .prepare(
      `SELECT * FROM conversation_log WHERE agent_id = ? AND chat_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(agentId, chatId, limit) as ConversationTurn[];
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

// ── Inter-Agent Tasks ──────────────────────────────────────────────────

export interface InterAgentTask {
  id: string;
  from_agent: string;
  to_agent: string;
  chat_id: string;
  prompt: string;
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createInterAgentTask(
  id: string,
  fromAgent: string,
  toAgent: string,
  chatId: string,
  prompt: string,
): void {
  db.prepare(
    `INSERT INTO inter_agent_tasks (id, from_agent, to_agent, chat_id, prompt, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
  ).run(id, fromAgent, toAgent, chatId, prompt);
}

export function completeInterAgentTask(
  id: string,
  status: 'completed' | 'failed',
  result: string | null,
): void {
  db.prepare(
    `UPDATE inter_agent_tasks SET status = ?, result = ?, completed_at = datetime('now') WHERE id = ?`,
  ).run(status, result?.slice(0, 2000) ?? null, id);
}

export function getInterAgentTasks(
  limit = 20,
  status?: string,
): InterAgentTask[] {
  if (status) {
    return db
      .prepare(
        'SELECT * FROM inter_agent_tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(status, limit) as InterAgentTask[];
  }
  return db
    .prepare(
      'SELECT * FROM inter_agent_tasks ORDER BY created_at DESC LIMIT ?',
    )
    .all(limit) as InterAgentTask[];
}

// ── Mission Tasks (one-shot async tasks for Mission Control) ─────────

export interface MissionTask {
  id: string;
  title: string;
  prompt: string;
  assigned_agent: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  result: string | null;
  error: string | null;
  created_by: string;
  priority: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export function createMissionTask(
  id: string,
  title: string,
  prompt: string,
  assignedAgent: string | null = null,
  createdBy = 'dashboard',
  priority = 0,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO mission_tasks (id, title, prompt, assigned_agent, status, created_by, priority, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`,
  ).run(id, title, prompt, assignedAgent, createdBy, priority, now);
}

export function getUnassignedMissionTasks(): MissionTask[] {
  return db
    .prepare(
      `SELECT * FROM mission_tasks WHERE assigned_agent IS NULL AND status = 'queued'
       ORDER BY priority DESC, created_at ASC`,
    )
    .all() as MissionTask[];
}

export function getMissionTasks(agentId?: string, status?: string): MissionTask[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push('assigned_agent = ?');
    params.push(agentId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  return db
    .prepare(
      `SELECT * FROM mission_tasks${where}
       ORDER BY
         CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,
         priority DESC, created_at DESC`,
    )
    .all(...params) as MissionTask[];
}

export function getMissionTask(id: string): MissionTask | null {
  return (db.prepare('SELECT * FROM mission_tasks WHERE id = ?').get(id) as MissionTask) ?? null;
}

export function claimNextMissionTask(agentId: string): MissionTask | null {
  const txn = db.transaction(() => {
    const task = db
      .prepare(
        `SELECT * FROM mission_tasks
         WHERE assigned_agent = ? AND status = 'queued'
         ORDER BY priority DESC, created_at ASC
         LIMIT 1`,
      )
      .get(agentId) as MissionTask | undefined;
    if (!task) return null;
    db.prepare(
      `UPDATE mission_tasks SET status = 'running', started_at = ? WHERE id = ?`,
    ).run(Math.floor(Date.now() / 1000), task.id);
    return { ...task, status: 'running' as const, started_at: Math.floor(Date.now() / 1000) };
  });
  return txn();
}

export function completeMissionTask(
  id: string,
  result: string | null,
  status: 'completed' | 'failed',
  error?: string,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE mission_tasks SET status = ?, result = ?, error = ?, completed_at = ? WHERE id = ?`,
  ).run(status, result, error ?? null, now, id);
}

export function cancelMissionTask(id: string): boolean {
  const result = db.prepare(
    `UPDATE mission_tasks SET status = 'cancelled', completed_at = ? WHERE id = ? AND status IN ('queued', 'running')`,
  ).run(Math.floor(Date.now() / 1000), id);
  return result.changes > 0;
}

export function deleteMissionTask(id: string): boolean {
  const result = db.prepare(
    `DELETE FROM mission_tasks WHERE id = ? AND status IN ('completed', 'cancelled', 'failed')`,
  ).run(id);
  return result.changes > 0;
}

export function cleanupOldMissionTasks(olderThanDays = 7): number {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanDays * 86400;
  const result = db.prepare(
    `DELETE FROM mission_tasks WHERE status IN ('completed', 'cancelled', 'failed') AND completed_at < ?`,
  ).run(cutoff);
  return result.changes;
}

export function reassignMissionTask(id: string, newAgent: string): boolean {
  const result = db.prepare(
    `UPDATE mission_tasks SET assigned_agent = ? WHERE id = ? AND status = 'queued'`,
  ).run(newAgent, id);
  return result.changes > 0;
}

export function assignMissionTask(id: string, agent: string): boolean {
  const result = db.prepare(
    `UPDATE mission_tasks SET assigned_agent = ? WHERE id = ? AND assigned_agent IS NULL AND status = 'queued'`,
  ).run(agent, id);
  return result.changes > 0;
}

export function getMissionTaskHistory(limit = 30, offset = 0): { tasks: MissionTask[]; total: number } {
  const total = (db.prepare(
    `SELECT COUNT(*) as c FROM mission_tasks WHERE status IN ('completed', 'failed', 'cancelled')`,
  ).get() as { c: number }).c;
  const tasks = db.prepare(
    `SELECT * FROM mission_tasks WHERE status IN ('completed', 'failed', 'cancelled')
     ORDER BY completed_at DESC LIMIT ? OFFSET ?`,
  ).all(limit, offset) as MissionTask[];
  return { tasks, total };
}

export function resetStuckMissionTasks(agentId: string): number {
  const result = db.prepare(
    `UPDATE mission_tasks SET status = 'queued', started_at = NULL WHERE status = 'running' AND assigned_agent = ?`,
  ).run(agentId);
  return result.changes;
}

// ── Audit Log ────────────────────────────────────────────────────────

export function insertAuditLog(
  agentId: string,
  chatId: string,
  action: string,
  detail: string,
  blocked: boolean,
): void {
  db.prepare(
    `INSERT INTO audit_log (agent_id, chat_id, action, detail, blocked, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s','now'))`,
  ).run(agentId, chatId, action, detail.slice(0, 2000), blocked ? 1 : 0);
}

export interface AuditLogEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  detail: string;
  blocked: number;
  created_at: number;
}

export function getAuditLog(limit = 50, offset = 0, agentId?: string): AuditLogEntry[] {
  if (agentId) {
    return db.prepare(
      `SELECT * FROM audit_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(agentId, limit, offset) as AuditLogEntry[];
  }
  return db.prepare(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).all(limit, offset) as AuditLogEntry[];
}

export function getAuditLogCount(agentId?: string): number {
  if (agentId) {
    return (db.prepare('SELECT COUNT(*) as c FROM audit_log WHERE agent_id = ?').get(agentId) as { c: number }).c;
  }
  return (db.prepare('SELECT COUNT(*) as c FROM audit_log').get() as { c: number }).c;
}

export function getRecentBlockedActions(limit = 10): AuditLogEntry[] {
  return db.prepare(
    `SELECT * FROM audit_log WHERE blocked = 1 ORDER BY created_at DESC LIMIT ?`,
  ).all(limit) as AuditLogEntry[];
}
