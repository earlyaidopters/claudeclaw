#!/usr/bin/env node
/**
 * Canary for the call-pipeline chain hook wired into scheduler.ts.
 *
 * Simulates a Stage A completion end-to-end against the live claudeclaw
 * SQLite DB:
 *   1. Insert a synthetic call_pipeline_runs row for stage A status=running
 *      with a fresh canary-<ts> call_msg_id so nothing collides with a
 *      real call (or with Sunil's active pipeline on f607b7db).
 *   2. Insert a completed mission_tasks row whose result contains the
 *      STAGE_A_DONE marker the hook parses.
 *   3. Invoke maybeAdvanceCallPipeline(missionId) directly.
 *   4. Verify the hook advanced the chain: stage A row flipped to
 *      completed, a Stage B mission was queued on s2l at priority 7, and
 *      a stage B run row was upserted.
 *   5. Immediately cancel the Stage B mission to prevent s2l from
 *      processing the canary's synthetic contact / fake call_msg_id,
 *      and delete the synthetic rows so the DB returns to a clean state.
 *
 * Exits 0 on pass, non-zero on any failure. Prints a one-line summary.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CC_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
process.chdir(CC_ROOT);

const {
  initDatabase,
  createMissionTask,
  completeMissionTask,
  cancelMissionTask,
  getMissionTask,
  upsertCallPipelineRun,
  getCallPipelineRun,
} = await import(`${CC_ROOT}/dist/db.js`);
const { maybeAdvanceCallPipeline } = await import(`${CC_ROOT}/dist/call-pipeline/chain-hook.js`);
const { STAGE_B } = await import(`${CC_ROOT}/dist/call-pipeline/stage-prompts.js`);

const Database = require('better-sqlite3');

initDatabase();

const ts = Date.now();
const CALL_MSG_ID = `canary-${ts}`;
const CONTACT_ID = `canary-contact-${ts}`;
const CONV_ID = `canary-conv-${ts}`;
const STAGE_A_MISSION_ID = `canary-a-${ts.toString(16).slice(-8)}`;

const cleanupMissionIds = [STAGE_A_MISSION_ID];

function cleanup() {
  const dbPath = path.join(CC_ROOT, 'store', 'claudeclaw.db');
  const db = new Database(dbPath);
  try {
    for (const id of cleanupMissionIds) {
      db.prepare('DELETE FROM mission_tasks WHERE id = ?').run(id);
    }
    db.prepare('DELETE FROM call_pipeline_runs WHERE call_msg_id = ?').run(CALL_MSG_ID);
  } finally {
    db.close();
  }
}

let pass = false;
let reason = '';
try {
  // Step 1: seed a stage A run row at running.
  upsertCallPipelineRun({
    callMsgId: CALL_MSG_ID,
    contactId: CONTACT_ID,
    ghlConvId: CONV_ID,
    stage: 'A',
    status: 'running',
    missionId: STAGE_A_MISSION_ID,
  });

  // Step 2: create a completed Stage A mission with the STAGE_A_DONE marker.
  createMissionTask(
    STAGE_A_MISSION_ID,
    `Call pipeline Stage A: ${CONTACT_ID}`,
    `canary prompt — call_msg_id=${CALL_MSG_ID}`,
    's2l',
    'canary',
    7,
    'canary acceptance',
  );
  completeMissionTask(
    STAGE_A_MISSION_ID,
    `STAGE_A_DONE call_msg_id=${CALL_MSG_ID}\nACCEPTANCE: PASS`,
    'completed',
  );

  // Step 3: invoke the hook.
  const r = maybeAdvanceCallPipeline(STAGE_A_MISSION_ID);

  // Step 4: verify.
  const nextMissionId = r.nextStage?.missionId;
  if (!r.fired) throw new Error(`hook did not fire: reason=${r.reason}`);
  if (r.reason !== 'pipeline_advanced') throw new Error(`unexpected reason ${r.reason}`);
  if (!nextMissionId) throw new Error('no next stage mission id returned');
  cleanupMissionIds.push(nextMissionId);

  const stageA = getCallPipelineRun(CALL_MSG_ID, 'A');
  if (stageA?.status !== 'completed') throw new Error(`stage A status=${stageA?.status}`);

  const stageB = getCallPipelineRun(CALL_MSG_ID, 'B');
  if (!stageB) throw new Error('stage B run row missing');
  if (stageB.status !== 'running') throw new Error(`stage B status=${stageB.status}`);
  if (stageB.last_mission_id !== nextMissionId) {
    throw new Error(`stage B mission id mismatch: row=${stageB.last_mission_id} vs hook=${nextMissionId}`);
  }

  const stageBMission = getMissionTask(nextMissionId);
  if (!stageBMission) throw new Error('stage B mission not in mission_tasks');
  if (stageBMission.assigned_agent !== 's2l') throw new Error(`stage B agent=${stageBMission.assigned_agent}`);
  if (stageBMission.priority !== 7) throw new Error(`stage B priority=${stageBMission.priority}`);
  if (stageBMission.title !== STAGE_B.title) throw new Error(`stage B title=${stageBMission.title}`);
  if (!/STAGE_B_RECOMMENDATION/.test(stageBMission.acceptance_criteria ?? '')) {
    throw new Error('stage B acceptance missing STAGE_B_RECOMMENDATION token');
  }

  // Step 5: cancel the stage B mission before s2l picks it up — the
  // contact and call_msg_id are synthetic, so actually running the Stage
  // B prompt would poison GHL with nonsense notes.
  cancelMissionTask(nextMissionId);

  pass = true;
  console.log(JSON.stringify({
    pass: true,
    callMsgId: CALL_MSG_ID,
    stageAMissionId: STAGE_A_MISSION_ID,
    stageBMissionId: nextMissionId,
    stageATitle: 'Call pipeline Stage A',
    stageBTitle: stageBMission.title,
  }, null, 2));
} catch (err) {
  reason = err instanceof Error ? err.message : String(err);
  console.error('CANARY FAILED:', reason);
} finally {
  cleanup();
}

process.exit(pass ? 0 : 1);
