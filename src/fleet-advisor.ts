/**
 * Fleet Advisor — proactive performance monitoring and recommendations.
 *
 * Periodically analyzes agent performance via hive_mind logs and mission outcomes,
 * then surfaces actionable nudges to the user. Data doesn't act on recommendations
 * directly — it only surfaces them for human review.
 *
 * Nudge format: "[Agent] [Observation] [Recommendation]"
 *
 * Runs on a configurable interval (default: every 6 hours).
 */

import {
  getHiveMindEntries,
  getMissionsByStatus,
  getMissionSubtasks,
  type HiveMindEntry,
  type Mission,
  type MissionSubtask,
} from './db.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface FleetNudge {
  agentId: string;
  observation: string;
  recommendation: string;
  severity: 'info' | 'warning' | 'critical';
}

type Sender = (text: string) => Promise<void>;

// ── Configuration ────────────────────────────────────────────────────

const ADVISOR_INTERVAL_MS = parseInt(
  process.env.FLEET_ADVISOR_INTERVAL_MS || String(6 * 60 * 60 * 1000), // 6 hours
  10,
);

const LOOKBACK_HOURS = 24;

// ── State ────────────────────────────────────────────────────────────

let advisorTimer: ReturnType<typeof setInterval> | null = null;
let send: Sender | null = null;

// ── Initialization ───────────────────────────────────────────────────

export function initFleetAdvisor(sender: Sender): void {
  send = sender;

  // Delay first analysis 10 minutes after startup
  setTimeout(() => {
    void runAdvisorCycle().catch((err) =>
      logger.error({ err }, 'Initial fleet advisor cycle failed'),
    );
  }, 10 * 60 * 1000);

  advisorTimer = setInterval(() => {
    void runAdvisorCycle().catch((err) =>
      logger.error({ err }, 'Fleet advisor cycle failed'),
    );
  }, ADVISOR_INTERVAL_MS);

  logger.info(
    { intervalMs: ADVISOR_INTERVAL_MS },
    'Fleet Advisor initialized',
  );
}

export function stopFleetAdvisor(): void {
  if (advisorTimer) {
    clearInterval(advisorTimer);
    advisorTimer = null;
  }
}

// ── Analysis Engine ──────────────────────────────────────────────────

async function runAdvisorCycle(): Promise<void> {
  const nudges = analyzeFleet();

  if (nudges.length === 0) {
    logger.debug('Fleet Advisor: no nudges this cycle');
    return;
  }

  logger.info({ nudgeCount: nudges.length }, 'Fleet Advisor generated nudges');

  if (!send) return;

  const lines = nudges.map((n) => {
    const icon = n.severity === 'critical' ? '🔴' : n.severity === 'warning' ? '🟡' : '🔵';
    return `${icon} <b>${escapeHtml(n.agentId)}</b>\n${escapeHtml(n.observation)}\n<i>Recommend: ${escapeHtml(n.recommendation)}</i>`;
  });

  const message = `<b>Fleet Status</b>\n\n${lines.join('\n\n')}`;

  try {
    await send(message);
  } catch (err) {
    logger.error({ err }, 'Fleet Advisor: failed to send nudges');
  }
}

/**
 * Analyze recent hive_mind entries and mission outcomes to generate nudges.
 */
export function analyzeFleet(): FleetNudge[] {
  const nudges: FleetNudge[] = [];
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;

  // ── Analyze hive_mind for agent activity and errors ──────────────
  const entries = getHiveMindEntries(200);
  const recentEntries = entries.filter((e) => e.created_at >= cutoff);

  // Group by agent
  const agentActivity = new Map<string, { total: number; errors: number; lastActive: number }>();
  for (const entry of recentEntries) {
    const existing = agentActivity.get(entry.agent_id) ?? { total: 0, errors: 0, lastActive: 0 };
    existing.total++;
    if (entry.action.includes('error') || entry.action.includes('fail')) {
      existing.errors++;
    }
    existing.lastActive = Math.max(existing.lastActive, entry.created_at);
    agentActivity.set(entry.agent_id, existing);
  }

  // Check for agents with high error rates
  for (const [agentId, stats] of agentActivity) {
    if (agentId === 'mission-control') continue; // skip internal
    if (stats.total >= 3 && stats.errors / stats.total >= 0.5) {
      nudges.push({
        agentId,
        observation: `${stats.errors}/${stats.total} recent actions failed (${Math.round(stats.errors / stats.total * 100)}% error rate).`,
        recommendation: 'Review agent CLAUDE.md and recent error logs. Consider adjusting timeout or decomposition granularity.',
        severity: 'warning',
      });
    }
  }

  // ── Analyze recent missions ──────────────────────────────────────
  const recentFailed = getMissionsByStatus('failed', 10);
  const failedRecent = recentFailed.filter((m) => m.created_at >= cutoff);

  if (failedRecent.length >= 3) {
    nudges.push({
      agentId: 'mission-control',
      observation: `${failedRecent.length} missions failed in the last ${LOOKBACK_HOURS}h.`,
      recommendation: 'Review mission goals for clarity. Failed missions may need more specific goals or manual decomposition.',
      severity: 'warning',
    });
  }

  // Check for subtask-level patterns in recent completed missions
  const recentCompleted = getMissionsByStatus('completed', 20);
  const completedRecent = recentCompleted.filter((m) => m.created_at >= cutoff);

  let totalSubtasks = 0;
  let totalCost = 0;
  let slowSubtasks = 0;

  for (const mission of [...completedRecent, ...failedRecent.filter((m) => m.created_at >= cutoff)]) {
    const subtasks = getMissionSubtasks(mission.id);
    for (const st of subtasks) {
      totalSubtasks++;
      totalCost += st.cost_usd;
      if (st.started_at && st.completed_at && (st.completed_at - st.started_at) > 240) {
        slowSubtasks++;
      }
    }
  }

  // Cost warning
  if (totalCost > 1.0) {
    nudges.push({
      agentId: 'mission-control',
      observation: `$${totalCost.toFixed(2)} spent on missions in the last ${LOOKBACK_HOURS}h (${totalSubtasks} subtasks).`,
      recommendation: 'Consider using cheaper models (Haiku) for simple subtasks, or reducing mission scope.',
      severity: totalCost > 5.0 ? 'critical' : 'info',
    });
  }

  // Slow subtask warning
  if (totalSubtasks > 0 && slowSubtasks / totalSubtasks > 0.3) {
    nudges.push({
      agentId: 'mission-control',
      observation: `${slowSubtasks}/${totalSubtasks} subtasks took >4 minutes. Possible bottleneck.`,
      recommendation: 'Decompose large subtasks into smaller units or increase AGENT_TIMEOUT_MS.',
      severity: 'info',
    });
  }

  return nudges;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
