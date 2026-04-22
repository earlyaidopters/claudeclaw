#!/usr/bin/env tsx
/**
 * Import OpenClaw scheduled jobs into ClaudeClaw's scheduled_tasks table.
 *
 * Usage:
 *   npx tsx scripts/import-openclaw-schedule.ts [--dry-run]
 *
 * Prerequisites:
 *   - Migration v1.2.1 applied (model column must exist on scheduled_tasks)
 *   - /tmp/migrate-jobs.json must exist
 */

import { randomBytes } from 'crypto';
import fs from 'fs';
import Database from 'better-sqlite3';
import path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), 'store', 'claudeclaw.db');
const SOURCE_PATH = '/tmp/migrate-jobs.json';
const DRY_RUN = process.argv.includes('--dry-run');

// ── Agent mapping ────────────────────────────────────────────────────────────

const AGENT_MAP: Record<string, string> = {
  main: 'main',
  heartbeat: 'main',
  scout: 'research',
  'content-creator': 'content',
  'speed-to-lead': 'comms',
};

function mapAgent(ocAgent: string | null | undefined): string {
  if (!ocAgent) return 'main';
  const mapped = AGENT_MAP[ocAgent];
  if (!mapped) throw new Error(`Unknown oc_agent: "${ocAgent}". Add it to AGENT_MAP before importing.`);
  return mapped;
}

// ── Model mapping ─────────────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  'openai-codex/gpt-5.4': 'opus',
  'openai-codex/gpt-5.4-mini': 'sonnet',
  'openai/gpt-5.1-codex': 'sonnet',
};

// Jobs that should be downgraded from their default tier based on actual prompt needs
const MODEL_OVERRIDES: Record<string, string> = {
  'Morning Brief Coordinator': 'sonnet',
  'background-research': 'sonnet',
  'Scout Research Sweep — Visual (6:00 AM)': 'sonnet',
  'DION EAS Nightly Build': 'sonnet',
};

function mapModel(ocModel: string, name: string): string {
  if (MODEL_OVERRIDES[name]) return MODEL_OVERRIDES[name];
  const mapped = MODEL_MAP[ocModel];
  if (!mapped) throw new Error(`Unknown source model: "${ocModel}" (job: "${name}"). Add to MODEL_MAP.`);
  return mapped;
}

// ── Phase assignment ──────────────────────────────────────────────────────────

const PHASE_1_KEYWORDS = [
  'morning-brief',
  'midday-check',
  'eod-report',
  'daily-reflection',
  'daily-summary-check',
  'calendar-manager',
];

function isPhase1(name: string): boolean {
  // Normalise both sides: lowercase and collapse hyphens/spaces so
  // "morning-brief" matches "Morning Brief Coordinator" and vice versa.
  const normalised = name.toLowerCase().replace(/-/g, ' ');
  return PHASE_1_KEYWORDS.some((kw) => normalised.includes(kw.replace(/-/g, ' ')));
}

// ── Cron normalisation ────────────────────────────────────────────────────────

function normaliseCron(raw: string): string {
  const trimmed = raw.trim();
  // Handle openclaw's non-standard every-N-ms format: {'kind':'every','everyMs':1800000,...}
  const everyMatch = trimmed.match(/'everyMs'\s*:\s*(\d+)/);
  if (everyMatch) {
    const ms = parseInt(everyMatch[1], 10);
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.round(minutes / 60);
    return `0 */${hours} * * *`;
  }
  return trimmed;
}

// ── Compute next run ──────────────────────────────────────────────────────────

import { CronExpressionParser } from 'cron-parser';

function computeNextRun(cron: string): number {
  const interval = CronExpressionParser.parse(cron);
  return Math.floor(interval.next().getTime() / 1000);
}

// ── Synthetic tasks ───────────────────────────────────────────────────────────

interface SyntheticTask {
  name: string;
  prompt: string;
  cron: string;
  model: string;
  agentId: string;
}

const SYNTHETIC_TASKS: SyntheticTask[] = [
  {
    name: 'Proactive Builder Planner',
    prompt: `You are the Proactive Builder Planner. Your job is to PICK the right task — not execute it.

1. Check Kanban: node /Users/aditya_office_ai_assistant/clawd/scripts/utils/kanban-check.mjs
2. If Kanban has TODOs: pick the highest-priority one. Read its full context (description, tags, related files, prior notes).
3. If no Kanban tasks: scan memory/2026-*.md for unresolved items, then stale blog posts (>90 days), then scripts needing maintenance.
4. Pick exactly ONE task. Think hard about what would actually deliver value tonight.
5. Write an EXECUTION BRIEF to /Users/aditya_office_ai_assistant/clawd/memory/proactive-builder-brief.json with:
   - task_title
   - source (kanban_id | memory_file | stale_blog | script)
   - context: full background needed to execute cold (the executor has no memory of this)
   - success_criteria: 2-4 bullet points of "done means..."
   - files_to_touch: array of absolute paths
   - subagents_to_spawn: array of {role, prompt} or empty
   - estimated_complexity: low|medium|high
   - timestamp: unix seconds

Do NOT execute the task. Do NOT write code. Just plan.

If nothing worth doing tonight, write {"task_title": "SKIP", "reason": "..."} and stop.`,
    cron: '55 21 * * *',
    model: 'opus',
    agentId: 'main',
  },
  {
    name: 'Proactive Builder Executor',
    prompt: `You are the Proactive Builder Executor. Read tonight's brief and do the work.

1. Read /Users/aditya_office_ai_assistant/clawd/memory/proactive-builder-brief.json
2. Check freshness: if brief timestamp is more than 2 hours old, log "stale brief, skipping" to memory/YYYY-MM-DD.md and exit.
3. If task_title is "SKIP" -> log the reason to memory/YYYY-MM-DD.md and exit.
4. Otherwise: execute the brief exactly. Spawn subagents as listed. Touch only the files listed.
5. Verify success_criteria before declaring done.
6. Log all work to memory/YYYY-MM-DD.md with: brief reference, files changed, outcome, anything blocked.
7. If you hit ambiguity the brief didn't cover: do NOT invent. Log the gap and stop.

Trust the brief. The planner already did the thinking.`,
    cron: '0 22 * * *',
    model: 'sonnet',
    agentId: 'main',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

interface OcJob {
  id: string;
  name: string;
  cron: string;
  model: string;
  oc_agent: string | null;
  enabled: boolean;
  prompt: string;
}

interface ImportResult {
  inserted: number;
  insertedActive: number;
  insertedPaused: number;
  skippedDisabled: number;
  skippedDupe: number;
  errors: string[];
}

function main(): void {
  // Pre-flight: verify source JSON
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Source file not found: ${SOURCE_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf-8')) as { migrate: OcJob[] };
  const jobs: OcJob[] = raw.migrate;

  // Pre-flight: verify DB + model column
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found: ${DB_PATH}`);
    process.exit(1);
  }
  const db = new Database(DB_PATH);
  const cols = db.prepare(`PRAGMA table_info(scheduled_tasks)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'model')) {
    console.error('Migration v1.2.1 has not been applied — scheduled_tasks.model column is missing.');
    console.error('Run: npm run migrate');
    process.exit(1);
  }

  console.log(`\nSource: ${SOURCE_PATH} (${jobs.length} total jobs)`);
  console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no inserts)' : 'LIVE'}\n`);

  const result: ImportResult = {
    inserted: 0,
    insertedActive: 0,
    insertedPaused: 0,
    skippedDisabled: 0,
    skippedDupe: 0,
    errors: [],
  };

  // Breakdown tracking
  const breakdown: Record<string, Record<string, Record<string, number>>> = {};
  function track(agentId: string, model: string, status: string): void {
    if (!breakdown[agentId]) breakdown[agentId] = {};
    if (!breakdown[agentId][model]) breakdown[agentId][model] = {};
    breakdown[agentId][model][status] = (breakdown[agentId][model][status] ?? 0) + 1;
  }

  function insertJob(
    id: string,
    prompt: string,
    cron: string,
    agentId: string,
    model: string,
    name: string,
    phase1: boolean,
  ): void {
    const status = phase1 ? 'active' : 'paused';

    // Idempotency check
    const existing = db.prepare(
      `SELECT id FROM scheduled_tasks WHERE prompt = ? AND schedule = ? AND agent_id = ?`
    ).get(prompt, cron, agentId);
    if (existing) {
      console.log(`  SKIP (dupe)    ${name}`);
      result.skippedDupe++;
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const nextRun = computeNextRun(cron);

    if (!DRY_RUN) {
      db.prepare(
        `INSERT INTO scheduled_tasks (id, prompt, schedule, next_run, status, created_at, agent_id, model)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
      ).run(id, prompt, cron, nextRun, now, agentId, model);

      if (!phase1) {
        db.prepare(`UPDATE scheduled_tasks SET status = 'paused' WHERE id = ?`).run(id);
      }
    }

    console.log(`  ${DRY_RUN ? '[dry] ' : ''}INSERT [${status}]  ${name}  agent=${agentId} model=${model}`);
    result.inserted++;
    if (phase1) result.insertedActive++;
    else result.insertedPaused++;
    track(agentId, model, status);
  }

  // Process source jobs
  for (const job of jobs) {
    if (!job.enabled) {
      result.skippedDisabled++;
      continue;
    }

    // Skip original Proactive Builder — replaced by synthetic split tasks
    if (job.name === 'Proactive Builder (Sunday Night)') {
      console.log(`  SKIP (replaced by Planner/Executor split): ${job.name}`);
      result.skippedDisabled++;
      continue;
    }

    let agentId: string;
    let model: string;
    let cron: string;

    try {
      agentId = mapAgent(job.oc_agent);
      model = mapModel(job.model, job.name);
      cron = normaliseCron(job.cron);
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`  ERROR: ${msg}`);
      result.errors.push(msg);
      continue;
    }

    const phase1 = isPhase1(job.name);
    const id = randomBytes(4).toString('hex');
    insertJob(id, job.prompt, cron, agentId, model, job.name, phase1);
  }

  // Insert synthetic Proactive Builder tasks
  console.log('\n--- Synthetic tasks ---');
  for (const task of SYNTHETIC_TASKS) {
    const id = randomBytes(4).toString('hex');
    insertJob(id, task.prompt, task.cron, task.agentId, task.model, task.name, true);
  }

  // Summary
  console.log('\n=== Import Summary ===');
  console.log(`Total source jobs:    ${jobs.length}`);
  console.log(`Skipped (disabled):   ${result.skippedDisabled}`);
  console.log(`Skipped (dupe):       ${result.skippedDupe}`);
  console.log(`Inserted active:      ${result.insertedActive}`);
  console.log(`Inserted paused:      ${result.insertedPaused}`);
  console.log(`Errors:               ${result.errors.length}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  - ${e}`);
  }

  console.log('\n=== Breakdown (agent × model × status) ===');
  for (const [agent, models] of Object.entries(breakdown).sort()) {
    for (const [model, statuses] of Object.entries(models).sort()) {
      for (const [status, count] of Object.entries(statuses).sort()) {
        console.log(`  ${agent.padEnd(12)} ${model.padEnd(8)} ${status.padEnd(8)} ${count}`);
      }
    }
  }

  db.close();

  if (result.errors.length > 0) process.exit(1);
}

main();
