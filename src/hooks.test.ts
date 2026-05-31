import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createHookRegistry, runHooks } from './hooks.js';
import type { HookContext, HookFn } from './hooks.js';

const baseCtx: HookContext = {
  chatId: '12345',
  agentId: 'main',
  message: 'hello',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createHookRegistry ──────────────────────────────────────────────

describe('createHookRegistry', () => {
  it('returns empty arrays for all hook points', () => {
    const registry = createHookRegistry();
    expect(registry.preMessage).toEqual([]);
    expect(registry.postMessage).toEqual([]);
    expect(registry.onSessionStart).toEqual([]);
    expect(registry.onSessionEnd).toEqual([]);
    expect(registry.onError).toEqual([]);
  });

  it('returns a new object each time', () => {
    const a = createHookRegistry();
    const b = createHookRegistry();
    expect(a).not.toBe(b);
    expect(a.preMessage).not.toBe(b.preMessage);
  });
});

// ── runHooks ────────────────────────────────────────────────────────

describe('runHooks', () => {
  it('executes all hooks in order', async () => {
    const order: number[] = [];

    const hookA: HookFn = async () => { order.push(1); };
    const hookB: HookFn = async () => { order.push(2); };
    const hookC: HookFn = async () => { order.push(3); };

    await runHooks([hookA, hookB, hookC], baseCtx);
    expect(order).toEqual([1, 2, 3]);
  });

  it('passes context to each hook', async () => {
    const received: HookContext[] = [];

    const hook: HookFn = async (ctx) => { received.push(ctx); };
    await runHooks([hook], baseCtx);

    expect(received).toHaveLength(1);
    expect(received[0].chatId).toBe('12345');
    expect(received[0].agentId).toBe('main');
    expect(received[0].message).toBe('hello');
  });

  it('continues execution when a hook throws', async () => {
    const order: number[] = [];

    const hookA: HookFn = async () => { order.push(1); };
    const hookFail: HookFn = async () => { throw new Error('boom'); };
    const hookC: HookFn = async () => { order.push(3); };

    await runHooks([hookA, hookFail, hookC], baseCtx);
    expect(order).toEqual([1, 3]);
  });

  it('handles empty hooks array', async () => {
    // Should not throw
    await expect(runHooks([], baseCtx)).resolves.toBeUndefined();
  });

  it('times out slow hooks and continues', async () => {
    const order: number[] = [];

    const hookFast: HookFn = async () => { order.push(1); };
    const hookSlow: HookFn = () =>
      new Promise((resolve) => {
        // This will never resolve within the 5s timeout during testing
        // We use vi.useFakeTimers to simulate
        setTimeout(resolve, 60000);
      });
    const hookAfter: HookFn = async () => { order.push(3); };

    // Use fake timers to control the timeout
    vi.useFakeTimers();

    const promise = runHooks([hookFast, hookSlow, hookAfter], baseCtx);

    // Fast hook runs immediately
    await vi.advanceTimersByTimeAsync(0);

    // Advance past the 5s hook timeout
    await vi.advanceTimersByTimeAsync(5100);

    // Advance again for the last hook
    await vi.advanceTimersByTimeAsync(0);

    await promise;

    expect(order).toEqual([1, 3]);

    vi.useRealTimers();
  });

  it('does not block on rejected hooks', async () => {
    const hookReject: HookFn = () => Promise.reject(new Error('rejected'));
    const hookOk: HookFn = vi.fn(async () => {});

    await runHooks([hookReject, hookOk], baseCtx);
    expect(hookOk).toHaveBeenCalledOnce();
  });
});
