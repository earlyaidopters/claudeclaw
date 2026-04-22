import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add dion_slide_cache table for QC-passed slide reuse. ' +
  'Avoids regenerating slides that already passed QC for the same fragrance + slide type + content hash.';

const DB_PATH = path.join('store', 'claudeclaw.db');

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dion_slide_cache (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        fragrance_id   TEXT NOT NULL,
        slide_type     TEXT NOT NULL,
        content_hash   TEXT NOT NULL,
        asset_path     TEXT NOT NULL,
        metadata       TEXT,
        passed_qc_at   INTEGER NOT NULL,
        created_at     INTEGER NOT NULL,
        expires_at     INTEGER,
        invalidated    INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_dion_cache_lookup
        ON dion_slide_cache(fragrance_id, slide_type, invalidated);

      CREATE INDEX IF NOT EXISTS idx_dion_cache_hash
        ON dion_slide_cache(content_hash);
    `);
  } finally {
    db.close();
  }
}
