/**
 * Engine interface smoke tests.
 *
 * The real contracts live in types (checked by tsc). These runtime checks
 * simply assert that a trivial in-memory implementation satisfies the
 * Engine interface and that the discriminated union on EngineEvent
 * narrows correctly.
 */

import { describe, it, expect } from 'vitest';
import type {
  Engine,
  EngineEvent,
  EngineOptions,
  EngineUsageInfo,
} from './engine.js';

const fakeUsage: EngineUsageInfo = {
  inputTokens: 10,
  outputTokens: 5,
  cacheReadInputTokens: 0,
  totalCostUsd: 0.0001,
  didCompact: false,
  preCompactTokens: null,
  lastCallCacheRead: 0,
  lastCallInputTokens: 10,
};

class InMemoryEngine implements Engine {
  async *invoke(message: string, _options: EngineOptions): AsyncIterable<EngineEvent> {
    yield { type: 'init', sessionId: 'mem-1' };
    yield { type: 'stream_text', accumulatedText: `echo: ${message}` };
    yield { type: 'result', text: `echo: ${message}`, usage: fakeUsage };
  }
}

describe('Engine interface', () => {
  it('accepts an in-memory implementation and yields init → stream → result', async () => {
    const engine = new InMemoryEngine();
    const events: EngineEvent[] = [];
    for await (const ev of engine.invoke('ping', { cwd: '/tmp' })) {
      events.push(ev);
    }
    expect(events.map((e) => e.type)).toEqual(['init', 'stream_text', 'result']);
  });

  it('narrows the EngineEvent discriminated union by `type`', () => {
    const events: EngineEvent[] = [
      { type: 'init', sessionId: 's' },
      { type: 'stream_text', accumulatedText: 'hi' },
      { type: 'compact', preCompactTokens: 100 },
      { type: 'result', text: null, usage: fakeUsage },
    ];
    const kinds: string[] = [];
    for (const ev of events) {
      switch (ev.type) {
        case 'init':
          kinds.push(`init:${ev.sessionId}`);
          break;
        case 'stream_text':
          kinds.push(`stream:${ev.accumulatedText}`);
          break;
        case 'compact':
          kinds.push(`compact:${ev.preCompactTokens}`);
          break;
        case 'result':
          kinds.push(`result:${ev.text ?? 'null'}`);
          break;
        case 'progress':
          kinds.push('progress');
          break;
      }
    }
    expect(kinds).toEqual(['init:s', 'stream:hi', 'compact:100', 'result:null']);
  });
});
