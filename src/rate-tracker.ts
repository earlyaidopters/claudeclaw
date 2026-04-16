/**
 * In-memory sliding window rate tracker for API usage.
 *
 * Tracks messages per minute, tokens per hour, and cost per day
 * using simple arrays that get pruned on each status check.
 * All state resets on process restart.
 */

export interface RateStatus {
  messagesPerMinute: number;
  tokensPerHour: number;
  costToday: number;
  warnings: string[];
}

interface TimestampedTokens {
  timestamp: number;
  tokens: number;
}

interface TimestampedCost {
  timestamp: number;
  cost: number;
}

// Sliding window storage
let messageTimestamps: number[] = [];
let tokenEntries: TimestampedTokens[] = [];
let costEntries: TimestampedCost[] = [];

// Window durations in ms
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Record a usage event (one message with associated token count and cost).
 */
export function trackUsage(tokens: number, cost: number): void {
  const now = Date.now();
  messageTimestamps.push(now);
  tokenEntries.push({ timestamp: now, tokens });
  costEntries.push({ timestamp: now, cost });
}

/**
 * Get current rate status and generate warnings if approaching limits.
 *
 * @param dailyBudget - Maximum cost (USD) allowed per 24h window
 * @param hourlyTokenBudget - Maximum tokens allowed per 1h window
 */
export function getRateStatus(dailyBudget: number, hourlyTokenBudget: number): RateStatus {
  const now = Date.now();

  // Prune expired entries
  messageTimestamps = messageTimestamps.filter((ts) => now - ts < ONE_MINUTE);
  tokenEntries = tokenEntries.filter((e) => now - e.timestamp < ONE_HOUR);
  costEntries = costEntries.filter((e) => now - e.timestamp < ONE_DAY);

  const messagesPerMinute = messageTimestamps.length;
  const tokensPerHour = tokenEntries.reduce((sum, e) => sum + e.tokens, 0);
  const costToday = costEntries.reduce((sum, e) => sum + e.cost, 0);

  const warnings: string[] = [];

  // Token warnings (skip if budget is 0, meaning disabled)
  const tokenRatio = hourlyTokenBudget > 0 ? tokensPerHour / hourlyTokenBudget : 0;
  if (tokenRatio >= 0.95) {
    warnings.push(`Token usage critical: ${tokensPerHour} of ${hourlyTokenBudget} hourly tokens used (${Math.round(tokenRatio * 100)}%)`);
  } else if (tokenRatio >= 0.8) {
    warnings.push(`Token usage high: ${tokensPerHour} of ${hourlyTokenBudget} hourly tokens used (${Math.round(tokenRatio * 100)}%)`);
  }

  // Cost warnings (skip if budget is 0, meaning disabled)
  const costRatio = dailyBudget > 0 ? costToday / dailyBudget : 0;
  if (costRatio >= 0.95) {
    warnings.push(`Daily cost critical: $${costToday.toFixed(2)} of $${dailyBudget.toFixed(2)} budget used (${Math.round(costRatio * 100)}%)`);
  } else if (costRatio >= 0.8) {
    warnings.push(`Daily cost high: $${costToday.toFixed(2)} of $${dailyBudget.toFixed(2)} budget used (${Math.round(costRatio * 100)}%)`);
  }

  return { messagesPerMinute, tokensPerHour, costToday, warnings };
}

/**
 * Clear all tracked state. Useful for testing.
 */
export function resetRateTracker(): void {
  messageTimestamps = [];
  tokenEntries = [];
  costEntries = [];
}
