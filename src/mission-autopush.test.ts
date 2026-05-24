/**
 * Unit tests for the mission-autopush hook.
 *
 * Covers the spec contract:
 *   1. completeMissionTask → notifyMissionCompletion fires exactly one Telegram message
 *   2. Rate-limit: >3 completions inside the batch window collapse to 1 batched msg
 *   3. Non-main-created missions (spoke-to-spoke) do NOT notify
 *   4. status='cancelled' does NOT notify
 *   5. Exactly-once: calling notifyMissionCompletion twice for the same id → 1 message
 *   6. MISSION_AUTOPUSH_DISABLED=1 → no messages sent
 *
 * All tests use a short batch window (20ms) so the flush timer fires quickly
 * without blocking the test suite, and inject a mock send function so we
 * never hit the real Telegram API.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// NOTE: config is imported for its side effects only (reads env). We need
// TELEGRAM_BOT_TOKEN / ALLOWED_CHAT_ID to be truthy so the hook doesn't
// short-circuit on missing credentials. Easiest way: set them in the env
// before the config module is first imported.
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token-xyz';
process.env.ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID || '7678675171';
// Field-level encryption key for the test DB — any 32-byte hex will do.
process.env.DB_ENCRYPTION_KEY =
  process.env.DB_ENCRYPTION_KEY ||
  '0'.repeat(64);

import {
  _initTestDatabase,
  createMissionTask,
  completeMissionTask,
  getMissionTask,
} from './db.js';
import {
  notifyMissionCompletion,
  _setSendFnForTest,
  _resetSendFnForTest,
  _setBatchWindowMsForTest,
  _resetStateForTest,
  _flushNowForTest,
  formatSingle,
  formatBatched,
} from './mission-autopush.js';

interface SentMessage {
  token: string;
  chatId: string;
  text: string;
}

/**
 * Helper: queue a completed mission (main-created by default) and fire the
 * hook. Returns the id so tests can assert on payload shape.
 */
function seedAndComplete(opts: {
  id: string;
  title?: string;
  createdBy?: string;
  assignedAgent?: string | null;
  status?: 'completed' | 'failed' | 'cancelled';
  result?: string | null;
  error?: string;
}): string {
  const {
    id,
    title = 'Test mission ' + id,
    createdBy = 'main',
    assignedAgent = 'builder',
    status = 'completed',
    result = 'done',
    error,
  } = opts;
  createMissionTask(id, title, 'prompt body', assignedAgent, createdBy, 5, null);
  if (status === 'cancelled') {
    // Mimic cancelMissionTask: status='cancelled', don't call completeMissionTask.
    // The hook should NEVER be triggered from the cancel path; this test
    // verifies that if someone DOES accidentally invoke it, the filter blocks.
    // We set status directly via a completed-then-cancelled dance.
  } else {
    completeMissionTask(id, result, status, error);
  }
  return id;
}

describe('mission-autopush', () => {
  let sent: SentMessage[];

  beforeEach(() => {
    _initTestDatabase();
    _resetStateForTest();
    // Short window so timers fire quickly in tests.
    _setBatchWindowMsForTest(20);
    sent = [];
    _setSendFnForTest(async (token, chatId, text) => {
      sent.push({ token, chatId, text });
    });
    delete process.env.MISSION_AUTOPUSH_DISABLED;
  });

  afterEach(() => {
    _resetSendFnForTest();
    _resetStateForTest();
  });

  // ── Spec requirement 1: single completion fires exactly one message ──

  it('fires exactly one Telegram message for a single main-created completion', async () => {
    seedAndComplete({ id: 'aaaaaaaa', status: 'completed' });
    notifyMissionCompletion('aaaaaaaa');

    await _flushNowForTest();

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('Mission completed');
    expect(sent[0].text).toContain('Test mission aaaaaaaa');
    // Token + chatId come from config.ts (which reads .env at import time,
    // overriding the process.env we set in this test file). Just verify
    // the hook passed *something* non-empty — the exact values depend on
    // which .env the test runner picks up.
    expect(sent[0].token.length).toBeGreaterThan(0);
    expect(sent[0].chatId.length).toBeGreaterThan(0);
  });

  it('fires a failure ping with error body included', async () => {
    seedAndComplete({
      id: 'bbbbbbbb',
      status: 'failed',
      result: null,
      error: 'GHL API returned 403 — token expired',
    });
    notifyMissionCompletion('bbbbbbbb');

    await _flushNowForTest();

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('Mission failed');
    expect(sent[0].text).toContain('GHL API returned 403');
  });

  // ── Spec requirement 2: rate-limit / batching ────────────────────────

  it('batches 5 completions inside the window into a single message', async () => {
    for (let i = 0; i < 5; i++) {
      seedAndComplete({
        id: `id${i}xxxx`,
        title: `Task ${i}`,
        status: 'completed',
      });
      notifyMissionCompletion(`id${i}xxxx`);
    }

    await _flushNowForTest();

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/5 missions finished/);
    expect(sent[0].text).toContain('id0xxxx');
    expect(sent[0].text).toContain('id4xxxx');
  });

  it('sends individually when buffer holds exactly 3 completions', async () => {
    for (let i = 0; i < 3; i++) {
      seedAndComplete({ id: `t${i}xxxxx`, title: `Task ${i}` });
      notifyMissionCompletion(`t${i}xxxxx`);
    }

    await _flushNowForTest();

    // Threshold is > 3 → 3 is still individual (boundary case).
    expect(sent).toHaveLength(3);
  });

  // ── Spec requirement 3: spoke-to-spoke delegations do NOT notify ─────

  it('does NOT notify when mission was created by another agent (e.g. ops)', async () => {
    seedAndComplete({ id: 'cccccccc', createdBy: 'ops', status: 'completed' });
    notifyMissionCompletion('cccccccc');

    await _flushNowForTest();

    expect(sent).toHaveLength(0);
  });

  it('does NOT notify when mission was created by the watchdog', async () => {
    seedAndComplete({ id: 'dddddddd', createdBy: 'watchdog', status: 'completed' });
    notifyMissionCompletion('dddddddd');

    await _flushNowForTest();

    expect(sent).toHaveLength(0);
  });

  // ── Spec requirement 4: status='cancelled' is silent ─────────────────

  it("does NOT notify for status='cancelled' missions", async () => {
    createMissionTask(
      'eeeeeeee',
      'Cancelled task',
      'prompt',
      'builder',
      'main',
      5,
      null,
    );
    // Cancellation doesn't go through completeMissionTask — simulate by
    // writing status directly. Hook should still filter it out.
    completeMissionTask('eeeeeeee', null, 'failed');
    // Now overwrite to cancelled to exercise the filter.
    const m = getMissionTask('eeeeeeee');
    expect(m).not.toBeNull();
    // directly mutate status via the DB by re-creating the row? Easier:
    // we just trust the hook's filter — it only fires for completed/failed.
    // Clear sent from the failed write above before testing cancel path.
    sent = [];

    // Simulate what would happen if someone called notifyMissionCompletion()
    // on a mission whose status had been flipped to 'cancelled' externally.
    // Use raw SQL via the in-memory test DB.
    const Database = (await import('better-sqlite3')).default;
    // Can't easily reach the test DB handle from here, so just verify the
    // filter at the getMissionTask level: build a synthetic mission.
    // Simpler: use completeMissionTask with an invalid status won't work
    // (it's typed). Instead, re-create with status 'cancelled' via direct
    // INSERT... but db is private. We cover the cancelled branch in unit
    // terms via the createMissionTask-with-cancelled-status path below.
    void Database;

    // Use a fresh id with 'cancelled' status injected via the cancel helper:
    createMissionTask(
      'ffffffff',
      'Cancel target',
      'prompt',
      'builder',
      'main',
      5,
      null,
    );
    const { cancelMissionTask } = await import('./db.js');
    cancelMissionTask('ffffffff');
    const cancelled = getMissionTask('ffffffff');
    expect(cancelled?.status).toBe('cancelled');

    notifyMissionCompletion('ffffffff');
    await _flushNowForTest();

    expect(sent).toHaveLength(0);
  });

  // ── Spec requirement 5: exactly-once / double-fire guard ─────────────

  it('is exactly-once — calling notifyMissionCompletion twice pushes one message', async () => {
    seedAndComplete({ id: 'gggggggg', status: 'completed' });

    notifyMissionCompletion('gggggggg');
    notifyMissionCompletion('gggggggg'); // second call — watchdog re-stamp scenario

    await _flushNowForTest();

    expect(sent).toHaveLength(1);

    // And autopushed_at is now stamped — further calls remain silent.
    const after = getMissionTask('gggggggg');
    expect(after?.autopushed_at).toBeGreaterThan(0);

    sent = [];
    notifyMissionCompletion('gggggggg'); // third call — long after
    await _flushNowForTest();
    expect(sent).toHaveLength(0);
  });

  // ── Spec requirement 6: opt-out kill switch ──────────────────────────

  it('MISSION_AUTOPUSH_DISABLED=1 suppresses all notifications', async () => {
    process.env.MISSION_AUTOPUSH_DISABLED = '1';

    seedAndComplete({ id: 'hhhhhhhh', status: 'completed' });
    notifyMissionCompletion('hhhhhhhh');

    await _flushNowForTest();

    expect(sent).toHaveLength(0);
    // autopushed_at should NOT be stamped when disabled — so toggling the env
    // var back on will still deliver the notification later.
    const after = getMissionTask('hhhhhhhh');
    expect(after?.autopushed_at).toBeNull();
  });

  // ── Non-regression: missing mission id is a no-op, not a throw ───────

  it('does nothing if the mission id does not exist', async () => {
    notifyMissionCompletion('deadbeef');
    await _flushNowForTest();
    expect(sent).toHaveLength(0);
  });

  // ── formatSingle / formatBatched output shape ────────────────────────

  it('formatSingle includes id, agent, title, status, and artifact if present', () => {
    const m = {
      id: 'abcd1234',
      title: 'Ship the thing',
      prompt: '',
      assigned_agent: 'builder',
      status: 'completed' as const,
      result: 'done\nArtifact: /tmp/report.md',
      error: null,
      created_by: 'main',
      priority: 5,
      created_at: 0,
      started_at: null,
      completed_at: null,
      acceptance_criteria: null,
      timeout_ms: null,
      autopushed_at: null,
      retry_attempt: 0,
      retried_from: null,
    };
    const text = formatSingle(m);
    expect(text).toContain('✅');
    expect(text).toContain('Ship the thing');
    expect(text).toContain('abcd1234');
    expect(text).toContain('@builder');
    expect(text).toContain('Artifact: /tmp/report.md');
  });

  it('formatBatched summarises mixed completed+failed batch', () => {
    const mk = (id: string, status: 'completed' | 'failed', title: string, error?: string) => ({
      id, title, prompt: '', assigned_agent: 'ops',
      status, result: status === 'completed' ? 'ok' : null,
      error: error ?? null, created_by: 'main', priority: 5,
      created_at: 0, started_at: null, completed_at: null,
      acceptance_criteria: null, timeout_ms: null, autopushed_at: null,
      retry_attempt: 0, retried_from: null,
    });
    const text = formatBatched([
      mk('aaaa0000', 'completed', 'A'),
      mk('bbbb0000', 'completed', 'B'),
      mk('cccc0000', 'failed', 'C', 'boom'),
      mk('dddd0000', 'completed', 'D'),
    ]);
    expect(text).toContain('4 missions finished (3 ok, 1 failed)');
    expect(text).toContain('aaaa0000');
    expect(text).toContain('cccc0000');
    expect(text).toContain('boom');
  });

  // ── Vitest: ensure no timers leaked across tests ─────────────────────

  it('resets cleanly between tests', () => {
    // Spam the buffer and reset without flushing — state must be clean.
    for (let i = 0; i < 10; i++) {
      seedAndComplete({ id: `z${i}xxxxx` });
      notifyMissionCompletion(`z${i}xxxxx`);
    }
    _resetStateForTest();
    vi.useFakeTimers();
    vi.advanceTimersByTime(10_000);
    vi.useRealTimers();
    expect(sent).toHaveLength(0);
  });
});
