import { describe, it, expect } from 'vitest';
import { buildCostFooter } from './cost-footer.js';
import type { UsageInfo } from './agent.js';

function makeUsage(overrides: Partial<UsageInfo> = {}): UsageInfo {
  return {
    inputTokens: 45000,
    outputTokens: 2100,
    cacheReadInputTokens: 40000,
    totalCostUsd: 0.04,
    didCompact: false,
    preCompactTokens: null,
    lastCallCacheRead: 40000,
    lastCallInputTokens: 45000,
    ...overrides,
  };
}

describe('buildCostFooter', () => {
  it('returns empty string when mode is off', () => {
    expect(buildCostFooter('off', makeUsage())).toBe('');
  });

  it('returns empty string when usage is null', () => {
    expect(buildCostFooter('compact', null)).toBe('');
  });

  it('compact mode shows model only (no cost)', () => {
    const result = buildCostFooter('compact', makeUsage(), 'claude-opus-4-6');
    expect(result).toContain('opus');
    expect(result).not.toContain('$');
    expect(result).not.toContain('45k');
  });

  it('verbose mode shows model + tokens (no cost)', () => {
    const result = buildCostFooter('verbose', makeUsage(), 'claude-opus-4-6');
    expect(result).toContain('opus');
    expect(result).toContain('45k in');
    expect(result).toContain('2k out');
    expect(result).not.toContain('$');
  });

  it('cost mode shows model + cost (no tokens)', () => {
    const result = buildCostFooter('cost', makeUsage(), 'claude-opus-4-6');
    expect(result).toContain('opus');
    expect(result).toContain('$0.04');
    expect(result).not.toContain('45k in');
  });

  it('full mode shows model + tokens + cost', () => {
    const result = buildCostFooter('full', makeUsage(), 'claude-opus-4-6');
    expect(result).toContain('opus');
    expect(result).toContain('45k in');
    expect(result).toContain('2k out');
    expect(result).toContain('$0.04');
  });

  it('formats large token counts with M suffix', () => {
    const result = buildCostFooter('verbose', makeUsage({ inputTokens: 1_200_000 }), 'claude-opus-4-6');
    expect(result).toContain('1.2M in');
  });

  it('formats small token counts without suffix', () => {
    const result = buildCostFooter('verbose', makeUsage({ outputTokens: 500 }), 'claude-opus-4-6');
    expect(result).toContain('500 out');
  });

  it('handles missing model gracefully', () => {
    const result = buildCostFooter('compact', makeUsage());
    expect(result).toContain('unknown');
  });

  it('strips claude- prefix from model name', () => {
    const result = buildCostFooter('compact', makeUsage(), 'claude-sonnet-4-6');
    expect(result).toContain('sonnet');
    expect(result).not.toContain('claude-');
  });
});
