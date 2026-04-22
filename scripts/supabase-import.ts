#!/usr/bin/env tsx
/**
 * Import a Supabase JSON snapshot (produced by `supabase-export.ts`) into the
 * local SQLite database. Handles Postgres → SQLite type conversion:
 *
 *   timestamptz string  →  INTEGER unix seconds
 *   jsonb object/array  →  TEXT (JSON string)
 *   text[] array        →  TEXT (JSON string)
 *   uuid string         →  TEXT
 *   numeric             →  REAL
 *
 * Usage:
 *   npx tsx scripts/supabase-import.ts store/supabase-export-2026-04-19.json
 *
 * Flags:
 *   --dry-run           Print what would happen, don't insert.
 *   --truncate          Delete existing rows in target tables before import.
 *   --since YYYY-MM-DD  For agent_events only: skip rows older than this date.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join('store', 'claudeclaw.db');

type Row = Record<string, unknown>;

function tsToUnix(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.floor(v);
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  }
  return null;
}

function toJsonString(v: unknown): string {
  if (v === null || v === undefined) return '[]';
  if (typeof v === 'string') return v; // already JSON-ish
  return JSON.stringify(v);
}

function toJsonStringOrEmpty(v: unknown, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

// ── Per-table transformers ──────────────────────────────────────────

function transformKanbanTask(r: Row): Row {
  const createdAt = tsToUnix(r['created_at']) ?? Math.floor(Date.now() / 1000);
  const updatedAt = tsToUnix(r['updated_at']) ?? createdAt;
  return {
    id: r['id'],
    title: r['title'],
    description: r['description'] ?? null,
    priority: r['priority'] ?? 'medium',
    due_date: r['due_date'] ?? null,           // stays as text
    tags: toJsonString(r['tags']),             // array → JSON string
    column_id: r['column_id'] ?? 'todo',
    notes: r['notes'] ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: r['created_by'] ?? 'aditya',
  };
}

function transformHeartbeat(r: Row): Row {
  const createdAt = tsToUnix(r['created_at']) ?? Math.floor(Date.now() / 1000);
  return {
    agent_id: r['agent_id'],
    agent_name: r['agent_name'] ?? r['agent_id'],
    status: r['status'] ?? 'offline',
    model: r['model'] ?? null,
    current_task: r['current_task'] ?? null,
    current_task_started_at: tsToUnix(r['current_task_started_at']),
    session_id: r['session_id'] ?? null,
    tokens_used_session: r['tokens_used_session'] ?? 0,
    tokens_used_today: r['tokens_used_today'] ?? 0,
    cost_today_usd: r['cost_today_usd'] ?? 0,
    queue: toJsonStringOrEmpty(r['queue'], '[]'),
    metadata: toJsonStringOrEmpty(r['metadata'], '{}'),
    last_heartbeat: tsToUnix(r['last_heartbeat']) ?? createdAt,
    created_at: createdAt,
    updated_at: tsToUnix(r['updated_at']) ?? createdAt,
  };
}

function transformEvent(r: Row): Row {
  const ts = tsToUnix(r['ts']) ?? tsToUnix(r['created_at']) ?? Math.floor(Date.now() / 1000);
  return {
    id: r['id'],
    ts,
    agent_id: r['agent_id'],
    event_type: r['event_type'],
    session_id: r['session_id'] ?? null,
    model: r['model'] ?? null,
    tokens_in: r['tokens_in'] ?? 0,
    tokens_out: r['tokens_out'] ?? 0,
    cost_usd: r['cost_usd'] ?? 0,
    task: r['task'] ?? null,
    outcome: r['outcome'] ?? null,
    metadata: toJsonStringOrEmpty(r['metadata'], '{}'),
    created_at: tsToUnix(r['created_at']) ?? ts,
  };
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const truncate = args.includes('--truncate');
  const sinceIdx = args.indexOf('--since');
  const sinceTs = sinceIdx !== -1 ? tsToUnix(args[sinceIdx + 1]) : null;

  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npx tsx scripts/supabase-import.ts <snapshot.json> [--dry-run] [--truncate] [--since YYYY-MM-DD]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`✗ Snapshot not found: ${file}`);
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, Row[]>;
  console.log(`Loaded ${file}`);
  for (const t of Object.keys(snapshot)) {
    console.log(`  ${t}: ${snapshot[t].length} rows`);
  }

  if (dryRun) {
    console.log('\n(dry-run mode: no writes)');
    return;
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    if (truncate) {
      console.log('\nTruncating target tables...');
      db.exec(`DELETE FROM kanban_tasks; DELETE FROM agent_heartbeats; DELETE FROM agent_events;`);
    }

    // kanban_tasks
    if (snapshot['kanban_tasks']) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO kanban_tasks (
          id, title, description, priority, due_date, tags, column_id, notes,
          created_at, updated_at, created_by
        ) VALUES (
          @id, @title, @description, @priority, @due_date, @tags, @column_id, @notes,
          @created_at, @updated_at, @created_by
        )`);
      const txn = db.transaction((rows: Row[]) => {
        for (const r of rows) stmt.run(transformKanbanTask(r));
      });
      txn(snapshot['kanban_tasks']);
      console.log(`  ✓ kanban_tasks: ${snapshot['kanban_tasks'].length} rows imported`);
    }

    // agent_heartbeats
    if (snapshot['agent_heartbeats']) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO agent_heartbeats (
          agent_id, agent_name, status, model, current_task, current_task_started_at,
          session_id, tokens_used_session, tokens_used_today, cost_today_usd,
          queue, metadata, last_heartbeat, created_at, updated_at
        ) VALUES (
          @agent_id, @agent_name, @status, @model, @current_task, @current_task_started_at,
          @session_id, @tokens_used_session, @tokens_used_today, @cost_today_usd,
          @queue, @metadata, @last_heartbeat, @created_at, @updated_at
        )`);
      const txn = db.transaction((rows: Row[]) => {
        for (const r of rows) stmt.run(transformHeartbeat(r));
      });
      txn(snapshot['agent_heartbeats']);
      console.log(`  ✓ agent_heartbeats: ${snapshot['agent_heartbeats'].length} rows imported`);
    }

    // agent_events (big one — 114k rows)
    if (snapshot['agent_events']) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO agent_events (
          id, ts, agent_id, event_type, session_id, model,
          tokens_in, tokens_out, cost_usd, task, outcome, metadata, created_at
        ) VALUES (
          @id, @ts, @agent_id, @event_type, @session_id, @model,
          @tokens_in, @tokens_out, @cost_usd, @task, @outcome, @metadata, @created_at
        )`);
      const txn = db.transaction((rows: Row[]) => {
        let imported = 0;
        let skipped = 0;
        for (const r of rows) {
          const t = transformEvent(r);
          if (sinceTs !== null && typeof t.ts === 'number' && t.ts < sinceTs) {
            skipped++;
            continue;
          }
          stmt.run(t);
          imported++;
        }
        return { imported, skipped };
      });
      const result = txn(snapshot['agent_events']) as { imported: number; skipped: number };
      console.log(`  ✓ agent_events: ${result.imported} imported${result.skipped ? `, ${result.skipped} skipped (--since)` : ''}`);
    }

    // Final verification
    console.log('\nRow counts after import:');
    for (const t of ['kanban_tasks', 'agent_heartbeats', 'agent_events']) {
      const n = db.prepare(`SELECT count(*) AS c FROM ${t}`).get() as { c: number };
      console.log(`  ${t}: ${n.c}`);
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
