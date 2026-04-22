#!/usr/bin/env tsx
/**
 * Pass 2a — Mem0 Bulk Import (no embeddings).
 *
 * Reads ~/.openclaw/memory/mem0-vectors.sqlite (40k+ rows) and imports each
 * memory into claudeclaw.db:memories with source='mem0', appropriate agent_id
 * mapped from the mem0 runId, and importance=0.6 (unknown provenance, will be
 * refined via enrichment pass).
 *
 * Does NOT regenerate embeddings — that's Pass 2b (memory-backfill-embeddings.ts).
 * FTS5 keyword search works immediately after this pass.
 *
 * Mem0 payload shape: {"userId":"aditya","runId":"agent:main:main","data":"...","hash":"<md5>","createdAt":"ISO","updatedAt":"ISO"}
 *
 * Usage:
 *   tsx scripts/memory-import-mem0.ts [--dry-run] [--limit=N]
 */

import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

import { ALLOWED_CHAT_ID } from '../src/config.js';
import { initDatabase } from '../src/db.js';

const HOME = os.homedir();
const MEM0_PATH = path.join(HOME, '.openclaw', 'memory', 'mem0-vectors.sqlite');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 0;

// ── Agent mapping from mem0 runId ────────────────────────────────

function mapAgent(runId: string | undefined): string {
  if (!runId) return 'main';
  const r = runId.toLowerCase();
  if (r.includes('scout')) return 'research';
  if (r.includes('content-creator') || r.includes('content_creator')) return 'content';
  if (r.includes('speed-to-lead') || r.includes('speed_to_lead') || r.includes('s2l')) return 's2l';
  if (r.includes('crypto-trader') || r.includes('trader')) return 'main'; // trading bots memories live in main for now
  if (r.includes('heartbeat')) return 'main';
  if (r.includes('builder')) return 'builder';
  if (r.includes('ops') || r.includes('operations')) return 'ops';
  // agent:main:main / agent:default:main / anything else
  return 'main';
}

interface Mem0Payload {
  userId?: string;
  runId?: string;
  data?: string;
  hash?: string;
  createdAt?: string;
  updatedAt?: string;
}

function parseIso(iso: string | undefined, fallback: number): number {
  if (!iso) return fallback;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? fallback : Math.floor(ms / 1000);
}

// ── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  initDatabase(); // ensures schema is ready + FTS triggers wired

  const chatId = ALLOWED_CHAT_ID;
  if (!chatId) {
    console.error('✗ ALLOWED_CHAT_ID not set in .env');
    process.exit(1);
  }

  const src = new Database(MEM0_PATH, { readonly: true });
  const dstPath = path.join(process.cwd(), 'store', 'claudeclaw.db');
  const dst = new Database(dstPath);

  let query = `SELECT id, payload FROM vectors`;
  if (LIMIT > 0) query += ` LIMIT ${LIMIT}`;

  const rows = src.prepare(query).all() as { id: string; payload: string }[];
  console.log(`Source: ${MEM0_PATH}`);
  console.log(`Total mem0 rows: ${rows.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  // Build dedupe set from existing mem0 source rows (support resumability)
  const existingHashes = new Set<string>(
    (dst.prepare(`SELECT raw_text FROM memories WHERE source = 'mem0'`).all() as { raw_text: string }[])
      .map((r) => r.raw_text),
  );
  if (existingHashes.size > 0) {
    console.log(`Resumability: ${existingHashes.size} mem0 memories already in claudeclaw.db — will skip duplicates.`);
  }

  const insertStmt = dst.prepare(
    `INSERT INTO memories
      (chat_id, source, raw_text, summary, entities, topics, connections, importance, salience, consolidated, embedding, agent_id, embedding_model, pinned, created_at, accessed_at)
     VALUES
      (?, 'mem0', ?, ?, '[]', '[]', '[]', 0.6, 1.0, 0, NULL, ?, NULL, 0, ?, ?)`,
  );

  // Agent counters + dedupe tracker
  const agentCounts: Record<string, number> = {};
  const seenInThisRun = new Set<string>();

  let inserted = 0;
  let skippedDupe = 0;
  let skippedBad = 0;
  let skippedShort = 0;

  const tx = dst.transaction((rs: typeof rows) => {
    for (const row of rs) {
      let payload: Mem0Payload;
      try {
        payload = JSON.parse(row.payload);
      } catch {
        skippedBad++;
        continue;
      }
      const data = (payload.data || '').trim();
      if (!data || data.length < 10) {
        skippedShort++;
        continue;
      }
      // Dedupe within claudeclaw (existing) + within this run
      if (existingHashes.has(data) || seenInThisRun.has(data)) {
        skippedDupe++;
        continue;
      }
      seenInThisRun.add(data);

      const agentId = mapAgent(payload.runId);
      const created = parseIso(payload.createdAt, Math.floor(Date.now() / 1000));
      const accessed = parseIso(payload.updatedAt, created);

      agentCounts[agentId] = (agentCounts[agentId] ?? 0) + 1;

      if (!DRY_RUN) {
        insertStmt.run(chatId, data, data, agentId, created, accessed);
      }
      inserted++;
      if (inserted % 2500 === 0) {
        process.stdout.write(`\r  progress: ${inserted}/${rs.length}...`);
      }
    }
  });

  const t0 = Date.now();
  tx(rows);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  src.close();
  dst.close();

  console.log('');
  console.log(`${DRY_RUN ? 'DRY RUN' : '✓ Pass 2a complete'} in ${dt}s`);
  console.log(`  Inserted:         ${inserted}`);
  console.log(`  Skipped (dupe):   ${skippedDupe}`);
  console.log(`  Skipped (short):  ${skippedShort}`);
  console.log(`  Skipped (parse):  ${skippedBad}`);
  console.log(`  Per-agent counts:`);
  for (const [agent, count] of Object.entries(agentCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${agent.padEnd(12)} ${count}`);
  }
  console.log('');
  console.log(`  Next: tsx scripts/memory-backfill-embeddings.ts  (regenerates 40k embeddings with gemini-embedding-001)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
