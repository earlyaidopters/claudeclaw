import type { CostFooterMode } from './config.js';
import type { UsageInfo } from './agent.js';

/**
 * Format token counts for display.
 * 45000 -> "45k", 1200000 -> "1.2M", 500 -> "500"
 */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * Build a cost footer string to append to Telegram responses.
 * Returns empty string if mode is 'off' or no usage data.
 *
 * Modes:
 *   'compact' - model name only (good for subscription users)
 *   'verbose' - model + token counts
 *   'cost'    - model + cost (for pay-per-use users)
 *   'full'    - model + tokens + cost
 *   'off'     - nothing
 */
export function buildCostFooter(
  mode: CostFooterMode,
  usage: UsageInfo | null,
  model?: string,
): string {
  if (mode === 'off' || !usage) return '';

  const modelLabel = model
    ? model.replace('claude-', '').replace(/-\d+[-\d]*$/, '')
    : 'unknown';

  if (mode === 'compact') {
    return `\n\n[${modelLabel}]`;
  }

  if (mode === 'verbose') {
    const inTokens = formatTokens(usage.inputTokens);
    const outTokens = formatTokens(usage.outputTokens);
    return `\n\n[${modelLabel} | ${inTokens} in | ${outTokens} out]`;
  }

  if (mode === 'cost') {
    const cost = `$${usage.totalCostUsd.toFixed(2)}`;
    return `\n\n[${modelLabel} | ${cost}]`;
  }

  if (mode === 'full') {
    const inTokens = formatTokens(usage.inputTokens);
    const outTokens = formatTokens(usage.outputTokens);
    const cost = `$${usage.totalCostUsd.toFixed(2)}`;
    return `\n\n[${modelLabel} | ${inTokens} in | ${outTokens} out | ${cost}]`;
  }

  return '';
}
