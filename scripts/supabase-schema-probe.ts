#!/usr/bin/env tsx
/**
 * Discover the actual column list for each table we plan to migrate from Supabase.
 *
 * Approach: PostgREST exposes table rows at /rest/v1/<table>. When we fetch any
 * row, the JSON keys ARE the columns. For empty tables, we fall back to a
 * Prefer: count=exact HEAD request to prove the table exists, and print a
 * note that we couldn't infer columns without data.
 *
 * Usage (pick whichever works for you):
 *
 *   # via 1Password CLI (no secrets echoed)
 *   op signin
 *   SUPABASE_URL=$(op read "op://Work/Supabase/url") \
 *   SUPABASE_SERVICE_KEY=$(op read "op://Work/Supabase/service_key") \
 *   tsx scripts/supabase-schema-probe.ts
 *
 *   # via .env (add SUPABASE_URL + SUPABASE_SERVICE_KEY to ~/claudeclaw/.env first)
 *   tsx scripts/supabase-schema-probe.ts
 *
 * Prints only column names and row counts. Never prints row VALUES.
 */

import { readEnvFile } from '../src/env.js';

const TABLES = [
  'kanban_tasks',
  'agent_heartbeats',
  'agent_events',
  // bonus: show hive_mind so we can diff against local schema
  'hive_mind',
] as const;

async function probeTable(url: string, key: string, table: string): Promise<void> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  // Count rows
  const countRes = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
    method: 'HEAD',
    headers: { ...headers, Prefer: 'count=exact' },
  });
  const contentRange = countRes.headers.get('content-range') ?? '';
  const count = contentRange.split('/').pop() ?? '?';

  if (!countRes.ok) {
    console.log(`\n${table}: (cannot read — ${countRes.status} ${countRes.statusText})`);
    return;
  }

  // Fetch one row to learn columns
  const rowRes = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  if (!rowRes.ok) {
    console.log(`\n${table}: rows=${count}  (row fetch failed: ${rowRes.status})`);
    return;
  }
  const rows = (await rowRes.json()) as Array<Record<string, unknown>>;

  console.log(`\n${table}: rows=${count}`);
  if (rows.length === 0) {
    console.log('  (empty — cannot infer columns without a row. Insert a row or query information_schema.)');
    return;
  }

  const columns = Object.keys(rows[0]);
  for (const col of columns) {
    const value = rows[0][col];
    const tsType =
      value === null ? 'null/unknown' :
      typeof value === 'object' ? (Array.isArray(value) ? 'json[]' : 'json') :
      typeof value;
    console.log(`  - ${col.padEnd(24)}  ${tsType}`);
  }
}

async function main(): Promise<void> {
  const env = readEnvFile(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY || '';

  if (!url || !key) {
    console.error(
      '✗ SUPABASE_URL or SUPABASE_SERVICE_KEY missing.\n' +
      '  Either add them to ~/claudeclaw/.env or run with:\n' +
      '    SUPABASE_URL=$(op read ...) SUPABASE_SERVICE_KEY=$(op read ...) tsx scripts/supabase-schema-probe.ts',
    );
    process.exit(1);
  }

  console.log(`Probing ${url} — column discovery for migration v1.2.0`);
  for (const table of TABLES) {
    await probeTable(url, key, table);
  }
  console.log('\nDone. Paste the output above into the ClaudeClaw chat so I can adjust the migration if needed.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
