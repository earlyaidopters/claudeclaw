import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add model column to scheduled_tasks table. NULL means use agent default. ' +
  'Non-null values are stored as aliases (haiku|sonnet|opus) resolved at fire time via resolveModelAlias().';

const DB_PATH = path.join('store', 'claudeclaw.db');

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    const cols = db.prepare(`PRAGMA table_info(scheduled_tasks)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'model')) {
      db.exec(`ALTER TABLE scheduled_tasks ADD COLUMN model TEXT`);
    }
  } finally {
    db.close();
  }
}
