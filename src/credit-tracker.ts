/**
 * Credit tracking system for M2AI VAs.
 *
 * Converts token usage costs into credits using bucket thresholds.
 * Enforces monthly credit limits and sends notifications at 80%, 90%, 100%.
 */

import { saveCredits, getCreditsUsedThisPeriod, getCreditLimit, isOverageEnabled, getLastTokenUsageId, getClientConfig } from './db.js';
import { logger } from './logger.js';

/** Map API cost to credit count using bucket thresholds. */
export function costToCredits(costUsd: number): number {
  if (costUsd < 0.01) return 1;
  if (costUsd < 0.05) return Math.max(2, Math.round(costUsd / 0.01));
  if (costUsd < 0.20) return Math.max(5, Math.round(costUsd / 0.015));
  return Math.max(15, Math.round(costUsd / 0.005));
}

export interface CreditResult {
  creditsConsumed: number;
  totalUsed: number;
  limit: number;
  /** Warning message to send to user, or null if no threshold crossed. */
  warning: string | null;
  /** True if the credit limit is reached and overage is disabled. */
  blocked: boolean;
}

/**
 * Record credit consumption after a token usage event.
 * Returns credit result with optional warning/block status.
 */
export function trackCredits(
  chatId: string,
  sessionId: string | undefined,
  costUsd: number,
  reason = 'agent_response',
): CreditResult {
  const limit = getCreditLimit();

  // If no credit limit configured, credits are disabled (personal use / not a client instance)
  if (limit === 0) {
    return { creditsConsumed: 0, totalUsed: 0, limit: 0, warning: null, blocked: false };
  }

  const credits = costToCredits(costUsd);
  const tokenUsageId = getLastTokenUsageId();

  saveCredits(chatId, sessionId, tokenUsageId, credits, costUsd, reason);

  const totalUsed = getCreditsUsedThisPeriod();
  const pct = (totalUsed / limit) * 100;
  const overage = isOverageEnabled();

  let warning: string | null = null;
  let blocked = false;

  if (pct >= 100 && !overage) {
    warning = `Credit limit reached (${Math.round(totalUsed)}/${limit}). Contact your administrator to continue.`;
    blocked = true;
  } else if (pct >= 100 && overage) {
    warning = `Credit limit exceeded (${Math.round(totalUsed)}/${limit}). Overage billing is active.`;
  } else if (pct >= 90) {
    warning = `Credit usage at ${Math.round(pct)}% (${Math.round(totalUsed)}/${limit}).`;
  } else if (pct >= 80) {
    // Only warn at 80% once per session to avoid spam
    const lastWarn = getClientConfig('last_80_warn_session');
    if (lastWarn !== sessionId) {
      warning = `Heads up: credit usage is at ${Math.round(pct)}% (${Math.round(totalUsed)}/${limit}).`;
    }
  }

  if (warning) {
    logger.info({ credits, totalUsed, limit, pct: Math.round(pct) }, 'Credit threshold crossed');
  }

  return { creditsConsumed: credits, totalUsed, limit, warning, blocked };
}

/** Format credit status for the /credits command. */
export function formatCreditStatus(): string {
  const limit = getCreditLimit();
  if (limit === 0) return 'Credit tracking is not configured on this instance.';

  const used = getCreditsUsedThisPeriod();
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const remaining = Math.max(0, limit - used);
  const tier = getClientConfig('tier') || 'unknown';
  const periodStart = getClientConfig('period_start');
  const overage = isOverageEnabled();

  const startDate = periodStart ? new Date(parseInt(periodStart, 10) * 1000).toLocaleDateString() : 'N/A';

  return [
    `Credits: ${Math.round(used)} / ${limit} (${pct}%)`,
    `Remaining: ${Math.round(remaining)}`,
    `Tier: ${tier}`,
    `Period start: ${startDate}`,
    `Overage: ${overage ? 'enabled' : 'disabled'}`,
  ].join('\n');
}
