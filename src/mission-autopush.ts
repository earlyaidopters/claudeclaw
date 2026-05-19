/**
 * Mission autopush — auto-notification hook that pings Aditya's main Telegram
 * chat whenever a mission created by Rudy (created_by='main') transitions to
 * status='completed' or 'failed'.
 *
 * Motivating problem: Aditya delegates work to a spoke via mission-cli; the
 * spoke finishes; Aditya has no idea unless he asks. This module closes that
 * loop by pushing a short completion ping to the main bot chat.
 *
 * Design contract:
 *   1. ONLY fires for mission_tasks where created_by='main' — spoke-to-spoke
 *      delegations and watchdog-queued auto-triage do NOT bother Aditya.
 *   2. ONLY fires for status in {completed, failed}. status='cancelled' is
 *      silent (operator already knows — they cancelled it).
 *   3. Exactly-once per mission. Uses the `autopushed_at` column on
 *      mission_tasks as an atomic CAS claim (see db.markMissionAutopushed).
 *      Watchdog re-stamping escalated_at cannot double-fire the hook.
 *   4. Rate-limited. If >3 completions land inside the batch window, they
 *      collapse into a single Telegram message so bursts don't spam the chat.
 *   5. Opt-out via env var MISSION_AUTOPUSH_DISABLED=1.
 *
 * Wiring: src/scheduler.ts calls notifyMissionCompletion(id) immediately after
 * each completeMissionTask() call in runDueMissionTasks. The hook is the ONLY
 * path that stamps autopushed_at, so no other completion path risks a
 * duplicate ping.
 *
 * Always routes via TELEGRAM_BOT_TOKEN → ALLOWED_CHAT_ID (the main bot chat),
 * regardless of which spoke executed the mission. Aditya sees all his
 * delegated work land in one place.
 */

import { ALLOWED_CHAT_ID, TELEGRAM_BOT_TOKEN } from './config.js';
import { getMissionTask, markMissionAutopushed, MissionTask, RetryReason } from './db.js';
import { logger } from './logger.js';

// ── Config ───────────────────────────────────────────────────────────

/**
 * How long to wait after the first buffered completion before flushing.
 * Tuned to be long enough to absorb natural bursts (several spokes finishing
 * near-simultaneously) while still feeling responsive for single completions.
 * Tests override via setBatchWindowMs().
 */
const DEFAULT_BATCH_WINDOW_MS = 2_000;

/**
 * If buffer has STRICTLY MORE than this many items when flushed, collapse
 * into a single batched message. 3 individual messages is still OK; 4+
 * means we're spamming.
 */
const BATCH_THRESHOLD = 3;

/** Max chars of result/error body to include in a single-mission push. */
const RESULT_PREVIEW_CHARS = 500;

// ── Test hooks ───────────────────────────────────────────────────────

type SendFn = (token: string, chatId: string, text: string) => Promise<void>;

let batchWindowMs = DEFAULT_BATCH_WINDOW_MS;
let sendFn: SendFn = defaultTelegramSend;
let pendingIds: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;

/** @internal Test hook — override the telegram sender (use a spy/mock). */
export function _setSendFnForTest(fn: SendFn): void {
  sendFn = fn;
}

/** @internal Test hook — reset to default sender (call in afterEach). */
export function _resetSendFnForTest(): void {
  sendFn = defaultTelegramSend;
}

/** @internal Test hook — tune the batch window so tests don't wait 2s. */
export function _setBatchWindowMsForTest(ms: number): void {
  batchWindowMs = ms;
}

/** @internal Test hook — clear buffer + cancel any pending flush. */
export function _resetStateForTest(): void {
  pendingIds = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  batchWindowMs = DEFAULT_BATCH_WINDOW_MS;
}

/** @internal Test hook — force the flush to run synchronously. */
export async function _flushNowForTest(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBuffer();
}

// ── Public entry point ──────────────────────────────────────────────

/**
 * Notify the main Telegram chat that a mission has completed or failed.
 *
 * Called from the scheduler immediately after completeMissionTask(). Non-blocking
 * and swallow-all-errors: a notification failure must NEVER cause the scheduler
 * to crash or retry the underlying work.
 *
 * The filtering rules (created_by='main', status in {completed, failed}, not
 * already pushed) run inside this function — callers don't need to pre-check.
 */
export function notifyMissionCompletion(missionId: string): void {
  // Opt-out kill switch — honour env var set at invocation time so it can be
  // toggled without restarting the scheduler (well, next completion picks it up).
  if (process.env.MISSION_AUTOPUSH_DISABLED === '1') {
    return;
  }

  try {
    const mission = getMissionTask(missionId);
    if (!mission) {
      logger.debug({ missionId }, 'mission-autopush: mission not found, skipping');
      return;
    }

    // Filter 1: only missions Rudy queued on Aditya's behalf.
    if (mission.created_by !== 'main') {
      return;
    }

    // Filter 2: only terminal-with-outcome statuses. 'cancelled' is silent
    // because the operator knows (they cancelled it). 'queued'/'running'
    // shouldn't hit this path at all, but guard anyway.
    if (mission.status !== 'completed' && mission.status !== 'failed') {
      return;
    }

    // Filter 3 (the exactly-once guard): atomic CAS on autopushed_at.
    // If this returns false the row was already claimed by an earlier call.
    if (!markMissionAutopushed(mission.id)) {
      logger.debug(
        { missionId: mission.id },
        'mission-autopush: already autopushed, skipping duplicate',
      );
      return;
    }

    // Missing credentials is not a hard failure — log once and move on.
    // The hook is best-effort; it must never break the scheduler.
    if (!TELEGRAM_BOT_TOKEN || !ALLOWED_CHAT_ID) {
      logger.warn(
        { missionId: mission.id },
        'mission-autopush: TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID unset — skipping push',
      );
      return;
    }

    enqueueForPush(mission.id);
  } catch (err) {
    logger.error({ err, missionId }, 'mission-autopush: notifyMissionCompletion threw');
  }
}

// ── Buffering + flush ────────────────────────────────────────────────

function enqueueForPush(missionId: string): void {
  pendingIds.push(missionId);
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushBuffer();
    }, batchWindowMs);
  }
}

async function flushBuffer(): Promise<void> {
  const ids = pendingIds;
  pendingIds = [];
  if (ids.length === 0) return;

  // Re-read each mission at flush time — the batch window is short, but
  // the row is the single source of truth for title/result/agent.
  const missions = ids
    .map((id) => getMissionTask(id))
    .filter((m): m is MissionTask => m !== null);
  if (missions.length === 0) return;

  try {
    if (missions.length > BATCH_THRESHOLD) {
      await sendFn(TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, formatBatched(missions));
    } else {
      for (const m of missions) {
        await sendFn(TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, formatSingle(m));
      }
    }
  } catch (err) {
    logger.error(
      { err, count: missions.length, ids: missions.map((m) => m.id) },
      'mission-autopush: flush failed',
    );
  }
}

// ── Message formatting ──────────────────────────────────────────────

/**
 * Detect an artifact path inside the result body.
 *
 * Two shapes supported (either is enough):
 *   1. Explicit label:  "Artifact: /abs/path" or "artifact_path: /abs/path"
 *   2. Bare absolute path on its own line ending with a recognisable extension
 *
 * Kept conservative on purpose — false positives here clutter the ping with
 * meaningless filenames.
 */
function extractArtifactPath(result: string | null): string | null {
  if (!result) return null;
  const labelled = /(?:^|\n)\s*(?:Artifact|artifact_path|Output file|File)\s*:\s*(\S+)/.exec(
    result,
  );
  if (labelled && labelled[1]) return labelled[1];
  const bare = /(?:^|\n)\s*(\/(?:Users|home|tmp|var)\/\S+\.(?:md|json|png|jpg|jpeg|csv|pdf|txt|log|html|ts|tsx|js|py|sh|mp4|mp3|wav))\b/.exec(
    result,
  );
  return bare ? bare[1] : null;
}

function shortId(id: string): string {
  // Mission IDs are already 8 hex chars (randomBytes(4).toString('hex')).
  // Slice anyway so this is robust to future id-length changes.
  return id.slice(0, 8);
}

function clip(s: string | null | undefined, max: number): string {
  if (!s) return '';
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function statusGlyph(status: string): string {
  return status === 'completed' ? '✅' : '❌';
}

export function formatSingle(m: MissionTask): string {
  const glyph = statusGlyph(m.status);
  const agent = m.assigned_agent ? `@${m.assigned_agent}` : '(unassigned)';
  const lines: string[] = [];
  lines.push(`${glyph} Mission ${m.status}: ${m.title}`);
  lines.push(`ID: ${shortId(m.id)}`);
  lines.push(`Agent: ${agent}`);

  if (m.status === 'failed') {
    const body = m.error || m.result || '(no error body)';
    lines.push('');
    lines.push(clip(body, RESULT_PREVIEW_CHARS));
  } else if (m.result) {
    lines.push('');
    lines.push(clip(m.result, RESULT_PREVIEW_CHARS));
  }

  const artifact = extractArtifactPath(m.result);
  if (artifact) {
    lines.push('');
    lines.push(`Artifact: ${artifact}`);
  }

  return lines.join('\n');
}

export function formatBatched(missions: MissionTask[]): string {
  const done = missions.filter((m) => m.status === 'completed').length;
  const failed = missions.filter((m) => m.status === 'failed').length;
  const header = `📋 ${missions.length} missions finished (${done} ok, ${failed} failed):`;
  const lines: string[] = [header, ''];
  for (const m of missions) {
    const glyph = statusGlyph(m.status);
    const agent = m.assigned_agent ? `@${m.assigned_agent}` : '(unassigned)';
    const suffix =
      m.status === 'failed' && m.error ? ` — ${clip(m.error, 120)}` : '';
    lines.push(`${glyph} ${shortId(m.id)} ${agent} — ${clip(m.title, 80)}${suffix}`);
  }
  lines.push('');
  lines.push('Reply "/mission result <id>" for details.');
  return lines.join('\n');
}

// ── Retry-dispatch ping (out-of-band, not part of the completion buffer) ──

export interface RetryDispatchPingArgs {
  /** New retry mission id (retry_attempt=1). */
  childId: string;
  /** Original failed mission id. */
  parentId: string;
  /** Agent the retry was dispatched to. Mirrors the parent's assigned_agent. */
  assignedAgent: string | null;
  /** Retry mission title — already "[retry] <parent title>". */
  title: string;
  /** Why the parent failed — used in the ping text. */
  reason: RetryReason;
}

/**
 * Format the single-line Telegram ping for a watchdog-dispatched auto-retry.
 *
 * Intentionally separate from the completion buffer — the retry itself is a
 * dispatch event (not a completion), and we want it to land immediately so
 * Aditya sees the auto-retry happened without waiting for the batch window.
 */
export function formatRetryDispatch(args: RetryDispatchPingArgs): string {
  const agent = args.assignedAgent ? `@${args.assignedAgent}` : '(unassigned)';
  const reasonLabel = args.reason === 'turn_cap' ? 'turn cap' : 'timeout';
  // Short parent id for readability — mirrors formatSingle's shortId.
  const parentShort = args.parentId.slice(0, 8);
  return (
    `🔄 Auto-retry: ${agent} "${clip(args.title, 120)}" (attempt 2/2) — ` +
    `parent ${parentShort} hit ${reasonLabel}`
  );
}

/**
 * Send the retry-dispatch ping to the main bot chat. Mirrors the fall-open
 * behaviour of notifyMissionCompletion — missing env / opt-out / send error
 * must never propagate back to the watchdog and block retry dispatch.
 *
 * Unbuffered on purpose: auto-retries are infrequent and the user wants to
 * know IMMEDIATELY that a retry fired, not 2s later bundled with other work.
 */
export async function notifyRetryDispatch(args: RetryDispatchPingArgs): Promise<void> {
  if (process.env.MISSION_AUTOPUSH_DISABLED === '1') return;
  if (!TELEGRAM_BOT_TOKEN || !ALLOWED_CHAT_ID) {
    logger.warn(
      { childId: args.childId, parentId: args.parentId },
      'mission-autopush: TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID unset — skipping retry ping',
    );
    return;
  }
  try {
    await sendFn(TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, formatRetryDispatch(args));
  } catch (err) {
    logger.error(
      { err, childId: args.childId, parentId: args.parentId },
      'mission-autopush: retry dispatch ping failed',
    );
  }
}

// ── Default Telegram sender (AbortController 10s timeout per builder rules) ──

async function defaultTelegramSend(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        // Plain text — no HTML parse_mode — to avoid needing to escape the
        // result body (which can contain arbitrary characters from agents).
        text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`telegram ${res.status}: ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
