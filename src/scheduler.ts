import { CronExpressionParser } from 'cron-parser';

import { AGENT_ID, ALLOWED_CHAT_ID, agentMcpAllowlist } from './config.js';
import { resolveModelAlias } from './model-aliases.js';
import {
  getDueTasks,
  getSession,
  logConversationTurn,
  markTaskRunning,
  updateTaskAfterRun,
  resetStuckTasks,
  claimNextMissionTask,
  completeMissionTask,
  resetStuckMissionTasks,
} from './db.js';
import { logger } from './logger.js';
import { messageQueue } from './message-queue.js';
import { runAgent } from './agent.js';
import { formatForTelegram } from './bot.js';
import { emitChatEvent } from './state.js';
import { sendAlert } from './alert-router.js';
import { notifyMissionCompletion } from './mission-autopush.js';
import { maybeAdvanceCallPipeline } from './call-pipeline/chain-hook.js';

type Sender = (text: string) => Promise<void>;

/** Max time (ms) a scheduled task can run before being killed.
 *  Configurable via SCHEDULED_TASK_TIMEOUT_MS in .env.
 *  Default: 30 minutes (DION storyboard pipelines need 12–25 min). */
const TASK_TIMEOUT_MS = parseInt(process.env.SCHEDULED_TASK_TIMEOUT_MS || '1800000', 10);

let sender: Sender;

/**
 * In-memory set of task IDs currently being executed.
 * Acts as a fast-path guard alongside the DB-level lock in markTaskRunning.
 */
const runningTaskIds = new Set<string>();

/**
 * Fire-and-forget call-pipeline chain hook. The hook itself is a silent
 * no-op for any non-pipeline mission, but we still wrap it so an
 * unexpected bug in chain advancement never crashes the scheduler or
 * prevents the next mission from being claimed.
 */
function advanceCallPipelineSafely(missionId: string): void {
  try {
    const r = maybeAdvanceCallPipeline(missionId);
    if (r.fired) {
      logger.info(
        {
          missionId,
          stage: r.stage,
          callMsgId: r.callMsgId,
          reason: r.reason,
          nextStageMissionId: r.nextStage?.missionId ?? null,
        },
        'call-pipeline: advanced',
      );
    }
  } catch (err) {
    logger.error({ err, missionId }, 'call-pipeline: chain hook threw');
  }
}

/**
 * Initialise the scheduler. Call once after the Telegram bot is ready.
 * @param send  Function that sends a message to the user's Telegram chat.
 */
let schedulerAgentId = 'main';

export function initScheduler(send: Sender, agentId = 'main'): void {
  if (!ALLOWED_CHAT_ID) {
    logger.warn('ALLOWED_CHAT_ID not set — scheduler will not send results');
  }
  sender = send;
  schedulerAgentId = agentId;

  // Recover tasks stuck in 'running' from a previous crash
  const recovered = resetStuckTasks(agentId);
  if (recovered > 0) {
    logger.warn({ recovered, agentId }, 'Reset stuck tasks from previous crash');
  }
  const recoveredMission = resetStuckMissionTasks(agentId);
  if (recoveredMission > 0) {
    logger.warn({ recovered: recoveredMission, agentId }, 'Reset stuck mission tasks from previous crash');
  }

  setInterval(() => void runDueTasks(), 60_000);
  logger.info({ agentId }, 'Scheduler started (checking every 60s)');
}

async function runDueTasks(): Promise<void> {
  const tasks = getDueTasks(schedulerAgentId);

  if (tasks.length > 0) {
    logger.info({ count: tasks.length }, 'Running due scheduled tasks');
  }

  for (const task of tasks) {
    // In-memory guard: skip if already running in this process
    if (runningTaskIds.has(task.id)) {
      logger.warn({ taskId: task.id }, 'Task already running, skipping duplicate fire');
      continue;
    }

    // Compute next occurrence BEFORE executing so we can lock the task
    // in the DB immediately, preventing re-fire on subsequent ticks.
    const nextRun = computeNextRun(task.schedule);
    runningTaskIds.add(task.id);
    markTaskRunning(task.id, nextRun);

    logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 60) }, 'Firing task');

    // Route through the message queue so scheduled tasks wait for any
    // in-flight user message to finish before running. This prevents
    // two Claude processes from hitting the same session simultaneously.
    const chatId = ALLOWED_CHAT_ID || 'scheduler';
    messageQueue.enqueue(chatId, async () => {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

      try {
        // Pre-run "Scheduled task running: ..." ping intentionally removed —
        // alert-router would drop it anyway. Silence the spam.

        // Run as a fresh agent call (no session — scheduled tasks are autonomous)
        const result = await runAgent(task.prompt, undefined, () => {}, undefined, resolveModelAlias(task.model), abortController, undefined, agentMcpAllowlist);
        clearTimeout(timeout);

        if (result.aborted) {
          const mins = Math.round(TASK_TIMEOUT_MS / 60000);
          updateTaskAfterRun(task.id, nextRun, `Timed out after ${mins} minutes`, 'timeout');
          await sendAlert({
            agentId: task.agent_id || schedulerAgentId,
            chatId,
            content: `⏱ Task timed out after ${mins}m: "${task.prompt.slice(0, 60)}..." — killed.`,
            category: 'failure',
            meta: { taskId: task.id },
          });
          logger.warn({ taskId: task.id, timeoutMs: TASK_TIMEOUT_MS }, 'Task timed out');
          return;
        }

        const text = result.text?.trim() || 'Task completed with no output.';
        // Route through alert-router. For realtime/legacy behaviour it chunks
        // internally; for digest it queues the full payload.
        await sendAlert({
          agentId: task.agent_id || schedulerAgentId,
          chatId,
          content: formatForTelegram(text),
          category: 'task_result',
          meta: { taskId: task.id, prompt: task.prompt.slice(0, 80) },
        });

        // Inject task output into the active chat session so user replies have context
        if (ALLOWED_CHAT_ID) {
          const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'user', `[Scheduled task]: ${task.prompt}`, activeSession ?? undefined, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'assistant', text, activeSession ?? undefined, schedulerAgentId);
        }

        updateTaskAfterRun(task.id, nextRun, text, 'success');

        logger.info({ taskId: task.id, nextRun }, 'Task complete, next run scheduled');
      } catch (err) {
        clearTimeout(timeout);
        const errMsg = err instanceof Error ? err.message : String(err);
        updateTaskAfterRun(task.id, nextRun, errMsg.slice(0, 500), 'failed');

        logger.error({ err, taskId: task.id }, 'Scheduled task failed');
        try {
          await sendAlert({
            agentId: task.agent_id || schedulerAgentId,
            chatId,
            content: `❌ Task failed: "${task.prompt.slice(0, 60)}..." — ${errMsg.slice(0, 200)}`,
            category: 'error',
            meta: { taskId: task.id },
          });
        } catch {
          // ignore send failure
        }
      } finally {
        runningTaskIds.delete(task.id);
      }
    });
  }

  // Also check for queued mission tasks (one-shot async tasks from Mission Control)
  await runDueMissionTasks();
}

async function runDueMissionTasks(): Promise<void> {
  const mission = claimNextMissionTask(schedulerAgentId);
  if (!mission) return;

  const missionKey = 'mission-' + mission.id;
  if (runningTaskIds.has(missionKey)) return;
  runningTaskIds.add(missionKey);

  logger.info({ missionId: mission.id, title: mission.title }, 'Running mission task');

  const chatId = ALLOWED_CHAT_ID || 'mission';
  // If acceptance_criteria is set, wrap the prompt with a verification contract.
  // The runner will parse the agent's final output for ACCEPTANCE: PASS / FAIL: <reason>.
  const hasAcceptance = typeof mission.acceptance_criteria === 'string' && mission.acceptance_criteria.trim().length > 0;
  const effectivePrompt = hasAcceptance
    ? (
        mission.prompt +
        '\n\n# Acceptance criteria\n' +
        mission.acceptance_criteria +
        '\n\nAfter your work, verify each criterion. End your response with exactly: ACCEPTANCE: PASS  OR  ACCEPTANCE: FAIL: <reason>'
      )
    : mission.prompt;

  messageQueue.enqueue(chatId, async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

    try {
      const result = await runAgent(effectivePrompt, undefined, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
      clearTimeout(timeout);

      if (result.aborted) {
        const mins = Math.round(TASK_TIMEOUT_MS / 60000);
        completeMissionTask(mission.id, null, 'failed', `Timed out after ${mins} minutes`);
        notifyMissionCompletion(mission.id);
        advanceCallPipelineSafely(mission.id);
        logger.warn({ missionId: mission.id, timeoutMs: TASK_TIMEOUT_MS }, 'Mission task timed out');
        try {
          await sendAlert({
            agentId: mission.assigned_agent || schedulerAgentId,
            chatId,
            content: 'Mission task timed out: "' + mission.title + '"',
            category: 'failure',
            meta: { missionId: mission.id },
          });
        } catch {}
      } else {
        const text = result.text?.trim() || 'Task completed with no output.';

        // Acceptance criteria enforcement: parse final ACCEPTANCE: line from output.
        // Accept both PASS and FAIL: <reason>. If criteria set but no verdict found, fail explicitly.
        let finalStatus: 'completed' | 'failed' = 'completed';
        let failureReason: string | undefined;
        if (hasAcceptance) {
          const verdict = parseAcceptanceVerdict(text);
          if (verdict.kind === 'pass') {
            finalStatus = 'completed';
          } else if (verdict.kind === 'fail') {
            finalStatus = 'failed';
            failureReason = 'ACCEPTANCE FAIL: ' + verdict.reason;
          } else {
            finalStatus = 'failed';
            failureReason = 'ACCEPTANCE: verdict line missing from final output';
          }
        }

        if (finalStatus === 'completed') {
          completeMissionTask(mission.id, text, 'completed');
          notifyMissionCompletion(mission.id);
          advanceCallPipelineSafely(mission.id);
          logger.info({ missionId: mission.id, acceptance: hasAcceptance ? 'pass' : 'n/a' }, 'Mission task completed');
          await sendAlert({
            agentId: mission.assigned_agent || schedulerAgentId,
            chatId,
            content: formatForTelegram(text),
            category: 'mission_result',
            meta: { missionId: mission.id, title: mission.title },
          });
        } else {
          completeMissionTask(mission.id, text, 'failed', failureReason?.slice(0, 500));
          notifyMissionCompletion(mission.id);
          advanceCallPipelineSafely(mission.id);
          logger.warn({ missionId: mission.id, reason: failureReason }, 'Mission task failed acceptance');
          await sendAlert({
            agentId: mission.assigned_agent || schedulerAgentId,
            chatId,
            content: 'Mission failed acceptance: "' + mission.title + '"\n' + (failureReason ?? '') + '\n\n' + formatForTelegram(text),
            category: 'failure',
            meta: { missionId: mission.id, title: mission.title },
          });
        }

        // Inject into conversation context so agent can reference it
        if (ALLOWED_CHAT_ID) {
          const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'user', '[Mission task: ' + mission.title + ']: ' + mission.prompt, activeSession ?? undefined, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'assistant', text, activeSession ?? undefined, schedulerAgentId);
        }
      }

      emitChatEvent({
        type: 'mission_update' as 'progress',
        chatId,
        content: JSON.stringify({
          id: mission.id,
          status: result.aborted ? 'failed' : 'completed',
          title: mission.title,
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err instanceof Error ? err.message : String(err);
      completeMissionTask(mission.id, null, 'failed', errMsg.slice(0, 500));
      notifyMissionCompletion(mission.id);
      advanceCallPipelineSafely(mission.id);
      logger.error({ err, missionId: mission.id }, 'Mission task failed');
    } finally {
      runningTaskIds.delete(missionKey);
    }
  });
}

/**
 * Parse the final ACCEPTANCE: verdict line from an agent's output.
 * Scans from the end so earlier mentions (e.g. in reasoning) don't override the final verdict.
 * Returns:
 *   { kind: 'pass' }                     if a PASS verdict is found
 *   { kind: 'fail', reason: string }     if a FAIL: <reason> verdict is found
 *   { kind: 'missing' }                  if no ACCEPTANCE: line is present
 */
function parseAcceptanceVerdict(
  text: string,
): { kind: 'pass' } | { kind: 'fail'; reason: string } | { kind: 'missing' } {
  if (!text) return { kind: 'missing' };
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i];
    if (!raw) continue;
    // Strip leading/trailing whitespace and common markdown decoration (backticks, bold, quotes)
    const line = raw.trim().replace(/^[`*>_\s"']+|[`*_\s"']+$/g, '');
    const m = /^ACCEPTANCE\s*:\s*(PASS|FAIL(?:\s*:\s*(.*))?)\s*$/i.exec(line);
    if (!m) continue;
    const verdict = m[1].toUpperCase();
    if (verdict.startsWith('PASS')) return { kind: 'pass' };
    const reason = (m[2] || '').trim() || 'no reason provided';
    return { kind: 'fail', reason };
  }
  return { kind: 'missing' };
}

export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}
