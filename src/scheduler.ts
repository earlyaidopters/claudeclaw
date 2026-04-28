import { CronExpressionParser } from 'cron-parser';

import { AGENT_ID, ALLOWED_CHAT_ID, agentMcpAllowlist } from './config.js';
import {
  getDueTasks,
  getSession,
  logConversationTurn,
  markTaskRunning,
  updateTaskAfterRun,
  resetStuckTasks,
  pauseScheduledTask,
  claimNextMissionTask,
  completeMissionTask,
  resetStuckMissionTasks,
  getNextPendingMessage,
  markInterAgentTaskInProgress,
  resetStuckInterAgentTasks,
  completeInterAgentTask,
  saveTaskResumeSession,
} from './db.js';
import { logger } from './logger.js';
import { messageQueue } from './message-queue.js';
import { runAgent } from './agent.js';
import { formatForTelegram, splitMessage } from './bot.js';
import { emitChatEvent } from './state.js';
import { loadAgentConfig } from './agent-config.js';

type Sender = (text: string) => Promise<void>;

/**
 * Task ID prefixes for poller-managed tasks where empty output is EXPECTED.
 * These tasks tell the agent "do nothing if there's nothing to do."
 * Empty output = agent had no work. Mark success, no warning.
 */
const SILENT_TASK_PREFIXES = ['mc-wake-'];

/**
 * All task ID prefixes managed by the MC poller.
 * These get deleted and recreated each cycle. Using 'failed' status on these
 * causes infinite retry loops because the poller treats 'failed' as retriable.
 * Empty output on non-silent poller tasks uses 'completed_empty' instead.
 */
const POLLER_MANAGED_PREFIXES = ['mc-wake-', 'verify-', 'content-review-'];

/** Task where empty output is expected behavior (agent had nothing to do). */
function isExpectedSilent(taskId: string): boolean {
  return SILENT_TASK_PREFIXES.some(prefix => taskId.startsWith(prefix));
}

/** Task managed by MC poller -- do NOT mark 'failed' on empty output. */
function isPollerManaged(taskId: string): boolean {
  return POLLER_MANAGED_PREFIXES.some(prefix => taskId.startsWith(prefix));
}

/** Default timeout (ms) for tasks when no agent-specific override exists. */
const DEFAULT_TASK_TIMEOUT_MS = 120 * 60 * 1000; // 120 minutes

/**
 * Resolve the timeout for a scheduled task based on the agent's config.
 * Uses task_timeout_minutes from agent.yaml if available, otherwise falls back
 * to DEFAULT_TASK_TIMEOUT_MS (120 minutes).
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

  // Recover tasks stuck in 'running' from a previous crash.
  // Only reset tasks older than the agent's configured timeout.
  const timeoutMs = resolveTaskTimeoutMs(agentId);
  const maxAgeSeconds = Math.floor(timeoutMs / 1000);

  const recovered = resetStuckTasks(agentId, maxAgeSeconds);
  if (recovered > 0) {
    logger.warn({ recovered, agentId, maxAgeSeconds }, 'Reset stuck scheduled tasks older than timeout');
  }
  const recoveredMission = resetStuckMissionTasks(agentId, maxAgeSeconds);
  if (recoveredMission > 0) {
    logger.warn({ recovered: recoveredMission, agentId, maxAgeSeconds }, 'Reset stuck mission tasks older than timeout');
  }
  const recoveredInterAgent = resetStuckInterAgentTasks(agentId, maxAgeSeconds);
  if (recoveredInterAgent > 0) {
    logger.warn({ recovered: recoveredInterAgent, agentId, maxAgeSeconds }, 'Reset stuck inter-agent tasks older than timeout');
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
      const rawText = result.text?.trim();

      if (!rawText) {
        completeInterAgentTask(message.id, 'failed', 'Agent produced no output');
        logger.warn({ id: message.id, fromAgent: message.from_agent }, 'Inter-agent task produced no output -- marked failed');
      } else {
        completeInterAgentTask(message.id, 'completed', rawText);

        if (ALLOWED_CHAT_ID) {
          const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'user', `[Inter-agent task from ${message.from_agent}]: ${message.prompt}`, activeSession ?? undefined, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'assistant', rawText, activeSession ?? undefined, schedulerAgentId);
        }

        logger.info({ id: message.id, fromAgent: message.from_agent }, 'Inter-agent task completed');
      }
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
    let nextRun: number;
    try {
      nextRun = computeNextRun(task.schedule);
    } catch (err) {
      logger.error(
        { taskId: task.id, schedule: task.schedule, err },
        'Invalid cron expression -- pausing task to prevent infinite retry',
      );
      pauseScheduledTask(task.id, `Invalid cron expression: ${task.schedule}`);
      continue;
    }

    const claimed = markTaskRunning(task.id, nextRun);
    if (!claimed) {
      logger.warn({ taskId: task.id }, 'Task already claimed by another tick, skipping');
      continue;
    }
    runningTaskIds.add(task.id);

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

        // Resume previous session if available (enables context continuity across
        // MC verification cycles -- agent retains memory of previous attempt).
        const resumeSessionId = task.resume_session_id || undefined;
        const result = await runAgent(task.prompt, resumeSessionId, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
        clearTimeout(timeout);

        // Persist session ID for potential re-dispatch (verification failure cycle).
        // Even on timeout/abort, save the session so the next attempt can resume.
        if (result.newSessionId) {
          saveTaskResumeSession(task.id, result.newSessionId);
        }

        if (result.aborted) {
          updateTaskAfterRun(task.id, nextRun, `Timed out after ${taskTimeoutLabel}`, 'timeout');
          await sender(`⏱ Task timed out after ${taskTimeoutLabel}: "${task.prompt.slice(0, 60)}..." — killed.`);
          logger.warn({ taskId: task.id, timeoutMs: taskTimeoutMs }, 'Task timed out');
          return;
        }

        const rawText = result.text?.trim();

        if (!rawText && isExpectedSilent(task.id)) {
          // Wake prompt with no output = agent had no tasks. Expected behavior.
          // Mark success so poller treats it as a normal completed cycle.
          updateTaskAfterRun(task.id, nextRun, '[no-op: agent had no assigned tasks]', 'success');
          logger.info({ taskId: task.id }, 'Wake prompt completed with no output (expected)');
        } else if (!rawText && isPollerManaged(task.id)) {
          // Poller-managed task (e.g., verify-*) with no output = unexpected.
          // Use 'completed_empty' -- NOT 'failed' which triggers poller retry loops.
          updateTaskAfterRun(task.id, nextRun, '[completed with no output]', 'completed_empty');
          logger.warn({ taskId: task.id }, 'Poller-managed task produced no output -- marked completed_empty (no retry)');
          try {
            await sender(`⚠️ Poller task produced no output (not retrying): "${task.prompt.slice(0, 80)}..."`);
          } catch (sendErr) {
            logger.warn({ sendErr, taskId: task.id }, 'Failed to send empty-output warning to Telegram');
          }
        } else if (!rawText) {
          // Non-poller task with empty output = genuine failure.
          updateTaskAfterRun(task.id, nextRun, 'Agent produced no output', 'failed');
          logger.warn({ taskId: task.id }, 'Scheduled task produced no output -- marked failed');
          try {
            await sender(`⚠️ Scheduled task produced no output: "${task.prompt.slice(0, 80)}..."`);
          } catch (sendErr) {
            logger.warn({ sendErr, taskId: task.id }, 'Failed to send empty-output warning to Telegram');
          }
        } else {
          for (const chunk of splitMessage(formatForTelegram(rawText))) {
            await sender(chunk);
          }

          if (ALLOWED_CHAT_ID) {
            const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'user', `[Scheduled task]: ${task.prompt}`, activeSession ?? undefined, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'assistant', rawText, activeSession ?? undefined, schedulerAgentId);
          }

          updateTaskAfterRun(task.id, nextRun, rawText, 'success');
        }

        logger.info({ taskId: task.id, nextRun, hasResumedSession: !!resumeSessionId }, 'Task complete, next run scheduled');
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
        const rawText = result.text?.trim();

        if (!rawText) {
          completeMissionTask(mission.id, null, 'failed', 'Agent produced no output');
          logger.warn({ missionId: mission.id }, 'Mission task produced no output -- marked failed');
          try {
            await sender(`⚠️ Mission task produced no output: "${mission.title}"`);
          } catch (sendErr) {
            logger.warn({ sendErr, missionId: mission.id }, 'Failed to send empty-output warning to Telegram');
          }
        } else {
          completeMissionTask(mission.id, rawText, 'completed');
          logger.info({ missionId: mission.id }, 'Mission task completed');

          for (const chunk of splitMessage(formatForTelegram(rawText))) {
            await sender(chunk);
          }

          if (ALLOWED_CHAT_ID) {
            const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'user', '[Mission task: ' + mission.title + ']: ' + mission.prompt, activeSession ?? undefined, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'assistant', rawText, activeSession ?? undefined, schedulerAgentId);
          }
        }
      }

      emitChatEvent({
        type: 'mission_update' as 'progress',
        chatId,
        content: JSON.stringify({
          id: mission.id,
          status: (result.aborted || !result.text?.trim()) ? 'failed' : 'completed',
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
