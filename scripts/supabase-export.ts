#!/usr/bin/env tsx
/**
 * Export operational tables from Supabase to a local JSON snapshot.
 *
 * Tables exported:
 *   - kanban_tasks
 *   - agent_heartbeats
 *   - agent_events
 *
 * NOT exported (stay in Supabase, used by external systems):
 *   - fragrance_catalog  (DION mobile app)
 *   - bot_kv             (PM2 trading bots)
 *   - hive_mind          (already local)
 *
 * Prereqs in `.env`:
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY=<service role key>  (read-only is enough)
 *
 * Usage:
 *   npm run supabase:export
 *
 * Output:
 *   store/supabase-export-YYYY-MM-DD.json
 */

import fs from 'fs';
import path from 'path';
import { readEnvFile } from '../src/env.js';

const TABLES = ['kanban_tasks', 'agent_heartbeats', 'agent_events'] as const;

// Supabase PostgREST caps responses at 1000 rows by default. We paginate via
// Range header until we get a short page or hit a hard ceiling.
const PAGE_SIZE = 1000;
const HARD_CEILING = 500_000;

async function fetchTable(url: string, key: string, table: string): Promise<unknown[]> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const rows: unknown[] = [];
  let offset = 0;

  while (offset < HARD_CEILING) {
    const to = offset + PAGE_SIZE - 1;
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.asc.nullsfirst`, {
      headers: { ...headers, Range: `${offset}-${to}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${table} fetch failed at offset ${offset}: ${res.status} ${body}`);
    }
    const page = (await res.json()) as unknown[];
    rows.push(...page);
    process.stdout.write(`\r  ${table}: ${rows.length} rows fetched...`);
    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  process.stdout.write('\n');
  return rows;
}

async function main(): Promise<void> {
  const env = readEnvFile(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  const url = process.env.SUPABASE_URL || env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error(
      '✗ SUPABASE_URL or SUPABASE_SERVICE_KEY missing from .env. Rotate and add them first.',
    );
    process.exit(1);
  }

  const snapshot: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    process.stdout.write(`Fetching ${table}... `);
    const rows = await fetchTable(url, key, table);
    snapshot[table] = rows;
    console.log(`${rows.length} rows`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join('store', `supabase-export-${date}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  const totalRows = Object.values(snapshot).reduce((n, r) => n + (r as unknown[]).length, 0);
  console.log(`\n✓ Exported ${totalRows} rows across ${TABLES.length} tables → ${outPath}`);
  console.log(`  Next: npm run supabase:import ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
