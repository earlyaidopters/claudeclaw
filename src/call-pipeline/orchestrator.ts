/**
 * Call Pipeline Orchestrator
 *
 * Pure-logic dispatcher for the 4-stage post-call pipeline. Does NOT
 * execute missions itself — it only decides whether a stage mission
 * should exist and creates it via the injected DB helpers.
 *
 * Shape borrowed from the Kanban anti-idle orchestrator (clawd mission
 * 34bfa65e): every side effect goes through injectable deps so the
 * logic is unit-testable without touching real GHL or a real mission.
 *
 *   startPipeline(ctx)         → creates Stage A mission + pipeline row
 *   onStageAccepted(ctx, S)    → marks S completed, creates next stage
 *   onStageFailed(ctx, S)      → marks S failed, halts the pipeline
 */

import { randomBytes } from 'crypto';

import {
  createMissionTask as defaultCreateMissionTask,
  upsertCallPipelineRun as defaultUpsertPipelineRun,
  markCallPipelineStageCompleted as defaultMarkCompleted,
  getCallPipelineRun as defaultGetPipelineRun,
} from '../db.js';
import type { CallPipelineRun, CallPipelineStage } from '../db.js';
import {
  STAGE_REGISTRY,
  buildPrompt,
  buildAcceptance,
  nextStage,
  type StageId,
} from './stage-prompts.js';

export interface OrchestratorDeps {
  createMissionTask: (
    id: string, title: string, prompt: string,
    assignedAgent: string | null, createdBy: string,
    priority: number, acceptanceCriteria: string | null,
  ) => void;
  upsertPipelineRun: (row: {
    callMsgId: string; contactId: string; ghlConvId: string | null;
    stage: CallPipelineStage;
    status: 'pending' | 'running' | 'completed' | 'failed';
    missionId: string | null;
  }) => void;
  markStageCompleted: (
    callMsgId: string, stage: CallPipelineStage,
    status?: 'completed' | 'failed',
  ) => void;
  getPipelineRun: (
    callMsgId: string, stage: CallPipelineStage,
  ) => CallPipelineRun | null;
  /** Override for deterministic mission IDs in tests. */
  generateMissionId?: () => string;
  /** Audit trail — who created the mission. Defaults to 'call-pipeline'. */
  createdBy?: string;
}

export function defaultDeps(): OrchestratorDeps {
  return {
    createMissionTask: defaultCreateMissionTask,
    upsertPipelineRun: defaultUpsertPipelineRun,
    markStageCompleted: defaultMarkCompleted,
    getPipelineRun: defaultGetPipelineRun,
    createdBy: 'call-pipeline',
  };
}

export interface CallContext {
  callMsgId: string;
  contactId: string;
  ghlConvId: string | null;
}

export interface StageStartResult {
  stage: StageId;
  missionId: string;
  skipped: boolean;
  reason?: string;
}

/**
 * Create the mission for `stage` and upsert the pipeline row.
 * Idempotent: if a pipeline row already exists for (call_msg_id, stage)
 * with status != 'failed', we skip and return the existing mission id.
 */
export function startStage(
  ctx: CallContext,
  stage: StageId,
  deps: OrchestratorDeps = defaultDeps(),
): StageStartResult {
  const existing = deps.getPipelineRun(ctx.callMsgId, stage);
  if (existing && existing.status !== 'failed') {
    return {
      stage,
      missionId: existing.last_mission_id ?? '',
      skipped: true,
      reason: `pipeline row already exists (status=${existing.status})`,
    };
  }

  const stageDef = STAGE_REGISTRY[stage];
  const missionId =
    deps.generateMissionId?.() ?? randomBytes(4).toString('hex');
  const prompt = buildPrompt(stageDef.template, ctx);
  const acceptance = buildAcceptance(stageDef.acceptanceCriteria, ctx);

  deps.createMissionTask(
    missionId,
    stageDef.title,
    prompt,
    stageDef.assignedAgent,
    deps.createdBy ?? 'call-pipeline',
    stageDef.priority,
    acceptance,
  );

  deps.upsertPipelineRun({
    callMsgId: ctx.callMsgId,
    contactId: ctx.contactId,
    ghlConvId: ctx.ghlConvId,
    stage,
    status: 'running',
    missionId,
  });

  return { stage, missionId, skipped: false };
}

/** Called when a transcript note lands for a fresh call. Idempotent. */
export function startPipeline(
  ctx: CallContext,
  deps: OrchestratorDeps = defaultDeps(),
): StageStartResult {
  return startStage(ctx, 'A', deps);
}

/**
 * Called when a stage mission's acceptance check passes. Marks the
 * stage completed and launches the next one. Returns null when the
 * pipeline terminates (stage D accepted).
 */
export function onStageAccepted(
  ctx: CallContext,
  acceptedStage: StageId,
  deps: OrchestratorDeps = defaultDeps(),
): StageStartResult | null {
  deps.markStageCompleted(ctx.callMsgId, acceptedStage, 'completed');
  const next = nextStage(acceptedStage);
  if (!next) return null;
  return startStage(ctx, next, deps);
}

/** Called when a stage permanently fails — halts the pipeline. */
export function onStageFailed(
  ctx: CallContext,
  failedStage: StageId,
  deps: OrchestratorDeps = defaultDeps(),
): void {
  deps.markStageCompleted(ctx.callMsgId, failedStage, 'failed');
}

/** Readable name for a stage, used in logs. */
export function describeStage(stage: StageId): string {
  return `${stage} (${STAGE_REGISTRY[stage].title})`;
}
