/**
 * Engine interface — pluggable backends for agent invocation.
 *
 * Phase 1 of the SDK Engine RFC (docs/rfc-sdk-engine.md) introduces this
 * interface and the CliEngine wrapper. Phases 2-5 add the SdkEngine
 * (direct Anthropic Messages API) behind the same contract.
 *
 * Only `CliEngine` is implemented in this phase. `runAgent()` in agent.ts
 * delegates to an Engine instance selected at runtime from `ENGINE` config.
 */

/** Options passed to an engine for a single turn. */
export interface EngineOptions {
  /** Session ID to resume, or undefined for a new session. */
  sessionId?: string;
  /** Working directory for tool execution (Bash, file operations). */
  cwd: string;
  /** Optional model override (e.g. 'claude-haiku-4-5'). */
  model?: string;
  /** AbortController for user-initiated cancellation. */
  abortController?: AbortController;
  /** When true, the engine yields `stream_text` events for progressive UI. */
  streamText?: boolean;
  /** When true, the engine yields `progress` events for tool/sub-agent activity. */
  emitProgress?: boolean;
}

/** Per-turn usage metrics surfaced in the final `result` event. */
export interface EngineUsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  totalCostUsd: number;
  /** True if the engine auto-compacted context during this turn. */
  didCompact: boolean;
  /** Token count before compaction (if it happened). */
  preCompactTokens: number | null;
  /** `cache_read_input_tokens` from the LAST API call (real context size). */
  lastCallCacheRead: number;
  /** `input_tokens` from the LAST API call (real context size). */
  lastCallInputTokens: number;
}

/** Progress event — tool invocation or sub-agent lifecycle. */
export interface EngineProgressEvent {
  type: 'task_started' | 'task_completed' | 'tool_active';
  description: string;
}

/**
 * Events yielded by `Engine.invoke()` during a single turn.
 *
 * Errors are thrown (not yielded) to match the current CLI behavior:
 * `runAgent()` already handles abort detection + re-throw in its catch block.
 */
export type EngineEvent =
  | { type: 'init'; sessionId: string }
  | { type: 'progress'; event: EngineProgressEvent }
  | { type: 'stream_text'; accumulatedText: string }
  | { type: 'compact'; preCompactTokens: number | null }
  | { type: 'result'; text: string | null; usage: EngineUsageInfo };

/** Pluggable agent backend. Implementations: CliEngine, SdkEngine (future). */
export interface Engine {
  /**
   * Run a single user message through the backend.
   * Yields events as the engine processes the message (init, tool use,
   * streaming, compact). The final event is always `result`.
   */
  invoke(message: string, options: EngineOptions): AsyncIterable<EngineEvent>;
}
