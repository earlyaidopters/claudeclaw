#!/usr/bin/env tsx
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { embedText } from '../src/embeddings.js';
import { readEnvFile } from '../src/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

readEnvFile([]);

const DB_PATH = path.join(PROJECT_ROOT, 'store', 'claudeclaw.db');
const db = new Database(DB_PATH);

const RATE_LIMIT_MS = 100; // 10 req/s max

interface MemoryRow {
  id: number;
  summary: string;
}

const rows = db
  .prepare(
    `SELECT id, summary FROM memories
     WHERE source = 'mem0' AND embedding IS NULL
     ORDER BY id ASC`
  )
  .all() as MemoryRow[];

const total = rows.length;
console.log(`Backfilling ${total} embeddings with gemini-embedding-001...`);

if (total === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

const updateStmt = db.prepare(
  `UPDATE memories SET embedding = ?, embedding_model = 'gemini-embedding-001' WHERE id = ?`
);

const startMs = Date.now();
let succeeded = 0;
let failed = 0;
const failedIds: number[] = [];

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];

  const jitter = Math.floor(Math.random() * 30);
  await new Promise<void>((r) => setTimeout(r, RATE_LIMIT_MS + jitter));

  try {
    const embedding = await embedText(row.summary);
    updateStmt.run(JSON.stringify(embedding), row.id);
    succeeded++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`failed id=${row.id} err=${msg}`);
    failed++;
    failedIds.push(row.id);
  }

  const done = i + 1;
  if (done % 500 === 0 || done === total) {
    const elapsedS = (Date.now() - startMs) / 1000;
    const rate = (done / elapsedS).toFixed(1);
    console.log(
      `[${done}/${total}] elapsed=${Math.round(elapsedS)}s rate=${rate}req/s failures=${failed}`
    );
  }
}

const elapsedMin = ((Date.now() - startMs) / 60000).toFixed(1);
const overallRate = (total / ((Date.now() - startMs) / 1000)).toFixed(1);
const failedPreview = failedIds.slice(0, 20).join(', ');

console.log(`
Backfill complete
  Processed:    ${total}
  Succeeded:    ${succeeded}
  Failed:       ${failed}${failed > 0 ? `  (IDs: ${failedPreview}${failedIds.length > 20 ? ` ...+${failedIds.length - 20} more` : ''})` : ''}
  Elapsed:      ${elapsedMin} min
  Rate:         ${overallRate} req/s
`);
