/**
 * Call Pipeline — Chain Hook
 *
 * Completion-time bridge that advances the 4-stage call pipeline without
 * a dedicated watchdog. Called from scheduler.ts right after every
 * mission finishes (success OR failure). Reads the mission result for a
 * STAGE_[A-D]_DONE token, and if the token matches a tracked
 * call_pipeline_runs row, fires the orchestrator's onStageAccepted /
 * onStageFailed to either queue the next stage or halt the chain.
 *
 * Why a completion hook instead of a stand-alone watchdog cron:
 *   - The scheduler already owns the terminal state transition for every
 *     mission; it's the ONE place every finish funnels through.
 *   - No polling, no cron drift, no dedup bookkeeping — firing exactly
 *     once per mission is handled by the completion path itself.
 *   - Idempotency is already enforced by orchestrator.startStage, which
 *     checks call_pipeline_runs before creating a duplicate mission.
 *
 * Contract:
 *   - Pure lookup + single orchestrator call. No I/O to GHL/Telegram.
 *   - Silent no-op if the mission isn't a call-pipeline stage mission
 *     (no STAGE_X_DONE token, or no matching pipeline row). This keeps
 *     the hook safe to call on every mission completion regardless of
 *     origin.
 *   - Never throws on business-logic mismatches — returns a structured
 *     reason code the scheduler can log.
 */

import { getMissionTask } from '../db.js';
import {
  defaultDeps,
  onStageAccepted,
  onStageFailed,
  type CallContext,
  type OrchestratorDeps,
  type StageStartResult,
} from './orchestrator.js';
import type { StageId } from './stage-prompts.js';

/**
 * Tolerant parser. The Stage A/B/C/D prompts all instruct the agent to
 * reply with:  STAGE_X_DONE call_msg_id=[ID]
 * But agents sometimes add ACCEPTANCE: PASS after it, or wrap the token
 * in prose. We match the first STAGE_[A-D]_DONE occurrence anywhere in
 * the mission result or error body.
 *
 * call_msg_id charset mirrors GHL message ids (alphanumeric) with an
 * allowance for _ and - so canary / synthetic ids don't get rejected.
 */
const STAGE_DONE_RE = /STAGE_([ABCD])_DONE\s+call_msg_id\s*=\s*([A-Za-z0-9_-]+)/;

export interface AdvanceResult {
  /** True if a chain action was taken (stage marked completed/failed). */
  fired: boolean;
  /** Short reason code when fired=false (or explanatory for fired=true). */
  reason:
    | 'mission_not_found'
    | 'not_terminal'
    | 'no_stage_marker'
    | 'no_pipeline_run'
    | 'pipeline_advanced'
    | 'pipeline_failed'
    | 'pipeline_terminal';
  /** Parsed stage, populated when a STAGE_X_DONE token is found. */
  stage?: StageId;
  /** Parsed call_msg_id, populated when a STAGE_X_DONE token is found. */
  callMsgId?: string;
  /** Populated when advance created the next stage. Null when stage D finishes. */
  nextStage?: StageStartResult | null;
}

export function maybeAdvanceCallPipeline(
  missionId: string,
  deps: OrchestratorDeps = defaultDeps(),
): AdvanceResult {
  const mission = getMissionTask(missionId);
  if (!mission) return { fired: false, reason: 'mission_not_found' };
  if (mission.status !== 'completed' && mission.status !== 'failed') {
    return { fired: false, reason: 'not_terminal' };
  }

  // Combine result and error because Stage A's GHL failure often lands in
  // error, yet the agent still writes STAGE_A_DONE into result. Either
  // body can carry the marker.
  const body = [mission.result ?? '', mission.error ?? ''].join('\n');
  const match = STAGE_DONE_RE.exec(body);
  if (!match) return { fired: false, reason: 'no_stage_marker' };

  const stage = match[1] as StageId;
  const callMsgId = match[2];

  const run = deps.getPipelineRun(callMsgId, stage);
  if (!run) {
    // Stage ran outside the pipeline (ad-hoc canary, manual redo) — don't
    // synthesise a run row here. The orchestrator owns row creation.
    return { fired: false, reason: 'no_pipeline_run', stage, callMsgId };
  }

  const ctx: CallContext = {
    callMsgId,
    contactId: run.contact_id,
    ghlConvId: run.ghl_conv_id,
  };

  if (mission.status === 'failed') {
    onStageFailed(ctx, stage, deps);
    return { fired: true, reason: 'pipeline_failed', stage, callMsgId };
  }

  const next = onStageAccepted(ctx, stage, deps);
  if (next === null) {
    return { fired: true, reason: 'pipeline_terminal', stage, callMsgId, nextStage: null };
  }
  return { fired: true, reason: 'pipeline_advanced', stage, callMsgId, nextStage: next };
}
