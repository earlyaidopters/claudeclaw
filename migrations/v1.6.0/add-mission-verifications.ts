import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add mission_verifications table for the QA outcome audit (Watchdog C). ' +
  'Stores independent second-look verdicts on completed missions that had ' +
  'acceptance_criteria set. One row per (mission_id, audit run). Additive ' +
  'only; nothing existing is touched.';

const DB_PATH = path.join('store', 'claudeclaw.db');

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mission_verifications (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id   TEXT NOT NULL,
        verified_at  INTEGER NOT NULL,
        pass         INTEGER NOT NULL,
        notes        TEXT
      );

      -- Predicate the auditor hits on every run:
      --   "which of these missions have NOT been verified yet?"
      -- A btree on mission_id is enough — the table stays tiny (at most
      -- one row per completed+criteria mission).
      CREATE INDEX IF NOT EXISTS idx_mission_verifications_mission_id
        ON mission_verifications(mission_id);
    `);
  } finally {
    db.close();
  }
}
