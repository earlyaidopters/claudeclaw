import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { trackUsage, getRateStatus, resetRateTracker } from './rate-tracker.js';

describe('rate-tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Message tracking ──────────────────────────────────────────────

  it('tracks 5 messages -> messagesPerMinute is 5', () => {
    for (let i = 0; i < 5; i++) {
      trackUsage(100, 0.01);
    }
    const status = getRateStatus(10, 100_000);
    expect(status.messagesPerMinute).toBe(5);
  });

  // ── Token tracking ────────────────────────────────────────────────

  it('tracks usage -> tokensPerHour is correct', () => {
    trackUsage(500, 0.01);
    trackUsage(1500, 0.02);
    trackUsage(1000, 0.01);
    const status = getRateStatus(10, 100_000);
    expect(status.tokensPerHour).toBe(3000);
  });

  // ── Cost tracking ─────────────────────────────────────────────────

  it('tracks cost -> costToday is correct', () => {
    trackUsage(100, 0.50);
    trackUsage(100, 0.30);
    trackUsage(100, 0.20);
    const status = getRateStatus(10, 100_000);
    expect(status.costToday).toBeCloseTo(1.0);
  });

  // ── Expiration ────────────────────────────────────────────────────

  it('message entries expire after 1 minute', () => {
    trackUsage(100, 0.01);
    trackUsage(100, 0.01);

    // Advance 61 seconds
    vi.advanceTimersByTime(61_000);

    const status = getRateStatus(10, 100_000);
    expect(status.messagesPerMinute).toBe(0);
  });

  it('token entries expire after 1 hour', () => {
    trackUsage(5000, 0.10);

    // Advance 61 minutes
    vi.advanceTimersByTime(61 * 60 * 1000);

    const status = getRateStatus(10, 100_000);
    expect(status.tokensPerHour).toBe(0);
  });

  it('cost entries expire after 24 hours', () => {
    trackUsage(100, 5.00);

    // Advance 24h + 1s
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);

    const status = getRateStatus(10, 100_000);
    expect(status.costToday).toBe(0);
  });

  // ── Warning thresholds ────────────────────────────────────────────

  it('generates warning at 80% of token budget', () => {
    trackUsage(8000, 0.01);
    const status = getRateStatus(10, 10_000);
    expect(status.warnings.length).toBeGreaterThan(0);
    expect(status.warnings.some((w) => w.includes('Token usage high'))).toBe(true);
  });

  it('generates strong warning at 95% of token budget', () => {
    trackUsage(9500, 0.01);
    const status = getRateStatus(10, 10_000);
    expect(status.warnings.some((w) => w.includes('Token usage critical'))).toBe(true);
  });

  it('generates warning at 80% of daily cost budget', () => {
    trackUsage(100, 8.00);
    const status = getRateStatus(10, 100_000);
    expect(status.warnings.some((w) => w.includes('Daily cost high'))).toBe(true);
  });

  it('generates strong warning at 95% of daily cost budget', () => {
    trackUsage(100, 9.50);
    const status = getRateStatus(10, 100_000);
    expect(status.warnings.some((w) => w.includes('Daily cost critical'))).toBe(true);
  });

  it('no warnings when under budget', () => {
    trackUsage(100, 0.01);
    const status = getRateStatus(10, 100_000);
    expect(status.warnings).toEqual([]);
  });

  // ── Reset ─────────────────────────────────────────────────────────

  it('resetRateTracker clears all state', () => {
    trackUsage(5000, 5.00);
    trackUsage(5000, 5.00);
    resetRateTracker();

    const status = getRateStatus(10, 10_000);
    expect(status.messagesPerMinute).toBe(0);
    expect(status.tokensPerHour).toBe(0);
    expect(status.costToday).toBe(0);
    expect(status.warnings).toEqual([]);
  });

  // ── Multiple rapid calls ──────────────────────────────────────────

  it('multiple rapid calls count each call separately', () => {
    trackUsage(100, 0.01);
    trackUsage(200, 0.02);
    trackUsage(300, 0.03);

    const status = getRateStatus(10, 100_000);
    expect(status.messagesPerMinute).toBe(3);
    expect(status.tokensPerHour).toBe(600);
    expect(status.costToday).toBeCloseTo(0.06);
  });

  // ── Warnings are human-readable strings ───────────────────────────

  it('warnings array contains human-readable strings', () => {
    trackUsage(9500, 9.60);
    const status = getRateStatus(10, 10_000);

    for (const warning of status.warnings) {
      expect(typeof warning).toBe('string');
      expect(warning.length).toBeGreaterThan(10);
    }
    // Should have both token and cost warnings
    expect(status.warnings.length).toBe(2);
  });
});
