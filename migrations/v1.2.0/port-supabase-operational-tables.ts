import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Port operational tables from Supabase to local SQLite: kanban_tasks (382 rows), ' +
  'agent_heartbeats (9 rows), agent_events (114k rows). Schemas mirror the Postgres source ' +
  'exactly, with: uuid → TEXT, jsonb → TEXT (JSON string), timestamptz → INTEGER (unix seconds), ' +
  'numeric → REAL, text[] → TEXT (JSON array). hive_mind is local-only (does not exist in ' +
  'Supabase). fragrance_catalog + bot_kv stay in Supabase because DION mobile app + PM2 bots need them.';

// Relative path resolved against the project root (process.cwd() at migration time).
const DB_PATH = path.join('store', 'claudeclaw.db');

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      -- ── kanban_tasks ─────────────────────────────────────────────
      -- Mirrors public.kanban_tasks in Supabase (project ref mlvgoupkughewktrthfo).
      -- 382 rows as of migration. priority stored as TEXT ('low'|'medium'|'high')
      -- to match the source; date values stay as TEXT since the source stores
      -- due_date as text too (not a real timestamp).
      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id           TEXT PRIMARY KEY,                -- uuid
        title        TEXT NOT NULL,
        description  TEXT,
        priority     TEXT DEFAULT 'medium',            -- low | medium | high
        due_date     TEXT,                             -- text, matches source
        tags         TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
        column_id    TEXT DEFAULT 'todo',              -- todo | inprogress | blocked | done
        notes        TEXT,
        created_at   INTEGER NOT NULL,                 -- unix seconds
        updated_at   INTEGER NOT NULL,
        created_by   TEXT DEFAULT 'aditya'
      );

      CREATE INDEX IF NOT EXISTS idx_kanban_column
        ON kanban_tasks(column_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_kanban_created_by
        ON kanban_tasks(created_by, column_id);

      -- ── agent_heartbeats ─────────────────────────────────────────
      -- One row per agent, upserted on each ping. PK is agent_id.
      -- Rich telemetry: current task, session, token + cost counters, queue,
      -- status (offline|alive|degraded|...). QA reads this to alert on down agents.
      CREATE TABLE IF NOT EXISTS agent_heartbeats (
        agent_id                 TEXT PRIMARY KEY,
        agent_name               TEXT NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'offline',
        model                    TEXT,
        current_task             TEXT,
        current_task_started_at  INTEGER,
        session_id               TEXT,
        tokens_used_session      INTEGER DEFAULT 0,
        tokens_used_today        INTEGER DEFAULT 0,
        cost_today_usd           REAL DEFAULT 0,
        queue                    TEXT NOT NULL DEFAULT '[]',
        metadata                 TEXT NOT NULL DEFAULT '{}',
        last_heartbeat           INTEGER NOT NULL,
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_heartbeats_status
        ON agent_heartbeats(status, last_heartbeat DESC);

      -- ── agent_events ─────────────────────────────────────────────
      -- Machine-readable per-event log. 114k rows at migration time — indexes matter.
      -- Complements hive_mind (human-readable action summaries).
      CREATE TABLE IF NOT EXISTS agent_events (
        id          TEXT PRIMARY KEY,                 -- uuid
        ts          INTEGER NOT NULL,                 -- unix seconds (primary timestamp)
        agent_id    TEXT NOT NULL,
        event_type  TEXT NOT NULL,
        session_id  TEXT,
        model       TEXT,
        tokens_in   INTEGER DEFAULT 0,
        tokens_out  INTEGER DEFAULT 0,
        cost_usd    REAL DEFAULT 0,
        task        TEXT,
        outcome     TEXT,
        metadata    TEXT NOT NULL DEFAULT '{}',       -- jsonb → JSON string
        created_at  INTEGER NOT NULL                  -- secondary timestamp from source
      );

      CREATE INDEX IF NOT EXISTS idx_events_agent_ts
        ON agent_events(agent_id, ts DESC);

      CREATE INDEX IF NOT EXISTS idx_events_type_ts
        ON agent_events(event_type, ts DESC);

      CREATE INDEX IF NOT EXISTS idx_events_session
        ON agent_events(session_id);
    `);

    console.log('  ✓ kanban_tasks (11 cols, 2 indexes)');
    console.log('  ✓ agent_heartbeats (15 cols, 1 index, PK=agent_id)');
    console.log('  ✓ agent_events (13 cols, 3 indexes)');
    console.log('  ℹ  hive_mind already existed (local-only; not in Supabase)');
    console.log('  ℹ  fragrance_catalog + bot_kv remain in Supabase');
    console.log('  Next: run `npm run supabase:export` then `npm run supabase:import <file>`');
  } finally {
    db.close();
  }
}
