/**
 * Mission Control — L5 multi-agent orchestration engine.
 *
 * Replaces orchestrator.ts. Handles:
 * - Agent registry (from agent cards)
 * - Simple delegation (@agent: prompt) — backward-compatible, single-subtask missions
 * - Complex missions — LLM-decomposed, multi-subtask, parallel execution
 * - Mission lifecycle: plan → approve → execute → synthesize → report
 *
 * Task lifecycle follows A2A states: pending → approved → working → completed/failed/canceled.
 */

import crypto from 'crypto';
import fs from 'fs';

import { runAgent, UsageInfo } from './agent.js';
import { loadAgentConfig, resolveAgentClaudeMd, listAgentIds } from './agent-config.js';
import { AgentCard, loadAllAgentCards, matchAgents } from './agent-card.js';
import { PROJECT_ROOT, AGENT_TIMEOUT_MS } from './config.js';
import {
  createMission,
  createMissionSubtask,
  getMission,
  getMissionSubtasks,
  getReadySubtasks,
  logToHiveMind,
  setMissionResult,
  setSubtaskError,
  setSubtaskResult,
  updateMissionPlan,
  updateMissionStatus,
  updateSubtaskStatus,
  MissionSubtask,
} from './db.js';
import { logger } from './logger.js';
import { planMission as llmPlanMission, MissionPlan } from './mission-planner.js';

// ── Types ────────────────────────────────────────────────────────────

export interface MissionProgress {
  missionId: string;
  subtaskId: string;
  agentId: string | null;
  status: 'started' | 'completed' | 'failed';
  description: string;
}

export interface MissionResult {
  missionId: string;
  goal: string;
  status: 'completed' | 'failed';
  summary: string;
  subtaskResults: Array<{
    id: string;
    agentId: string | null;
    status: string;
    result: string | null;
    costUsd: number;
  }>;
  totalCostUsd: number;
  durationMs: number;
}

export interface DelegationResult {
  agentId: string;
  text: string | null;
  usage: UsageInfo | null;
  taskId: string;
  durationMs: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
}

// ── State ────────────────────────────────────────────────────────────

let agentCards: AgentCard[] = [];

/** Max concurrent worker agents. Configurable via MISSION_MAX_WORKERS. */
const MAX_WORKERS = parseInt(process.env.MISSION_MAX_WORKERS || '3', 10);

/** Default timeout for a single subtask (ms). */
const SUBTASK_TIMEOUT_MS = AGENT_TIMEOUT_MS;

// ── Initialization ───────────────────────────────────────────────────

export function initMissionControl(): void {
  agentCards = loadAllAgentCards();
  logger.info(
    { agents: agentCards.map((c) => `${c.id} (${c.type})`) },
    'Mission Control initialized',
  );
}

export function getAgentCards(): AgentCard[] {
  return [...agentCards];
}

/** Backward-compatible: return agent info for the /agents command. */
export function getAvailableAgents(): AgentInfo[] {
  return agentCards.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}

// ── Simple Delegation (backward-compatible) ──────────────────────────
// Supports @agentId: prompt and /delegate agentId prompt syntax.

export function parseDelegation(
  message: string,
): { agentId: string; prompt: string } | null {
  // /delegate agentId prompt
  const cmdMatch = message.match(/^\/delegate\s+(\S+)\s+([\s\S]+)/i);
  if (cmdMatch) {
    return { agentId: cmdMatch[1], prompt: cmdMatch[2].trim() };
  }

  // @agentId: prompt
  const atMatch = message.match(/^@(\S+?):\s*([\s\S]+)/);
  if (atMatch) {
    return { agentId: atMatch[1], prompt: atMatch[2].trim() };
  }

  // @agentId prompt (only for known agents to avoid false positives)
  const atMatchNoColon = message.match(/^@(\S+)\s+([\s\S]+)/);
  if (atMatchNoColon) {
    const candidate = atMatchNoColon[1];
    if (agentCards.some((c) => c.id === candidate)) {
      return { agentId: candidate, prompt: atMatchNoColon[2].trim() };
    }
  }

  return null;
}

export async function delegateToAgent(
  agentId: string,
  prompt: string,
  chatId: string,
  fromAgent: string,
  onProgress?: (msg: string) => void,
  timeoutMs = SUBTASK_TIMEOUT_MS,
): Promise<DelegationResult> {
  const card = agentCards.find((c) => c.id === agentId);
  if (!card) {
    const available = agentCards.map((c) => c.id).join(', ') || '(none)';
    throw new Error(`Agent "${agentId}" not found. Available: ${available}`);
  }

  const taskId = crypto.randomUUID();
  const start = Date.now();

  // Log to hive mind
  logToHiveMind(fromAgent, chatId, 'delegate', `Delegated to ${agentId}: ${prompt.slice(0, 100)}`);
  onProgress?.(`Delegating to ${card.name}...`);

  try {
    const claudeMdPath = resolveAgentClaudeMd(agentId);
    let systemPrompt = '';
    if (claudeMdPath) {
      try { systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8'); } catch { /* no CLAUDE.md */ }
    }

    const fullPrompt = systemPrompt
      ? `[Agent role — follow these instructions]\n${systemPrompt}\n[End agent role]\n\n${prompt}`
      : prompt;

    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), timeoutMs);

    try {
      const result = await runAgent(fullPrompt, undefined, () => {}, undefined, card.model, abortCtrl);
      clearTimeout(timer);

      const durationMs = Date.now() - start;
      logToHiveMind(agentId, chatId, 'delegate_result', `Completed delegation from ${fromAgent}: ${(result.text ?? '').slice(0, 120)}`);
      onProgress?.(`${card.name} completed (${Math.round(durationMs / 1000)}s)`);

      return { agentId, text: result.text, usage: result.usage, taskId, durationMs };
    } catch (innerErr) {
      clearTimeout(timer);
      throw innerErr;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logToHiveMind(agentId, chatId, 'delegate_error', `Delegation from ${fromAgent} failed: ${errMsg.slice(0, 120)}`);
    throw err;
  }
}

// ── Mission Lifecycle ────────────────────────────────────────────────

/**
 * Create a new mission from a goal. Uses LLM to decompose into subtasks.
 * Returns the mission ID and proposed plan for approval.
 */
export async function proposeMission(
  goal: string,
  chatId: string,
  topicId?: string | null,
): Promise<{ missionId: string; plan: MissionPlan }> {
  const missionId = crypto.randomUUID();

  // Use LLM to decompose the goal into subtasks
  const plan = await llmPlanMission(goal, agentCards);

  // Persist mission and subtasks
  createMission(missionId, chatId, goal, JSON.stringify(plan), topicId);

  for (const subtask of plan.subtasks) {
    createMissionSubtask(subtask.id, missionId, subtask.prompt, {
      agentId: subtask.agentId ?? undefined,
      agentType: subtask.agentType,
      verificationCriteria: subtask.verification,
      dependsOn: subtask.dependsOn,
    });
  }

  logger.info(
    { missionId, goal: goal.slice(0, 80), subtasks: plan.subtasks.length },
    'Mission proposed',
  );

  return { missionId, plan };
}

/**
 * Approve a mission and begin execution.
 */
export async function approveMission(
  missionId: string,
  onProgress?: (progress: MissionProgress) => void,
): Promise<MissionResult> {
  const mission = getMission(missionId);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  if (mission.status !== 'pending') {
    throw new Error(`Mission ${missionId} is ${mission.status}, expected pending`);
  }

  updateMissionStatus(missionId, 'approved');
  updateMissionStatus(missionId, 'working');

  const start = Date.now();

  try {
    const result = await executeMission(missionId, onProgress);
    return result;
  } catch (err) {
    updateMissionStatus(missionId, 'failed');
    const errMsg = err instanceof Error ? err.message : String(err);
    setMissionResult(missionId, `Mission failed: ${errMsg}`);
    throw err;
  }
}

/**
 * Revise a mission plan based on feedback, then re-propose.
 */
export async function reviseMission(
  missionId: string,
  feedback: string,
): Promise<MissionPlan> {
  const mission = getMission(missionId);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  const plan = await llmPlanMission(
    `${mission.goal}\n\n[Revision feedback]: ${feedback}`,
    agentCards,
  );

  // Update mission with new plan
  updateMissionPlan(missionId, JSON.stringify(plan));

  // Clear old subtasks and create new ones
  // (Simple approach: mark old as canceled, create fresh)
  const oldSubtasks = getMissionSubtasks(missionId);
  for (const st of oldSubtasks) {
    if (st.status === 'pending') updateSubtaskStatus(st.id, 'canceled');
  }

  for (const subtask of plan.subtasks) {
    createMissionSubtask(subtask.id, missionId, subtask.prompt, {
      agentId: subtask.agentId ?? undefined,
      agentType: subtask.agentType,
      verificationCriteria: subtask.verification,
      dependsOn: subtask.dependsOn,
    });
  }

  logger.info({ missionId, subtasks: plan.subtasks.length }, 'Mission revised');
  return plan;
}

/**
 * Cancel a mission and all pending subtasks.
 */
export function cancelMission(missionId: string): void {
  const mission = getMission(missionId);
  if (!mission) return;

  updateMissionStatus(missionId, 'canceled');
  const subtasks = getMissionSubtasks(missionId);
  for (const st of subtasks) {
    if (st.status === 'pending' || st.status === 'working') {
      updateSubtaskStatus(st.id, 'canceled');
    }
  }

  logger.info({ missionId }, 'Mission canceled');
}

// ── Execution Engine ─────────────────────────────────────────────────

async function executeMission(
  missionId: string,
  onProgress?: (progress: MissionProgress) => void,
): Promise<MissionResult> {
  const mission = getMission(missionId)!;
  const start = Date.now();

  // Execute subtasks in dependency order, parallelizing where possible
  let hasFailure = false;

  while (true) {
    const ready = getReadySubtasks(missionId);
    if (ready.length === 0) break;

    // Run up to MAX_WORKERS subtasks in parallel
    const batch = ready.slice(0, MAX_WORKERS);
    const results = await Promise.allSettled(
      batch.map((st) => executeSubtask(st, missionId, mission.chat_id, onProgress)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        hasFailure = true;
        logger.error({ subtaskId: batch[i].id, err: result.reason }, 'Subtask execution failed');
      }
    }

    // If any subtask failed, stop the mission
    if (hasFailure) break;
  }

  // Check final state
  const allSubtasks = getMissionSubtasks(missionId);
  const completedAll = allSubtasks.every(
    (s) => s.status === 'completed' || s.status === 'canceled',
  );
  const anyFailed = allSubtasks.some((s) => s.status === 'failed');

  const finalStatus = anyFailed ? 'failed' as const : completedAll ? 'completed' as const : 'failed' as const;
  updateMissionStatus(missionId, finalStatus);

  // Synthesize results
  const subtaskResults = allSubtasks.map((s) => ({
    id: s.id,
    agentId: s.agent_id,
    status: s.status,
    result: s.result,
    costUsd: s.cost_usd,
  }));

  const totalCost = subtaskResults.reduce((sum, s) => sum + s.costUsd, 0);
  const durationMs = Date.now() - start;

  // Build summary from completed subtask results
  const completedResults = subtaskResults
    .filter((s) => s.status === 'completed' && s.result)
    .map((s) => s.result!)
    .join('\n\n---\n\n');

  const summary = finalStatus === 'completed'
    ? completedResults || 'All subtasks completed (no output).'
    : `Mission ${finalStatus}. ${allSubtasks.filter((s) => s.status === 'completed').length}/${allSubtasks.length} subtasks completed.`;

  setMissionResult(missionId, summary.slice(0, 4000));

  logToHiveMind(
    'mission-control',
    mission.chat_id,
    'mission_complete',
    `Mission "${mission.goal.slice(0, 60)}": ${finalStatus} (${allSubtasks.filter((s) => s.status === 'completed').length}/${allSubtasks.length} subtasks, $${totalCost.toFixed(3)}, ${Math.round(durationMs / 1000)}s)`,
  );

  const missionResult: MissionResult = {
    missionId,
    goal: mission.goal,
    status: finalStatus,
    summary,
    subtaskResults,
    totalCostUsd: totalCost,
    durationMs,
  };

  return missionResult;
}

async function executeSubtask(
  subtask: MissionSubtask,
  missionId: string,
  chatId: string,
  onProgress?: (progress: MissionProgress) => void,
): Promise<void> {
  const agentId = subtask.agent_id ?? 'worker';

  updateSubtaskStatus(subtask.id, 'working');
  onProgress?.({
    missionId,
    subtaskId: subtask.id,
    agentId: subtask.agent_id,
    status: 'started',
    description: `Running: ${subtask.prompt.slice(0, 80)}`,
  });

  const abortCtrl = new AbortController();
  const timer = setTimeout(() => abortCtrl.abort(), SUBTASK_TIMEOUT_MS);

  try {
    // Load agent system prompt if agent is specified
    let systemPrompt = '';
    if (subtask.agent_id) {
      const claudeMdPath = resolveAgentClaudeMd(subtask.agent_id);
      if (claudeMdPath) {
        try { systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8'); } catch { /* ok */ }
      }
    }

    // Build the prompt with verification criteria context
    let fullPrompt = subtask.prompt;
    if (systemPrompt) {
      fullPrompt = `[Agent role — follow these instructions]\n${systemPrompt}\n[End agent role]\n\n${fullPrompt}`;
    }
    if (subtask.verification_criteria) {
      fullPrompt += `\n\n[Success criteria: ${subtask.verification_criteria}]`;
    }

    // Determine model — use agent's default if specified
    let model: string | undefined;
    if (subtask.agent_id) {
      const card = agentCards.find((c) => c.id === subtask.agent_id);
      model = card?.model;
    }

    const result = await runAgent(fullPrompt, undefined, () => {}, undefined, model, abortCtrl);
    clearTimeout(timer);

    if (result.aborted) {
      updateSubtaskStatus(subtask.id, 'failed');
      setSubtaskError(subtask.id, 'Timed out');
      onProgress?.({
        missionId, subtaskId: subtask.id, agentId: subtask.agent_id,
        status: 'failed', description: 'Subtask timed out',
      });
      return;
    }

    const text = result.text?.trim() || 'Completed with no output.';
    const cost = result.usage?.totalCostUsd ?? 0;

    updateSubtaskStatus(subtask.id, 'completed');
    setSubtaskResult(subtask.id, text.slice(0, 8000), cost);

    onProgress?.({
      missionId, subtaskId: subtask.id, agentId: subtask.agent_id,
      status: 'completed', description: `Done: ${text.slice(0, 80)}`,
    });

    logToHiveMind(
      agentId, chatId, 'subtask_complete',
      `Subtask completed: ${subtask.prompt.slice(0, 60)} → ${text.slice(0, 60)}`,
    );
  } catch (err) {
    clearTimeout(timer);
    const errMsg = err instanceof Error ? err.message : String(err);

    updateSubtaskStatus(subtask.id, 'failed');
    setSubtaskError(subtask.id, errMsg.slice(0, 2000));

    onProgress?.({
      missionId, subtaskId: subtask.id, agentId: subtask.agent_id,
      status: 'failed', description: `Failed: ${errMsg.slice(0, 80)}`,
    });

    logToHiveMind(
      agentId, chatId, 'subtask_error',
      `Subtask failed: ${subtask.prompt.slice(0, 60)} → ${errMsg.slice(0, 60)}`,
    );

    throw err;
  }
}

// ── Plan Formatting ──────────────────────────────────────────────────

/**
 * Format a mission plan for display in Telegram (HTML).
 */
export function formatPlanForTelegram(goal: string, plan: MissionPlan, missionId: string): string {
  const lines: string[] = [
    `<b>Mission Plan</b>`,
    `<i>${escapeHtml(goal)}</i>`,
    '',
    `<b>Subtasks (${plan.subtasks.length}):</b>`,
  ];

  for (let i = 0; i < plan.subtasks.length; i++) {
    const st = plan.subtasks[i];
    const deps = st.dependsOn.length > 0 ? ` (after: ${st.dependsOn.map((_, j) => `#${j + 1}`).join(', ')})` : '';
    const agent = st.agentId ? `[${st.agentId}]` : `[worker]`;
    lines.push(`${i + 1}. ${agent} ${escapeHtml(st.prompt.slice(0, 120))}${deps}`);
    if (st.verification) {
      lines.push(`   <i>Verify: ${escapeHtml(st.verification.slice(0, 100))}</i>`);
    }
  }

  lines.push('');
  lines.push(`Reply <code>go</code> to approve or <code>revise: your feedback</code> to adjust.`);
  lines.push(`<code>Mission: ${missionId.slice(0, 8)}</code>`);

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
