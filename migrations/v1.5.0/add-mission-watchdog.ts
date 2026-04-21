import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add mission_tasks.escalated_at (unix ts, nullable) so the mission ' +
  'watchdog can stamp failed/stuck missions after they have been ' +
  'surfaced to Rudy via realtime alert. Additive-only; existing rows ' +
  'left untouched (escalated_at = NULL means "not yet escalated").';

const DB_PATH = path.join('store', 'claudeclaw.db');

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    if (!hasColumn(db, 'mission_tasks', 'escalated_at')) {
      db.exec(`ALTER TABLE mission_tasks ADD COLUMN escalated_at INTEGER`);
    }

    // Index on the predicate the watchdog hits every 10 min:
    //   WHERE status='failed' AND escalated_at IS NULL
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mission_unescalated
        ON mission_tasks(status, escalated_at, created_at)
        WHERE escalated_at IS NULL;
    `);
  } finally {
    db.close();
  }
}
