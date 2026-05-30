// Memory-driven morning brief. Runs at 7am local time every day.
//
// Pulls signal from:
//   - Recent high-importance memories (last 7 days, importance >= 0.6)
//   - Recent consolidations (last 24 hours)
//   - BID outreach state (untouched + needs-followup from store/bid-roster +
//     store/outreach-status)
//   - Cash position (current totals from /api/cash via the same data layer)
//   - Open mission tasks blocked or aging
//
// Composes a short Telegram brief with Gemini, focused on "what changed
// overnight" and "what needs attention today". Skips quietly if the LLM call
// fails so a bad morning doesn't crash the agent.

import fs from 'node:fs';
import path from 'node:path';
import type { Api, RawApi } from 'grammy';

import { ALLOWED_CHAT_ID, GOOGLE_API_KEY, PROJECT_ROOT } from './config.js';
import { getRecentHighImportanceMemories, getRecentConsolidations } from './db.js';
import { generateContent } from './gemini.js';
import { logger } from './logger.js';
import { getCashData } from './cash-data.js';
import { getOutreachData } from './outreach-data.js';

const ROSTER_FILE = path.join(PROJECT_ROOT, 'store', 'bid-roster.json');

function buildOutreachLine(): string {
  try {
    const data = getOutreachData();
    if (data.rows.length === 0) return 'Outreach: BID roster not loaded yet.';
    const untouched = data.rows.filter(r => r.status === 'Not contacted').length;
    const replied = data.rows.filter(r => r.status === 'Replied').length;
    const booked = data.rows.filter(r => r.status === 'Webinar Booked').length;
    const endorsed = data.rows.filter(r => r.status === 'Endorsed').length;
    const followUps = data.rows.filter(r => r.nextAction.toLowerCase().startsWith('follow-up')).length;
    return `Outreach: ${data.rows.length} BIDs total · ${untouched} untouched · ${replied} replied · ${booked} webinar booked · ${endorsed} endorsed${followUps ? ` · ${followUps} need follow-up` : ''}.`;
  } catch (e) { return 'Outreach: data unavailable.'; }
}

async function buildCashLine(): Promise<string> {
  try {
    const cash = await getCashData(false);
    if (cash.connectionStatus !== 'ok') return `Cash: ${cash.connectionStatus}.`;
    const total = (cash.totalCashCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const netCents = cash.mtd.netCents;
    const netStr = (Math.abs(netCents) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const sign = netCents >= 0 ? '+' : '-';
    const runway = cash.runwayDays == null ? 'cash flow positive' : `${cash.runwayDays}d runway`;
    return `Cash: $${total} in checking · MTD net ${sign}$${netStr} · ${runway}.`;
  } catch (e) { return 'Cash: data unavailable.'; }
}

function buildBidRosterLine(): string {
  try {
    const j = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf-8'));
    return `BID roster: ${(j.bids || []).length} entities loaded.`;
  } catch { return ''; }
}

const BRIEF_PROMPT = `You are writing a short morning brief for Dante, a serial entrepreneur running ImpactWorks (an AI agency) and Rocket Local (local marketing platform). He starts his day reading this on Telegram.

Goals:
- Surface what ACTUALLY needs attention today, not a generic recap.
- Lead with the single most important item if there is one.
- Be specific, concrete, and short. He has a tight cash position and is running multi-vector growth (ZAGG franchise rollout, BID Traffic Partnership, existing book).
- Tone: direct, no fluff. Like a sharp chief of staff.

Operational context for today:
{OPERATIONAL_CONTEXT}

Recent high-importance memories (last 7 days):
{MEMORIES}

Recent consolidations (insights derived from memory clusters):
{CONSOLIDATIONS}

Write the brief in Telegram-friendly format (plain text, no markdown headers, line breaks only). Maximum 1500 characters. Structure:

1. ☀️ One-line "today's headline" — the single biggest thing.
2. 1-3 specific actions for today, each prefixed with "→" and ending with a verb (call X, send Y, decide Z).
3. 1-2 watch-items (things to monitor, not act on yet).
4. End with: a one-line nudge or motivational close that fits the day's reality (no platitudes).

If there is nothing notable, say so plainly. Do not invent priorities.`;

export async function runDailyBrief(api: Api<RawApi> | null, chatId: string): Promise<void> {
  if (!api || !chatId || !GOOGLE_API_KEY) {
    logger.info('daily-brief: skipped (no api / chatId / GOOGLE_API_KEY)');
    return;
  }

  // db.ts helpers handle the schema details; we just grab the top-N.
  const memories = getRecentHighImportanceMemories(chatId, 20);
  const consolidations = getRecentConsolidations(chatId, 5);
  const outreachLine = buildOutreachLine();
  const cashLine = await buildCashLine();
  const bidRosterLine = buildBidRosterLine();

  const operationalContext = [cashLine, outreachLine, bidRosterLine].filter(Boolean).join('\n');
  const memoriesBlock = memories.length === 0
    ? '(none in the last 7 days)'
    : memories.map(m => `[importance ${m.importance.toFixed(2)}] ${m.summary}`).join('\n');
  const consolidationsBlock = consolidations.length === 0
    ? '(none in the last 24h)'
    : consolidations.map(c => `- ${c.insight || c.summary}`).join('\n');

  const prompt = BRIEF_PROMPT
    .replace('{OPERATIONAL_CONTEXT}', operationalContext || '(no operational context available)')
    .replace('{MEMORIES}', memoriesBlock)
    .replace('{CONSOLIDATIONS}', consolidationsBlock);

  let brief: string;
  try {
    brief = await generateContent(prompt);
  } catch (e) {
    logger.error({ err: String((e as Error)?.message || e) }, 'daily-brief: gemini call failed');
    return;
  }

  if (!brief || !brief.trim()) {
    logger.warn('daily-brief: empty brief generated, skipping send');
    return;
  }

  try {
    await api.sendMessage(chatId, brief.slice(0, 4000));
    logger.info({ memoryCount: memories.length, length: brief.length }, 'daily-brief: sent');
  } catch (e) {
    logger.error({ err: String((e as Error)?.message || e) }, 'daily-brief: telegram send failed');
  }
}

/** Milliseconds until next 7:00 AM local time. */
export function msUntilNext7am(now = new Date()): number {
  const next = new Date(now);
  next.setHours(7, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}
