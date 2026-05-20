import { CronExpressionParser } from 'cron-parser';

import {
  AGENT_ID,
  ALLOWED_CHAT_ID,
  MISSION_TIMEOUT_MS,
  agentDefaultModel,
  agentMcpAllowlist,
  agentSystemPrompt,
} from './config.js';
import {
  getDueTasks,
  getSession,
  setSession,
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
import { formatForTelegram, splitMessage } from './bot.js';
import { buildMemoryContext } from './memory.js';
import { emitChatEvent } from './state.js';

type Sender = (text: string) => Promise<void>;

/** Max time (ms) a scheduled or mission task can run before being killed. */
const TASK_TIMEOUT_MS = MISSION_TIMEOUT_MS;

let sender: Sender;

/**
 * In-memory set of task IDs currently being executed.
 * Acts as a fast-path guard alongside the DB-level lock in markTaskRunning.
 */
const runningTaskIds = new Set<string>();

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
  // Mission tasks (especially chat-type) need sub-minute latency. Run a
  // self-pacing loop: poll every 2s when work is flowing, back off up to
  // 30s when the queue is idle. Keeps chat latency sub-second under load
  // and avoids burning ~216k no-op DB reads per agent per day at rest.
  scheduleNextMissionPoll(2_000);
  logger.info({ agentId }, 'Scheduler started (scheduled: 60s, mission: 2-30s adaptive)');
}

const MISSION_POLL_MIN_MS = 2_000;
const MISSION_POLL_MAX_MS = 30_000;
let missionPollDelay = MISSION_POLL_MIN_MS;

function scheduleNextMissionPoll(delay: number): void {
  setTimeout(async () => {
    try {
      const claimed = await runDueMissionTasks();
      // Reset to fast polling on any claim (chat latency is a user-facing
      // signal). Otherwise widen by ~50% up to the cap.
      if (claimed) {
        missionPollDelay = MISSION_POLL_MIN_MS;
      } else {
        missionPollDelay = Math.min(MISSION_POLL_MAX_MS, Math.floor(missionPollDelay * 1.5));
      }
    } catch (err) {
      logger.error({ err }, 'Mission poll iteration failed');
    } finally {
      scheduleNextMissionPoll(missionPollDelay);
    }
  }, delay);
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
        await sender(`Scheduled task running: "${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '...' : ''}"`);

        // Run as a fresh agent call (no session — scheduled tasks are autonomous)
        const result = await runAgent(task.prompt, undefined, () => {}, undefined, undefined, abortController, undefined, agentMcpAllowlist);
        clearTimeout(timeout);

        if (result.aborted) {
          const mins = Math.round(TASK_TIMEOUT_MS / 60000);
          updateTaskAfterRun(task.id, nextRun, `Timed out after ${mins} minutes`, 'timeout');
          await sender(`⏱ Task timed out after ${mins}m: "${task.prompt.slice(0, 60)}..." — killed.`);
          logger.warn({ taskId: task.id, timeoutMs: TASK_TIMEOUT_MS }, 'Task timed out');
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

}

async function runDueMissionTasks(): Promise<boolean> {
  const mission = claimNextMissionTask(schedulerAgentId);
  if (!mission) return false;

  const missionKey = 'mission-' + mission.id;
  if (runningTaskIds.has(missionKey)) return false;
  runningTaskIds.add(missionKey);

  const isChat = mission.type === 'chat';
  const chatScope = isChat && mission.chat_id ? mission.chat_id : (ALLOWED_CHAT_ID || 'mission');

  logger.info(
    { missionId: mission.id, title: mission.title, type: mission.type, chatId: mission.chat_id },
    'Running mission task',
  );

  messageQueue.enqueue(chatScope, async () => {
    const abortController = new AbortController();
    const effectiveTimeout = mission.timeout_ms ?? TASK_TIMEOUT_MS;
    const timeoutMins = Math.round(effectiveTimeout / 60000);
    const timeout = setTimeout(() => abortController.abort(), effectiveTimeout);

    try {
      // Build the prompt. Chat-type tasks get session, memory, and system prompt
      // so they behave like a proper conversational turn. Async tasks stay
      // stateless as they were before.
      let sessionId: string | undefined;
      let fullPrompt = mission.prompt;

      if (isChat && mission.chat_id) {
        sessionId = getSession(mission.chat_id, schedulerAgentId);
        const parts: string[] = [];
        if (agentSystemPrompt && !sessionId) {
          parts.push(`[Agent role — follow these instructions]\n${agentSystemPrompt}\n[End agent role]`);
        }
        try {
          const { contextText } = await buildMemoryContext(mission.chat_id, mission.prompt, schedulerAgentId);
          if (contextText) parts.push(contextText);
        } catch (memErr) {
          logger.warn({ err: memErr, chatId: mission.chat_id }, 'Memory context build failed; continuing without it');
        }
        parts.push(mission.prompt);
        fullPrompt = parts.join('\n\n');
      }

      const result = await runAgent(
        fullPrompt,
        sessionId,
        () => {},
        undefined,
        agentDefaultModel,
        abortController,
        undefined,
        agentMcpAllowlist,
      );
      clearTimeout(timeout);

      if (result.aborted) {
        completeMissionTask(mission.id, null, 'failed', `Timed out after ${timeoutMins} minutes`);
        logger.warn({ missionId: mission.id, timeoutMs: effectiveTimeout, type: mission.type }, 'Mission task timed out');
        if (isChat && mission.chat_id) {
          // Chat-type timeouts surface through the SSE error channel so the
          // dashboard tab can show them inline — no Telegram relay.
          emitChatEvent({
            type: 'error',
            chatId: mission.chat_id,
            agentId: schedulerAgentId,
            content: `Agent "${schedulerAgentId}" timed out after ${timeoutMins} minutes.`,
          });
        } else {
          try {
            await sender('Mission task timed out: "' + mission.title + '"');
          } catch (sendErr) {
            // Sender can fail for Telegram API blips or chat-not-found. We
            // still want to see it so the user isn't silently unnotified.
            logger.warn({ err: sendErr, missionId: mission.id }, 'Failed to send mission timeout notification');
          }
        }
      } else {
        const text = result.text?.trim() || 'Task completed with no output.';
        completeMissionTask(mission.id, text, 'completed');
        logger.info({ missionId: mission.id, type: mission.type }, 'Mission task completed');

        if (isChat && mission.chat_id) {
          // Save both turns under this agent's id so history reads correctly
          // in the Mission Control tab. Skip Telegram relay — chat tasks are
          // dashboard-scoped.
          if (result.newSessionId) {
            setSession(mission.chat_id, result.newSessionId, schedulerAgentId);
          }
          const turnSession = result.newSessionId ?? sessionId;
          logConversationTurn(mission.chat_id, 'user', mission.prompt, turnSession, schedulerAgentId);
          logConversationTurn(mission.chat_id, 'assistant', text, turnSession, schedulerAgentId);
        } else {
          // Async mission: existing behavior — Telegram relay + ALLOWED_CHAT_ID log.
          for (const chunk of splitMessage(formatForTelegram(text))) {
            await sender(chunk);
          }
          if (ALLOWED_CHAT_ID) {
            const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'user', '[Mission task: ' + mission.title + ']: ' + mission.prompt, activeSession ?? undefined, schedulerAgentId);
            logConversationTurn(ALLOWED_CHAT_ID, 'assistant', text, activeSession ?? undefined, schedulerAgentId);
          }
        }
      }

      emitChatEvent({
        type: 'mission_update',
        chatId: chatScope,
        agentId: schedulerAgentId,
        content: JSON.stringify({
          id: mission.id,
          status: result.aborted ? 'failed' : 'completed',
          title: mission.title,
          type: mission.type,
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
  return true;
}

export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}
