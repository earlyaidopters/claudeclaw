/**
 * Tests for CliEngine (Phase 1 of the SDK Engine RFC).
 *
 * The real Claude Agent SDK `query()` spawns the `claude` CLI subprocess,
 * which would call Anthropic APIs. We mock `query` so each test can feed
 * a scripted event stream and assert the engine's translation into
 * `EngineEvent`s.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config.js', () => ({
  agentMcpAllowlist: undefined,
}));

vi.mock('../env.js', () => ({
  readEnvFile: vi.fn(() => ({})),
}));

// agent.js imports config/env/logger too, which are already mocked above.
vi.mock('../agent.js', () => ({
  loadMcpServers: vi.fn(() => ({})),
}));

const queryMock = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { CliEngine } from './cli-engine.js';
import type { EngineEvent } from './engine.js';

/** Build an async generator from an array of scripted SDK events. */
function scriptedQuery(events: unknown[]): AsyncGenerator<unknown> {
  async function* gen() {
    for (const e of events) yield e;
  }
  return gen();
}

async function collect(engine: CliEngine, message: string, options: Record<string, unknown> = {}): Promise<EngineEvent[]> {
  const out: EngineEvent[] = [];
  for await (const ev of engine.invoke(message, { cwd: '/tmp/test', ...options })) {
    out.push(ev);
  }
  return out;
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('CliEngine', () => {
  it('yields an init event when the SDK emits system/init', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 'sess-123' },
        { type: 'result', subtype: 'success', result: 'hi', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'ping');
    expect(events[0]).toEqual({ type: 'init', sessionId: 'sess-123' });
  });

  it('yields a compact event with preCompactTokens from compact_boundary', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'system',
          subtype: 'compact_boundary',
          compact_metadata: { trigger: 'auto', pre_tokens: 42000 },
        },
        { type: 'result', subtype: 'success', result: 'ok', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi');
    const compact = events.find((e) => e.type === 'compact');
    expect(compact).toEqual({ type: 'compact', preCompactTokens: 42000 });
  });

  it('yields progress events for tool_use blocks when emitProgress is true', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'running...' },
              { type: 'tool_use', name: 'Read' },
              { type: 'tool_use', name: 'Bash' },
            ],
            usage: { input_tokens: 100, cache_read_input_tokens: 0 },
          },
        },
        { type: 'result', subtype: 'success', result: 'done', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi', { emitProgress: true });
    const progress = events.filter((e) => e.type === 'progress');
    expect(progress).toEqual([
      { type: 'progress', event: { type: 'tool_active', description: 'Reading file' } },
      { type: 'progress', event: { type: 'tool_active', description: 'Running command' } },
    ]);
  });

  it('suppresses tool progress when emitProgress is false', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'tool_use', name: 'Read' }],
            usage: { input_tokens: 10 },
          },
        },
        { type: 'result', subtype: 'success', result: 'done', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi', { emitProgress: false });
    expect(events.some((e) => e.type === 'progress')).toBe(false);
  });

  it('yields progress for sub-agent task_started and task_notification', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        { type: 'system', subtype: 'task_started', description: 'Spawning analyst' },
        { type: 'system', subtype: 'task_notification', summary: 'analyst done', status: 'completed' },
        { type: 'system', subtype: 'task_notification', summary: 'second task', status: 'failed' },
        { type: 'result', subtype: 'success', result: 'ok', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi', { emitProgress: true });
    const progress = events.filter((e) => e.type === 'progress').map((e) =>
      e.type === 'progress' ? e.event : null,
    );
    expect(progress).toEqual([
      { type: 'task_started', description: 'Spawning analyst' },
      { type: 'task_completed', description: 'analyst done' },
      { type: 'task_completed', description: 'Failed: second task' },
    ]);
  });

  it('accumulates stream_event text deltas into stream_text when streamText is true', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'stream_event',
          parent_tool_use_id: null,
          event: { type: 'message_start' },
        },
        {
          type: 'stream_event',
          parent_tool_use_id: null,
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          },
        },
        {
          type: 'stream_event',
          parent_tool_use_id: null,
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' },
          },
        },
        { type: 'result', subtype: 'success', result: 'Hello world', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi', { streamText: true });
    const streams = events.filter((e) => e.type === 'stream_text');
    expect(streams).toEqual([
      { type: 'stream_text', accumulatedText: 'Hello' },
      { type: 'stream_text', accumulatedText: 'Hello world' },
    ]);
  });

  it('ignores stream deltas from nested tool invocations (parent_tool_use_id != null)', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'stream_event',
          parent_tool_use_id: 'tool-abc',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'internal reasoning' },
          },
        },
        { type: 'result', subtype: 'success', result: 'final', usage: {} },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi', { streamText: true });
    expect(events.some((e) => e.type === 'stream_text')).toBe(false);
  });

  it('emits a result event with parsed usage and cost on SDK result', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        {
          type: 'assistant',
          message: {
            content: [],
            usage: { input_tokens: 1000, cache_read_input_tokens: 500 },
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'done',
          total_cost_usd: 0.0123,
          usage: {
            input_tokens: 1200,
            output_tokens: 80,
            cache_read_input_tokens: 500,
          },
        },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi');
    const last = events[events.length - 1];
    expect(last).toEqual({
      type: 'result',
      text: 'done',
      usage: {
        inputTokens: 1200,
        outputTokens: 80,
        cacheReadInputTokens: 500,
        totalCostUsd: 0.0123,
        didCompact: false,
        preCompactTokens: null,
        lastCallCacheRead: 500,
        lastCallInputTokens: 1000,
      },
    });
  });

  it('terminates the async iterable after the result event', async () => {
    queryMock.mockImplementation(() =>
      scriptedQuery([
        { type: 'system', subtype: 'init', session_id: 's1' },
        { type: 'result', subtype: 'success', result: 'stop', usage: {} },
        { type: 'system', subtype: 'init', session_id: 'should-not-appear' },
      ]),
    );
    const events = await collect(new CliEngine(), 'hi');
    // The trailing bogus event must not be consumed — CliEngine returns
    // after the first result.
    const inits = events.filter((e) => e.type === 'init');
    expect(inits).toHaveLength(1);
    expect(events[events.length - 1].type).toBe('result');
  });
});
