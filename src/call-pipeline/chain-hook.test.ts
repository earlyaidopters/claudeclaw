/**
 * Unit tests for the call-pipeline completion chain hook.
 *
 * These tests cover the contract scheduler.ts relies on when it calls
 * maybeAdvanceCallPipeline(missionId) right after every mission
 * finishes: the hook must be a silent no-op on non-pipeline missions,
 * must advance A → B → C → D when a STAGE_X_DONE marker matches a
 * tracked run, must terminate cleanly on Stage D, and must mark the run
 * failed when the parent mission failed.
 *
 * All tests run against the real SQLite schema via _initTestDatabase so
 * the SQL in db.ts is exercised alongside the hook logic.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  _initTestDatabase,
  completeMissionTask,
  createMissionTask,
  getCallPipelineRun,
  getMissionTasks,
  upsertCallPipelineRun,
} from '../db.js';
import { maybeAdvanceCallPipeline } from './chain-hook.js';
import { STAGE_B, STAGE_C, STAGE_D } from './stage-prompts.js';

const ASHLEY_CTX = {
  callMsgId: 'VTzIVbxKXAfN6gYxDWwa',
  contactId: '0u6nz7UKk6k0ReuXrVr3',
  ghlConvId: 'conv-ashley',
};

function seedStageARun(
  ctx = ASHLEY_CTX,
  missionId = 'mission-a',
): void {
  upsertCallPipelineRun({
    callMsgId: ctx.callMsgId,
    contactId: ctx.contactId,
    ghlConvId: ctx.ghlConvId,
    stage: 'A',
    status: 'running',
    missionId,
  });
}

function createCompletedStageAMission(
  id = 'mission-a',
  callMsgId = ASHLEY_CTX.callMsgId,
  resultSuffix = '',
): void {
  createMissionTask(
    id,
    'Call pipeline Stage A: ' + ASHLEY_CTX.contactId,
    'prompt',
    's2l',
    'worker',
    7,
    'acceptance',
  );
  completeMissionTask(
    id,
    `STAGE_A_DONE call_msg_id=${callMsgId}${resultSuffix}`,
    'completed',
  );
}

describe('maybeAdvanceCallPipeline', () => {
  beforeEach(() => {
    _initTestDatabase();
  });

  it('returns mission_not_found when mission id is unknown', () => {
    const r = maybeAdvanceCallPipeline('does-not-exist');
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('mission_not_found');
  });

  it('returns not_terminal for queued/running missions', () => {
    createMissionTask('still-running', 't', 'p', 's2l', 'worker', 7, null);
    const r = maybeAdvanceCallPipeline('still-running');
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('not_terminal');
  });

  it('returns no_stage_marker for completed missions that are not pipeline stages', () => {
    createMissionTask('other-work', 'something else', 'p', 'builder', 'main', 5, null);
    completeMissionTask('other-work', 'Did a thing. ACCEPTANCE: PASS', 'completed');
    const r = maybeAdvanceCallPipeline('other-work');
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('no_stage_marker');
  });

  it('returns no_pipeline_run when marker parses but no run row exists', () => {
    // Scenario: ad-hoc canary or manual Stage A redo with no pipeline row.
    createCompletedStageAMission('no-row', 'orphan-call-123');
    const r = maybeAdvanceCallPipeline('no-row');
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('no_pipeline_run');
    expect(r.stage).toBe('A');
    expect(r.callMsgId).toBe('orphan-call-123');
  });

  it('advances Stage A → B: marks A completed and queues Stage B on s2l', () => {
    seedStageARun();
    createCompletedStageAMission();

    const r = maybeAdvanceCallPipeline('mission-a');
    expect(r.fired).toBe(true);
    expect(r.reason).toBe('pipeline_advanced');
    expect(r.stage).toBe('A');
    expect(r.callMsgId).toBe(ASHLEY_CTX.callMsgId);
    expect(r.nextStage?.stage).toBe('B');

    const stageA = getCallPipelineRun(ASHLEY_CTX.callMsgId, 'A');
    expect(stageA?.status).toBe('completed');
    expect(stageA?.completed_at).not.toBeNull();

    const stageB = getCallPipelineRun(ASHLEY_CTX.callMsgId, 'B');
    expect(stageB?.status).toBe('running');
    expect(stageB?.last_mission_id).toBe(r.nextStage?.missionId);

    const queued = getMissionTasks('s2l', 'queued');
    const stageBMission = queued.find((m) => m.id === r.nextStage?.missionId);
    expect(stageBMission).toBeDefined();
    expect(stageBMission?.title).toBe(STAGE_B.title);
    expect(stageBMission?.priority).toBe(7);
    expect(stageBMission?.assigned_agent).toBe('s2l');
    expect(stageBMission?.acceptance_criteria).toContain('STAGE_B_RECOMMENDATION');
    expect(stageBMission?.acceptance_criteria).toContain(ASHLEY_CTX.contactId);
  });

  it('tolerates trailing ACCEPTANCE: PASS and surrounding prose', () => {
    seedStageARun();
    createCompletedStageAMission('mission-a', ASHLEY_CTX.callMsgId, '\n\nACCEPTANCE: PASS');
    const r = maybeAdvanceCallPipeline('mission-a');
    expect(r.fired).toBe(true);
    expect(r.stage).toBe('A');
  });

  it('chains B → C and C → D end-to-end', () => {
    // Run a single call through the full chain by simulating each
    // stage mission completing in turn. This is the hot-path flow
    // scheduler.ts will replay in production.
    seedStageARun();
    createCompletedStageAMission();
    const afterA = maybeAdvanceCallPipeline('mission-a');
    expect(afterA.nextStage?.stage).toBe('B');

    const stageBMissionId = afterA.nextStage!.missionId;
    completeMissionTask(
      stageBMissionId,
      `STAGE_B_DONE call_msg_id=${ASHLEY_CTX.callMsgId}`,
      'completed',
    );
    const afterB = maybeAdvanceCallPipeline(stageBMissionId);
    expect(afterB.fired).toBe(true);
    expect(afterB.nextStage?.stage).toBe('C');
    const stageCMissionId = afterB.nextStage!.missionId;
    const stageCTask = getMissionTasks('s2l', 'queued').find((m) => m.id === stageCMissionId);
    expect(stageCTask?.title).toBe(STAGE_C.title);

    completeMissionTask(
      stageCMissionId,
      `STAGE_C_DONE call_msg_id=${ASHLEY_CTX.callMsgId}`,
      'completed',
    );
    const afterC = maybeAdvanceCallPipeline(stageCMissionId);
    expect(afterC.fired).toBe(true);
    expect(afterC.nextStage?.stage).toBe('D');
    const stageDMissionId = afterC.nextStage!.missionId;
    const stageDTask = getMissionTasks('s2l', 'queued').find((m) => m.id === stageDMissionId);
    expect(stageDTask?.title).toBe(STAGE_D.title);

    completeMissionTask(
      stageDMissionId,
      `STAGE_D_DONE call_msg_id=${ASHLEY_CTX.callMsgId}`,
      'completed',
    );
    const afterD = maybeAdvanceCallPipeline(stageDMissionId);
    expect(afterD.fired).toBe(true);
    expect(afterD.reason).toBe('pipeline_terminal');
    expect(afterD.nextStage).toBeNull();

    const finalD = getCallPipelineRun(ASHLEY_CTX.callMsgId, 'D');
    expect(finalD?.status).toBe('completed');
  });

  it('marks the stage failed and halts the chain when the mission failed', () => {
    seedStageARun();
    createMissionTask('failed-a', 'Stage A', 'p', 's2l', 'worker', 7, null);
    completeMissionTask(
      'failed-a',
      `STAGE_A_DONE call_msg_id=${ASHLEY_CTX.callMsgId}\nACCEPTANCE: FAIL: email was empty`,
      'failed',
      'email was empty',
    );

    const r = maybeAdvanceCallPipeline('failed-a');
    expect(r.fired).toBe(true);
    expect(r.reason).toBe('pipeline_failed');

    const stageA = getCallPipelineRun(ASHLEY_CTX.callMsgId, 'A');
    expect(stageA?.status).toBe('failed');

    // Critical: no Stage B row and no new queued s2l mission.
    const stageB = getCallPipelineRun(ASHLEY_CTX.callMsgId, 'B');
    expect(stageB).toBeNull();
  });

  it('is idempotent — a second call against the same mission does not duplicate Stage B', () => {
    seedStageARun();
    createCompletedStageAMission();

    const first = maybeAdvanceCallPipeline('mission-a');
    const second = maybeAdvanceCallPipeline('mission-a');

    expect(first.fired).toBe(true);
    expect(first.nextStage?.skipped).toBe(false);
    // Second call still "fires" in the sense that it re-marks A
    // completed and asks the orchestrator to start B, but startStage's
    // idempotency check returns skipped=true, so no second B mission
    // is created.
    expect(second.fired).toBe(true);
    expect(second.nextStage?.skipped).toBe(true);

    const queued = getMissionTasks('s2l', 'queued');
    const stageBMissions = queued.filter((m) => m.title === STAGE_B.title);
    expect(stageBMissions).toHaveLength(1);
  });
});
