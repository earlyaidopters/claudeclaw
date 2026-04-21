/**
 * Unit tests for the call-pipeline orchestrator.
 *
 * These tests hit the real in-memory SQLite (via _initTestDatabase) so
 * we exercise the actual mission_tasks + call_pipeline_runs schema and
 * the SQL upsert logic. Only GHL / LLM side effects are stubbed.
 *
 * Canonical scenario: Watchdog v2 reports Stage A acceptance passing.
 * The orchestrator must (a) mark Stage A completed in call_pipeline_runs
 * and (b) create a Stage B mission in mission_tasks with the right
 * agent, priority, and acceptance_criteria string.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  _initTestDatabase,
  getCallPipelineRun,
  getMissionTasks,
} from '../db.js';
import {
  onStageAccepted,
  startPipeline,
  type CallContext,
} from './orchestrator.js';
import { STAGE_B } from './stage-prompts.js';

const ASHLEY: CallContext = {
  callMsgId: 'VTzIVbxKXAfN6gYxDWwa',
  contactId: '0u6nz7UKk6k0ReuXrVr3',
  ghlConvId: 'conv-ashley-fake',
};

describe('call-pipeline orchestrator', () => {
  beforeEach(() => {
    _initTestDatabase();
  });

  describe('startPipeline', () => {
    it('creates a Stage A mission and a call_pipeline_runs row', () => {
      const result = startPipeline(ASHLEY);
      expect(result.stage).toBe('A');
      expect(result.skipped).toBe(false);
      expect(result.missionId).toMatch(/^[a-f0-9]{8}$/);

      const run = getCallPipelineRun(ASHLEY.callMsgId, 'A');
      expect(run).not.toBeNull();
      expect(run?.status).toBe('running');
      expect(run?.contact_id).toBe(ASHLEY.contactId);
      expect(run?.last_mission_id).toBe(result.missionId);

      const tasks = getMissionTasks('s2l', 'queued');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toMatch(/extract facts/i);
      expect(tasks[0].priority).toBe(7);
      expect(tasks[0].prompt).toContain('STAGE_A_FACTS');
      expect(tasks[0].prompt).toContain(ASHLEY.contactId);
      expect(tasks[0].prompt).toContain(ASHLEY.callMsgId);
      expect(tasks[0].acceptance_criteria).toContain('STAGE_A_FACTS');
      expect(tasks[0].acceptance_criteria).toContain(ASHLEY.contactId);
    });

    it('is idempotent — a second call returns skipped=true', () => {
      const first = startPipeline(ASHLEY);
      const second = startPipeline(ASHLEY);
      expect(first.skipped).toBe(false);
      expect(second.skipped).toBe(true);
      // Only one mission should have been created.
      const tasks = getMissionTasks('s2l', 'queued');
      expect(tasks).toHaveLength(1);
    });

    it('stage prompts contain no angle brackets', () => {
      // Regression guard: bot.ts renders mission status with HTML
      // parse mode, so any < or > in the rendered prompt would break
      // truncation and leave users staring at half a sentence.
      startPipeline(ASHLEY);
      const tasks = getMissionTasks('s2l', 'queued');
      for (const t of tasks) {
        expect(t.prompt).not.toMatch(/[<>]/);
        expect(t.acceptance_criteria ?? '').not.toMatch(/[<>]/);
      }
    });
  });

  describe('onStageAccepted (Stage A pass → Stage B created)', () => {
    it('creates a Stage B mission with correct agent, priority, acceptance', () => {
      // Simulate the watchdog: Stage A exists and has just passed
      // acceptance. The orchestrator must mark it completed and
      // create Stage B.
      startPipeline(ASHLEY);

      const advance = onStageAccepted(ASHLEY, 'A');
      expect(advance).not.toBeNull();
      expect(advance?.stage).toBe('B');
      expect(advance?.skipped).toBe(false);

      // Stage A row should be completed.
      const stageA = getCallPipelineRun(ASHLEY.callMsgId, 'A');
      expect(stageA?.status).toBe('completed');
      expect(stageA?.completed_at).not.toBeNull();

      // Stage B row should exist and be running.
      const stageB = getCallPipelineRun(ASHLEY.callMsgId, 'B');
      expect(stageB?.status).toBe('running');
      expect(stageB?.last_mission_id).toBe(advance?.missionId);

      // Stage B mission should be queued on s2l at priority 7 with
      // the Stage B acceptance criteria.
      const queued = getMissionTasks('s2l', 'queued');
      // Stage A moved to running on creation; Stage B is the new queued mission.
      const stageBTask = queued.find((t) => t.id === advance?.missionId);
      expect(stageBTask).toBeDefined();
      expect(stageBTask?.assigned_agent).toBe('s2l');
      expect(stageBTask?.priority).toBe(7);
      expect(stageBTask?.title).toBe(STAGE_B.title);
      expect(stageBTask?.acceptance_criteria).toContain(
        'STAGE_B_RECOMMENDATION',
      );
      expect(stageBTask?.acceptance_criteria).toContain(ASHLEY.contactId);
      expect(stageBTask?.prompt).toContain('Pinecone');
      expect(stageBTask?.prompt).toContain('STAGE_A_FACTS');
    });

    it('Stage D acceptance terminates the pipeline (returns null)', () => {
      startPipeline(ASHLEY);
      onStageAccepted(ASHLEY, 'A');
      onStageAccepted(ASHLEY, 'B');
      onStageAccepted(ASHLEY, 'C');
      const terminal = onStageAccepted(ASHLEY, 'D');
      expect(terminal).toBeNull();

      const stageD = getCallPipelineRun(ASHLEY.callMsgId, 'D');
      expect(stageD?.status).toBe('completed');
    });
  });
});
