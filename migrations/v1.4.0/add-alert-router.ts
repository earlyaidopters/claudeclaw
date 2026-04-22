import path from 'path';
import Database from 'better-sqlite3';

export const description =
  'Add alert router tables (pending_alerts, alert_decisions) for the ' +
  'hourly-digest / realtime-bypass delivery system. Additive-only; no ' +
  'existing data touched.';

const DB_PATH = path.join('store', 'claudeclaw.db');

export async function run(): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_alerts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id    TEXT NOT NULL,
        chat_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'task_result',
        created_at  INTEGER NOT NULL,
        sent_at     INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_pending_alerts_flush
        ON pending_alerts(agent_id, sent_at, created_at)
        WHERE sent_at IS NULL;

      CREATE TABLE IF NOT EXISTS alert_decisions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id         TEXT NOT NULL,
        content_preview  TEXT NOT NULL,
        classified_as    TEXT NOT NULL,
        rule_hit         TEXT NOT NULL,
        created_at       INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alert_decisions_created_at
        ON alert_decisions(created_at);
    `);
  } finally {
    db.close();
  }
}
