/**
 * Auto-triage helper — both mission-watchdog and qa-audit used to page Rudy on
 * Telegram when something went sideways. That created noise without action.
 * Instead, we now queue an "auto-triage" mission on @main (opus) so main can
 * diagnose, dispatch the muscle fix to the right spoke with reduced scope,
 * and only ping Rudy if a permission/decision is required.
 *
 * Used by:
 *   - src/mission-watchdog.ts  (failed missions, stuck missions, failed scheduled_tasks)
 *   - src/qa-audit.ts          (QA verdict FAIL on a mission claimed "completed")
 */
import { randomBytes } from 'crypto';

import { createMissionTask } from './db.js';

export type TriageKind = 'mission_failed' | 'mission_stuck' | 'scheduled_task_failed' | 'qa_failed';

export interface TriageContext {
  kind: TriageKind;
  /** ID of the failing artefact (mission id or scheduled_task id). */
  sourceId: string;
  title: string;
  /** Agent the source task was assigned to (if known). */
  assignedAgent: string | null;
  /** Cron schedule, for scheduled_task_failed. */
  schedule?: string | null;
  /** Full original prompt of the source task. */
  prompt: string;
  /** Error string (mission.error, or the QA fail reason). Optional. */
  error?: string | null;
  /** Full output / last_result; we only keep the tail. */
  lastOutput?: string | null;
  /** For mission_stuck — minutes the mission has been running. */
  stuckMinutes?: number;
}

/** Keep the trailing window — that's usually where the real failure is. */
function clipTail(s: string | null | undefined, max: number): string {
  if (!s) return '(none)';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return '…' + t.slice(-(max - 1));
}

function clip(s: string | null | undefined, max: number): string {
  if (!s) return '(none)';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function kindLabel(k: TriageKind): string {
  switch (k) {
    case 'mission_failed': return 'mission failed';
    case 'mission_stuck': return 'mission stuck (running > 1h)';
    case 'scheduled_task_failed': return 'scheduled task failed';
    case 'qa_failed': return 'QA audit FAILED on a "completed" mission';
  }
}

function buildTriagePrompt(ctx: TriageContext): string {
  const parts: string[] = [];

  parts.push(`Watchdog caught a failure — ${kindLabel(ctx.kind)}. Triage and fix.`);
  parts.push('');
  parts.push('# Source artefact');
  if (ctx.kind === 'scheduled_task_failed') {
    parts.push(`- type:     scheduled_task`);
    parts.push(`- id:       ${ctx.sourceId}`);
    parts.push(`- schedule: ${ctx.schedule || '(unknown)'}`);
    parts.push(`- agent:    ${ctx.assignedAgent || 'main'}`);
  } else {
    parts.push(`- type:     mission_task`);
    parts.push(`- id:       ${ctx.sourceId}`);
    parts.push(`- agent:    ${ctx.assignedAgent || 'unassigned'}`);
  }
  parts.push(`- title:    ${ctx.title}`);
  if (ctx.stuckMinutes !== undefined) {
    parts.push(`- stuck for: ${ctx.stuckMinutes} min`);
  }
  parts.push('');

  parts.push('# Error');
  parts.push(clip(ctx.error, 2000));
  parts.push('');

  if (ctx.lastOutput) {
    parts.push('# Last 500 chars of output');
    parts.push(clipTail(ctx.lastOutput, 500));
    parts.push('');
  }

  parts.push('# Full original prompt');
  parts.push(ctx.prompt || '(empty)');
  parts.push('');

  parts.push('# Your job');
  parts.push(
    'Diagnose the enabling condition, dispatch the muscle fix to the appropriate spoke ' +
      'with reduced scope. Only notify Rudy via scripts/notify.sh if a permission or ' +
      'decision is required.',
  );

  return parts.join('\n');
}

/**
 * Queue an auto-triage mission on @main (opus) with priority 9.
 * Returns the new mission ID.
 */
export function createAutoTriageMission(ctx: TriageContext): string {
  const id = randomBytes(4).toString('hex');
  const rawTitle = `Auto-triage: ${ctx.title}`;
  // Keep the title DB-friendly but still descriptive.
  const title = rawTitle.length > 200 ? rawTitle.slice(0, 199) + '…' : rawTitle;
  const prompt = buildTriagePrompt(ctx);

  createMissionTask(
    id,
    title,
    prompt,
    'main',      // assigned_agent
    'watchdog',  // created_by
    9,           // priority — just below the max so operator-created emergencies still win
    null,        // acceptance_criteria — triage is open-ended
  );

  return id;
}
