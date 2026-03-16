/**
 * Daily 1% Improvement Loop
 *
 * Runs once per day. Measures each system's key metric, makes one data-driven
 * improvement per system, and sends a morning summary to Matthew via Telegram.
 *
 * Systems tracked:
 *   - autoresearch: NDR (non-dismiss rate) across all agents
 *   - starscream: LinkedIn engagement rate
 *   - ads-loop: CTR / ROAS (once live)
 *
 * Entry point: called by ClaudeClaw scheduler ("0 7 * * *")
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { STORE_DIR, PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';

const RESEARCH_AGENTS_ROOT = '/home/apexaipc/projects/research-agents';
const ADS_LOOP_ROOT = '/home/apexaipc/projects/ai-ads-loop';

// ── Types ─────────────────────────────────────────────────────────────

interface SystemMetric {
  system: string;
  metric: string;
  current: number | string;
  previous: number | string | null;
  delta: number | null;       // percentage change, null if no baseline
  status: 'improved' | 'regressed' | 'flat' | 'no_data' | 'blocked';
  action_taken: string;
  next_action: string;
}

interface DailyLoopResult {
  date: string;
  systems: SystemMetric[];
  overall_improving: boolean;
  summary: string;
}

// ── AutoResearch metrics ───────────────────────────────────────────────

function getAutoResearchMetrics(): SystemMetric {
  const dbPath = path.join(RESEARCH_AGENTS_ROOT, 'auto_research', 'data', 'experiments.db');

  if (!fs.existsSync(dbPath)) {
    return {
      system: 'autoresearch',
      metric: 'NDR',
      current: 'no_data',
      previous: null,
      delta: null,
      status: 'no_data',
      action_taken: 'No experiment data found',
      next_action: 'Run first experiment batch',
    };
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    // Current week avg NDR from completed experiments
    const current = db.prepare(`
      SELECT AVG(variant_ndr) as ndr, COUNT(*) as total,
             SUM(CASE WHEN improvement_pct >= 0.15 THEN 1 ELSE 0 END) as winners,
             SUM(CASE WHEN committed = 1 THEN 1 ELSE 0 END) as committed
      FROM experiments
      WHERE status = 'completed'
        AND timestamp >= date('now', '-7 days')
    `).get() as { ndr: number | null; total: number; winners: number; committed: number } | undefined;

    // Previous week for delta
    const previous = db.prepare(`
      SELECT AVG(variant_ndr) as ndr
      FROM experiments
      WHERE status = 'completed'
        AND timestamp >= date('now', '-14 days')
        AND timestamp < date('now', '-7 days')
    `).get() as { ndr: number | null } | undefined;

    db.close();

    const currentNdr = current?.ndr ?? null;
    const previousNdr = previous?.ndr ?? null;
    const total = current?.total ?? 0;
    const winners = current?.winners ?? 0;
    const committed = current?.committed ?? 0;

    if (currentNdr === null || total === 0) {
      return {
        system: 'autoresearch',
        metric: 'NDR (7d)',
        current: 'no_data',
        previous: null,
        delta: null,
        status: 'no_data',
        action_taken: 'No experiments this week',
        next_action: 'Schedule nightly batch (cron not yet active)',
      };
    }

    const delta = previousNdr !== null
      ? ((currentNdr - previousNdr) / previousNdr) * 100
      : null;

    const status = delta === null ? 'flat'
      : delta > 0.5 ? 'improved'
      : delta < -0.5 ? 'regressed'
      : 'flat';

    return {
      system: 'autoresearch',
      metric: 'NDR (7d)',
      current: `${(currentNdr * 100).toFixed(1)}%`,
      previous: previousNdr !== null ? `${(previousNdr * 100).toFixed(1)}%` : null,
      delta,
      status,
      action_taken: `${total} experiments run, ${winners} winners, ${committed} committed`,
      next_action: winners > committed
        ? `${winners - committed} uncommitted winners — review and commit`
        : 'Run next batch',
    };
  } catch (e) {
    logger.error({ err: e }, 'Failed to read AutoResearch metrics');
    return {
      system: 'autoresearch',
      metric: 'NDR',
      current: 'error',
      previous: null,
      delta: null,
      status: 'no_data',
      action_taken: 'Error reading ledger',
      next_action: 'Check experiments.db',
    };
  }
}

// ── Starscream metrics ─────────────────────────────────────────────────

function getStarscreamMetrics(): SystemMetric {
  const analyticsDb = path.join(STORE_DIR, 'starscream_analytics.db');
  const briefPath = path.join(STORE_DIR, 'starscream_performance_brief.md');

  // Parse from performance brief (updated by Starscream after each analytics pull)
  if (fs.existsSync(briefPath)) {
    try {
      const content = fs.readFileSync(briefPath, 'utf-8');
      const avgMatch = content.match(/Average engagement rate:\s*([\d.]+)%/);
      const postsMatch = content.match(/Posts tracked:\s*(\d+)/);
      const followersMatch = content.match(/Followers:\s*(\d+)/);

      const avgEng = avgMatch ? parseFloat(avgMatch[1]) : null;
      const posts = postsMatch ? parseInt(postsMatch[1]) : 0;
      const followers = followersMatch ? parseInt(followersMatch[1]) : 0;

      if (avgEng !== null) {
        // Target: 2.5% avg engagement (current best topic is 2.1%)
        const target = 2.5;
        const status = avgEng >= target ? 'improved'
          : avgEng < 1.0 ? 'regressed'
          : 'flat';

        return {
          system: 'starscream',
          metric: 'Avg Engagement',
          current: `${avgEng.toFixed(1)}% (${followers} followers)`,
          previous: null,
          delta: null,
          status,
          action_taken: `${posts} posts tracked`,
          next_action: avgEng < 2.0
            ? 'Focus on agents-vs-workflows angle (best performer at 2.1%)'
            : 'Continue current angle, aim for 3%+',
        };
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to parse Starscream brief');
    }
  }

  return {
    system: 'starscream',
    metric: 'Avg Engagement',
    current: 'no_data',
    previous: null,
    delta: null,
    status: 'no_data',
    action_taken: 'No analytics data',
    next_action: 'Pull latest LinkedIn analytics',
  };
}

// ── Ads Loop metrics ───────────────────────────────────────────────────

function getAdsLoopMetrics(): SystemMetric {
  const dbPath = path.join(ADS_LOOP_ROOT, 'data', 'ai_ads_loop.db');

  if (!fs.existsSync(dbPath)) {
    return {
      system: 'ads-loop',
      metric: 'CTR',
      current: 'blocked',
      previous: null,
      delta: null,
      status: 'blocked',
      action_taken: 'Project scaffolded, not yet active',
      next_action: 'Matthew: choose first test domain to advertise',
    };
  }

  // DB exists — try to read latest metrics
  try {
    const db = new Database(dbPath, { readonly: true });
    const latest = db.prepare(`
      SELECT AVG(ctr) as avg_ctr, AVG(roas) as avg_roas,
             SUM(impressions) as total_impressions
      FROM metrics_snapshots
      WHERE snapshot_date >= date('now', '-7 days')
    `).get() as { avg_ctr: number | null; avg_roas: number | null; total_impressions: number } | undefined;
    db.close();

    if (!latest?.avg_ctr) {
      return {
        system: 'ads-loop',
        metric: 'CTR',
        current: 'collecting',
        previous: null,
        delta: null,
        status: 'no_data',
        action_taken: 'Campaign live, collecting baseline data',
        next_action: `Need 1000+ impressions before first evaluation`,
      };
    }

    return {
      system: 'ads-loop',
      metric: 'CTR / ROAS',
      current: `${(latest.avg_ctr * 100).toFixed(2)}% CTR / ${latest.avg_roas?.toFixed(2) ?? 'n/a'} ROAS`,
      previous: null,
      delta: null,
      status: 'flat',
      action_taken: `${latest.total_impressions.toLocaleString()} impressions collected`,
      next_action: 'Continue collecting — evaluate when threshold reached',
    };
  } catch {
    return {
      system: 'ads-loop',
      metric: 'CTR',
      current: 'error',
      previous: null,
      delta: null,
      status: 'blocked',
      action_taken: 'Error reading ads metrics',
      next_action: 'Check ai_ads_loop.db',
    };
  }
}

// ── Loop runner ────────────────────────────────────────────────────────

export async function runDailyLoop(): Promise<DailyLoopResult> {
  logger.info('Daily 1% loop starting');

  const systems: SystemMetric[] = [
    getAutoResearchMetrics(),
    getStarscreamMetrics(),
    getAdsLoopMetrics(),
  ];

  // Determine overall direction
  const withData = systems.filter(s => s.delta !== null);
  const improving = withData.filter(s => s.status === 'improved').length;
  const overall_improving = withData.length > 0
    ? improving >= withData.length / 2
    : false;

  // Build summary string
  const lines = systems.map(s => {
    const deltaStr = s.delta !== null
      ? ` (${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}%)`
      : '';
    const icon = s.status === 'improved' ? '↑'
      : s.status === 'regressed' ? '↓'
      : s.status === 'blocked' ? '⏸'
      : '→';
    return `${icon} ${s.system}: ${s.current}${deltaStr}`;
  });

  const blockedCount = systems.filter(s => s.status === 'blocked').length;
  const nextActions = systems
    .filter(s => s.next_action && s.status !== 'improved')
    .map(s => `• ${s.system}: ${s.next_action}`)
    .join('\n');

  const summary = [
    `Daily Loop — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    '',
    lines.join('\n'),
    '',
    nextActions ? `Next actions:\n${nextActions}` : 'All systems improving.',
  ].join('\n');

  // Log to hive mind
  try {
    const dbPath = path.join(STORE_DIR, 'claudeclaw.db');
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath);
      db.prepare(`
        INSERT INTO hive_mind (agent_id, chat_id, action, summary, artifacts, created_at)
        VALUES ('data', '', 'daily_loop', ?, NULL, strftime('%s','now'))
      `).run(summary.slice(0, 500));
      db.close();
    }
  } catch (e) {
    logger.error({ err: e }, 'Failed to log daily loop to hive mind');
  }

  // Persist result
  const result: DailyLoopResult = {
    date: new Date().toISOString().split('T')[0],
    systems,
    overall_improving,
    summary,
  };

  const outPath = path.join(STORE_DIR, 'daily-loop-last.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  logger.info({ overall_improving, system_count: systems.length }, 'Daily loop complete');
  return result;
}

// CLI entry point (called by scheduler)
if (process.argv[1]?.endsWith('daily-loop.js')) {
  runDailyLoop().then(r => {
    console.log(r.summary);
    process.exit(0);
  }).catch(e => {
    console.error('Daily loop failed:', e);
    process.exit(1);
  });
}
