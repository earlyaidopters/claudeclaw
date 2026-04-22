import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add scheduled_tasks.escalated_at (unix ts, nullable) so the mission ' +
  'watchdog can de-dupe auto-triage missions for a cron that fails repeatedly. ' +
  'Additive-only; existing rows left untouched (escalated_at = NULL means ' +
  '"not yet escalated").';

const DB_PATH = path.join('store', 'claudeclaw.db');

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    if (!hasColumn(db, 'scheduled_tasks', 'escalated_at')) {
      db.exec(`ALTER TABLE scheduled_tasks ADD COLUMN escalated_at INTEGER`);
    }

    // Index on the predicate the watchdog hits every 10 min:
    //   WHERE last_run > (now - 1h) AND (escalated_at IS NULL OR escalated_at < now - 1h)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_escalation
        ON scheduled_tasks(last_run, escalated_at);
    `);
  } finally {
    db.close();
  }
}
