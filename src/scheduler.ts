import { CronExpressionParser } from 'cron-parser';

import { AGENT_ID, ALLOWED_CHAT_ID, agentMcpAllowlist } from './config.js';
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
  getNextPendingMessage,
  markInterAgentTaskInProgress,
  resetStuckInterAgentTasks,
  completeInterAgentTask,
} from './db.js';
import { logger } from './logger.js';
import { messageQueue } from './message-queue.js';
import { runAgent } from './agent.js';
import { formatForTelegram, splitMessage } from './bot.js';
import { emitChatEvent } from './state.js';
import { loadAgentConfig } from './agent-config.js';

type Sender = (text: string) => Promise<void>;

/** Default timeout (ms) for tasks when no agent-specific override exists. */
const DEFAULT_TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolve the timeout for a scheduled task based on the agent's config.
 * Uses task_timeout_minutes from agent.yaml if available, otherwise falls back
 * to DEFAULT_TASK_TIMEOUT_MS (10 minutes).
 */
function resolveTaskTimeoutMs(agentId: string): number {
  try {
    const config = loadAgentConfig(agentId);
    if (config.taskTimeoutMinutes) {
      return config.taskTimeoutMinutes * 60 * 1000;
    }
  } catch {
    // Agent config not found or broken -- use default
  }
  return DEFAULT_TASK_TIMEOUT_MS;
}

let sender: Sender;

/**
 * In-memory set of task IDs currently being executed.
 * Acts as a fast-path guard alongside the DB-level lock in markTaskRunning.
 */
const runningTaskIds = new Set<string>();

/**
 * Guard flag for inter-agent message processing.
 * Prevents parallel execution of checkInterAgentMessages() if a poll fires
 * while a previous message is still being processed.
 */
let messageProcessing = false;

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

  const recoveredInterAgent = resetStuckInterAgentTasks(agentId);
  if (recoveredInterAgent > 0) {
    logger.warn({ recovered: recoveredInterAgent, agentId }, 'Reset stuck inter-agent tasks from previous crash');
  }

  setInterval(() => void runDueTasks(), 60_000);
  setInterval(() => void checkInterAgentMessages(), 30_000);
  logger.info({ agentId }, 'Scheduler started (checking every 60s, inter-agent messages every 30s)');
}

/**
 * Trigger an immediate scheduler tick (bypasses the 60s interval).
 * Called by the SIGUSR1 handler so that nudgeAgent() actually results in
 * near-instant task pickup instead of waiting up to 60s for the next poll.
 */
export function triggerSchedulerTick(): void {
  logger.info('Scheduler: SIGUSR1 received -- running immediate tick');
  void runDueTasks();
}

/**
 * Trigger an immediate inter-agent message check (bypasses the 30s poll interval).
 * Called by the SIGUSR1 handler when nudgeAgent() wakes this process.
 */
export function triggerMessageCheck(): void {
  logger.info('Scheduler: triggering immediate inter-agent message check');
  void checkInterAgentMessages();
}

/**
 * Poll for pending inter-agent messages addressed to this agent.
 * Processes them one at a time in FIFO order. After completing a message,
 * immediately checks for the next one to drain the queue.
 */
async function checkInterAgentMessages(): Promise<void> {
  if (messageProcessing) return;

  const message = getNextPendingMessage(schedulerAgentId);
  if (!message) return;

  messageProcessing = true;
  markInterAgentTaskInProgress(message.id);
  logger.info({ id: message.id, fromAgent: message.from_agent, prompt: message.prompt.slice(0, 60) }, 'Processing inter-agent message');

  // Resolve timeout from the receiving agent's config (agent.yaml task_timeout_minutes).
  // Previously hardcoded at 10 minutes, which killed build tasks for agents with longer timeouts.
  const taskTimeoutMs = resolveTaskTimeoutMs(message.to_agent);
  const taskTimeoutLabel = taskTimeoutMs >= 60_000
    ? `${Math.round(taskTimeoutMs / 60_000)}m`
    : `${Math.round(taskTimeoutMs / 1000)}s`;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), taskTimeoutMs);

  try {
    const result = await runAgent(message.prompt, undefined, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
    clearTimeout(timeout);

    if (result.aborted) {
      completeInterAgentTask(message.id, 'failed', `Timed out after ${taskTimeoutLabel}`);
      logger.warn({ id: message.id, timeoutMs: taskTimeoutMs }, 'Inter-agent task timed out');
    } else {
      const text = result.text?.trim() || 'Task completed with no output.';
      completeInterAgentTask(message.id, 'completed', text);

      // Inject into conversation context so the agent can reference it
      if (ALLOWED_CHAT_ID) {
        const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
        logConversationTurn(ALLOWED_CHAT_ID, 'user', `[Inter-agent task from ${message.from_agent}]: ${message.prompt}`, activeSession ?? undefined, schedulerAgentId);
        logConversationTurn(ALLOWED_CHAT_ID, 'assistant', text, activeSession ?? undefined, schedulerAgentId);
      }

      logger.info({ id: message.id, fromAgent: message.from_agent }, 'Inter-agent task completed');
    }
  } catch (err) {
    clearTimeout(timeout);
    const errMsg = err instanceof Error ? err.message : String(err);
    completeInterAgentTask(message.id, 'failed', errMsg.slice(0, 500));
    logger.error({ err, id: message.id }, 'Inter-agent task failed');
  } finally {
    messageProcessing = false;
    // Drain: check immediately for the next queued message
    const next = getNextPendingMessage(schedulerAgentId);
    if (next) {
      void checkInterAgentMessages();
    }
  }
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
    const taskTimeoutMs = resolveTaskTimeoutMs(schedulerAgentId);
    const taskTimeoutLabel = taskTimeoutMs >= 60_000
      ? `${Math.round(taskTimeoutMs / 60_000)}m`
      : `${Math.round(taskTimeoutMs / 1000)}s`;

    messageQueue.enqueue(chatId, async () => {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), taskTimeoutMs);

      try {
        await sender(`Scheduled task running: "${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '...' : ''}"`);

        // Run as a fresh agent call (no session — scheduled tasks are autonomous)
        const result = await runAgent(task.prompt, undefined, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
        clearTimeout(timeout);

        if (result.aborted) {
          updateTaskAfterRun(task.id, nextRun, `Timed out after ${taskTimeoutLabel}`, 'timeout');
          await sender(`⏱ Task timed out after ${taskTimeoutLabel}: "${task.prompt.slice(0, 60)}..." — killed.`);
          logger.warn({ taskId: task.id, timeoutMs: taskTimeoutMs }, 'Task timed out');
          return;
        }

        const text = result.text?.trim() || 'Task completed with no output.';
        for (const chunk of splitMessage(formatForTelegram(text))) {
          await sender(chunk);
        }

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
          await sender(`❌ Task failed: "${task.prompt.slice(0, 60)}..." — ${errMsg.slice(0, 200)}`);
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
  const missionTimeoutMs = resolveTaskTimeoutMs(schedulerAgentId);
  const missionTimeoutLabel = missionTimeoutMs >= 60_000
    ? `${Math.round(missionTimeoutMs / 60_000)}m`
    : `${Math.round(missionTimeoutMs / 1000)}s`;

  messageQueue.enqueue(chatId, async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), missionTimeoutMs);

    try {
      const result = await runAgent(mission.prompt, undefined, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
      clearTimeout(timeout);

      if (result.aborted) {
        completeMissionTask(mission.id, null, 'failed', `Timed out after ${missionTimeoutLabel}`);
        logger.warn({ missionId: mission.id, timeoutMs: missionTimeoutMs }, 'Mission task timed out');
        try { await sender('Mission task timed out: "' + mission.title + '"'); } catch {}
      } else {
        const text = result.text?.trim() || 'Task completed with no output.';
        completeMissionTask(mission.id, text, 'completed');
        logger.info({ missionId: mission.id }, 'Mission task completed');

        // Send result to Telegram
        for (const chunk of splitMessage(formatForTelegram(text))) {
          await sender(chunk);
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
      logger.error({ err, missionId: mission.id }, 'Mission task failed');
    } finally {
      runningTaskIds.delete(missionKey);
    }
  });
}

export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}
