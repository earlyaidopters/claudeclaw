import { CronExpressionParser } from 'cron-parser';

import { ALLOWED_CHAT_ID } from './config.js';
import {
  getDueTasks,
  updateTaskAfterRun,
} from './db.js';
import { logger } from './logger.js';
import { runAgent } from './agent.js';
import { formatForTelegram } from './bot.js';

type Sender = (text: string) => Promise<void>;

let sender: Sender;

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
  setInterval(() => void runDueTasks(), 60_000);
  logger.info({ agentId }, 'Scheduler started (checking every 60s)');
}

async function runDueTasks(): Promise<void> {
  const tasks = getDueTasks(schedulerAgentId);
  if (tasks.length === 0) return;

  logger.info({ count: tasks.length }, 'Running due scheduled tasks');

  for (const task of tasks) {
    logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 60) }, 'Firing task');

    try {
      await sender(`Scheduled task running: "${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '...' : ''}"`);

      // Run as a fresh agent call (no session — scheduled tasks are autonomous)
      const result = await runAgent(task.prompt, undefined, () => {});
      const text = result.text?.trim() || 'Task completed with no output.';

      await sender(formatForTelegram(text));

      const nextRun = computeNextRun(task.schedule);
      updateTaskAfterRun(task.id, nextRun, text);

      logger.info({ taskId: task.id, nextRun }, 'Task complete, next run scheduled');
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Scheduled task failed');
      try {
        await sender(`Task failed: "${task.prompt.slice(0, 60)}..." — check logs.`);
      } catch {
        // ignore send failure
      }
    }
  }
}

export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}
