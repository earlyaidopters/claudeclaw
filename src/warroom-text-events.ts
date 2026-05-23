/**
 * Per-meeting event channel for the text War Room.
 *
 * Unlike the global chatEvents EventEmitter in state.ts (which has no seq,
 * no replay, no per-meeting filter), each MeetingChannel maintains:
 *   - monotonic seq so clients can resume from a known point
 *   - bounded ring buffer (MAX_BUFFER events) so replay is cheap
 *   - per-meeting subscription so events don't cross-pollinate
 *
 * On SSE reconnect, the client passes `sinceSeq`; the server drains
 * `channel.since(sinceSeq)` immediately, then subscribes live. If the
 * client's `sinceSeq` is older than the ring buffer's oldest event, the
 * client falls back to pulling from warroom_transcript via /history and
 * accepts that streaming texture (agent_chunk, agent_typing) for the
 * gap window is lost — final agent_done.text is still delivered.
 */

import { EventEmitter } from 'node:events';

export type WarRoomTextEvent =
  | { type: 'meeting_state'; meetingId: string; pinnedAgent: string | null; agents: Array<{ id: string; name: string; description: string }>; isFresh: boolean }
  | { type: 'turn_start'; turnId: string; clientMsgId: string; userText: string; userTs: number; userTranscriptRowId: number }
  | { type: 'status_update'; turnId: string; phase: 'routing' | 'starting' | 'streaming' | 'checking_interveners'; label: string; agentId?: string }
  | { type: 'router_decision'; turnId: string; primary: string | null; interveners: string[]; reason: string }
  | { type: 'agent_selected'; turnId: string; agentId: string; role: 'primary' | 'intervener' }
  | { type: 'agent_typing'; turnId: string; agentId: string; role: 'primary' | 'intervener' }
  | { type: 'agent_chunk'; turnId: string; agentId: string; role: 'primary' | 'intervener'; delta: string }
  | { type: 'agent_done'; turnId: string; agentId: string; role: 'primary' | 'intervener'; text: string; transcriptRowId?: number; incomplete?: boolean }
  | { type: 'intervention_skipped'; turnId: string; agentId: string; role?: 'primary' | 'intervener'; reason: string }
  // tool_call: emitted when an agent invokes an MCP/SDK tool. Lets the UI
  // surface what the agent is actually doing — without these, "I'll create
  // the calendar slot" is indistinguishable from a hallucinated promise.
  // toolUseId is the SDK's correlation id; tool_result fires later under
  // the same id with status='ok' or 'error' so the UI can patch the line.
  | { type: 'tool_call'; turnId: string; agentId: string; toolUseId: string; tool: string; argsPreview: string }
  | { type: 'tool_result'; turnId: string; agentId: string; toolUseId: string; status: 'ok' | 'error'; resultPreview: string }
  | { type: 'turn_complete'; turnId: string; costUsd?: number }
  | { type: 'turn_aborted'; turnId: string; clearedAgents: string[] }
  | { type: 'system_note'; turnId?: string; text: string; tone: 'info' | 'warn'; dismissable: boolean }
  | { type: 'divider'; turnId?: string; kind: 'memory_cleared'; text: string }
  | { type: 'meeting_state_update'; pinnedAgent: string | null }
  | { type: 'meeting_ended'; meetingId: string; at: number }
  | { type: 'replay_gap'; sinceSeq: number; oldestSeq: number; latestSeq: number }
  | { type: 'error'; turnId?: string; agentId?: string; message: string; recoverable: boolean }
  | { type: 'ping' };

export interface ChannelEntry {
  seq: number;
  ts: number;
  event: WarRoomTextEvent;
}

export class MeetingChannel {
  private seq = 0;
  private buffer: ChannelEntry[] = [];
  private readonly emitter = new EventEmitter();
  // Tracks last activity so the idle sweeper can evict channels whose
  // meetings were abandoned without /end. Updated on emit/subscribe.
  public lastActivityAt: number = Date.now();
  // Memory guardrail per meeting. A live meeting rarely needs more than a
  // handful of seconds of event history in the buffer — a reconnecting tab
  // resumes in milliseconds. Long-silent resumes fall back to /history.
  public readonly maxBuffer: number;

  // Turns marked as finalized by the queue-level watchdog. Late SDK chunks,
  // agent_done, transcript writes, etc. for these turns are dropped so they
  // can't leak into the next queued turn. Capped to last 32 entries to
  // bound memory; oldest turns are evicted FIFO.
  private readonly finalizedTurns: Set<string> = new Set();
  private readonly finalizedTurnOrder: string[] = [];
  private static readonly FINALIZED_CAP = 32;

  constructor(maxBuffer = 500) {
    this.maxBuffer = maxBuffer;
    this.emitter.setMaxListeners(50);
  }

  /** Emit an event. Returns the assigned seq. Returns -1 (and does not
   *  buffer or fan out) when the event's turnId has been marked finalized,
   *  so late chunks from an abandoned turn can't paint the next turn's
   *  bubbles. */
  emit(event: WarRoomTextEvent): number {
    const eventTurnId = (event as { turnId?: string }).turnId;
    if (eventTurnId && this.finalizedTurns.has(eventTurnId)) {
      return -1;
    }
    const seq = ++this.seq;
    const entry: ChannelEntry = { seq, ts: Date.now(), event };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    this.lastActivityAt = entry.ts;
    this.emitter.emit('ev', entry);
    return seq;
  }

  /** Mark a turn finalized so all subsequent events with this turnId are
   *  dropped. Used by the queue wrapper when its hard watchdog fires.
   *  Idempotent. */
  markTurnFinalized(turnId: string): void {
    if (this.finalizedTurns.has(turnId)) return;
    this.finalizedTurns.add(turnId);
    this.finalizedTurnOrder.push(turnId);
    while (this.finalizedTurnOrder.length > MeetingChannel.FINALIZED_CAP) {
      const evict = this.finalizedTurnOrder.shift();
      if (evict !== undefined) this.finalizedTurns.delete(evict);
    }
  }

  /** True if the given turnId has been marked finalized. Callers (e.g.
   *  runAgentTurn) can check before persisting transcript rows so late
   *  finishers don't insert into a dead turn. */
  isTurnFinalized(turnId: string): boolean {
    return this.finalizedTurns.has(turnId);
  }

  /**
   * Entries with seq > sinceSeq, up to the current ring buffer window.
   * If sinceSeq is older than the oldest buffered seq, the caller should
   * fall back to /history for durable state.
   */
  since(sinceSeq: number): ChannelEntry[] {
    return this.buffer.filter((e) => e.seq > sinceSeq);
  }

  /** The oldest seq currently held in the buffer, or 0 if empty. */
  oldestSeq(): number {
    return this.buffer[0]?.seq ?? 0;
  }

  /** The latest emitted seq. */
  latestSeq(): number {
    return this.seq;
  }

  /** Subscribe to live events. Returns an unsubscribe fn. */
  subscribe(handler: (entry: ChannelEntry) => void): () => void {
    this.lastActivityAt = Date.now();
    this.emitter.on('ev', handler);
    return () => this.emitter.off('ev', handler);
  }

  /** Number of currently active listeners. */
  listenerCount(): number {
    return this.emitter.listenerCount('ev');
  }

  /** Drop all listeners and clear the buffer. Called on meeting /end. */
  close(): void {
    this.emitter.removeAllListeners();
    this.buffer = [];
    this.finalizedTurns.clear();
    this.finalizedTurnOrder.length = 0;
  }
}

const _channels = new Map<string, MeetingChannel>();

export function getChannel(meetingId: string): MeetingChannel {
  let ch = _channels.get(meetingId);
  if (!ch) {
    ch = new MeetingChannel();
    _channels.set(meetingId, ch);
  }
  return ch;
}

export function closeChannel(meetingId: string): void {
  const ch = _channels.get(meetingId);
  if (ch) {
    ch.close();
    _channels.delete(meetingId);
  }
}

/** @internal for tests — clear all channels. */
export function _resetChannels(): void {
  for (const ch of _channels.values()) ch.close();
  _channels.clear();
}

// ── Idle eviction sweeper ───────────────────────────────────────────
// Channels are lazy-created on /text/new and on SSE subscribe. If the
// user abandons a meeting without calling /end (tab close, nav away,
// crash), the channel sits in the Map indefinitely holding a ring buffer
// and an EventEmitter. Periodically evict channels that are truly idle:
// no active listeners AND no activity for the configured TTL. Channels
// with active listeners are never evicted — SSE subscribers would break.
const IDLE_TTL_MS = 60 * 60 * 1000;  // 1 hour
let _sweepTimer: ReturnType<typeof setInterval> | null = null;

function sweepIdleChannels(now = Date.now()) {
  for (const [meetingId, ch] of _channels) {
    if (ch.listenerCount() > 0) continue;
    if (now - ch.lastActivityAt < IDLE_TTL_MS) continue;
    ch.close();
    _channels.delete(meetingId);
  }
}

export function startChannelSweeper(intervalMs = 10 * 60 * 1000): void {
  if (_sweepTimer) return;
  _sweepTimer = setInterval(sweepIdleChannels, intervalMs);
  // Node will wait on the timer when exiting — unref so a clean shutdown
  // doesn't hang.
  if (typeof (_sweepTimer as any).unref === 'function') (_sweepTimer as any).unref();
}

export function stopChannelSweeper(): void {
  if (_sweepTimer) { clearInterval(_sweepTimer); _sweepTimer = null; }
}

/** @internal for tests */
export function _sweepNow(now?: number): void {
  sweepIdleChannels(now);
}
