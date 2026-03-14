/**
 * Result Poller
 *
 * Polls the dispatch_queue for completed/failed tasks and delivers
 * results back to the user via Telegram.
 *
 * Runs in the main bot process on a 10-second interval. When a worker
 * completes a task, the result sits in the queue until this poller
 * picks it up and sends it to the correct Telegram chat.
 */

import fs from 'fs';

import { Api, InputFile, RawApi } from 'grammy';

import { getTasksByChatId, type DispatchTask } from './dispatch.js';
import { logger } from './logger.js';
import { formatForTelegram, splitMessage, extractFileMarkers } from './bot.js';

const POLL_INTERVAL_MS = 10_000;
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Track which tasks we've already notified about (in-memory, resets on restart)
const notifiedTasks = new Set<string>();

/**
 * Start polling for completed dispatch tasks.
 * Call this once during bot startup.
 */
export function startResultPoller(
  botApi: Api<RawApi>,
  chatId: string,
): void {
  if (pollInterval) return; // Already running

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'Result poller started');

  pollInterval = setInterval(() => {
    void pollResults(botApi, chatId).catch((err) =>
      logger.error({ err }, 'Result poller error'),
    );
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the result poller.
 */
export function stopResultPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * Single poll cycle — check for completed tasks and deliver results.
 */
async function pollResults(botApi: Api<RawApi>, chatId: string): Promise<void> {
  // Get recently completed/failed tasks for this chat
  const completed = getTasksByChatId(chatId, 'completed', 50);
  const failed = getTasksByChatId(chatId, 'failed', 50);
  const tasks = [...completed, ...failed];

  for (const task of tasks) {
    // Skip already-notified tasks
    if (notifiedTasks.has(task.id)) continue;
    notifiedTasks.add(task.id);

    try {
      if (task.status === 'completed' && task.result) {
        const { text, files } = extractFileMarkers(task.result);

        // Send files first
        for (const file of files) {
          try {
            if (fs.existsSync(file.filePath)) {
              if (file.type === 'photo') {
                await botApi.sendMessage(parseInt(chatId), `Sending file from completed task...`);
                await botApi.sendPhoto(parseInt(chatId), new InputFile(file.filePath), {
                  caption: file.caption || undefined,
                });
              } else {
                await botApi.sendDocument(parseInt(chatId), new InputFile(file.filePath), {
                  caption: file.caption || undefined,
                });
              }
            }
          } catch (fileErr) {
            logger.error({ err: fileErr, path: file.filePath }, 'Failed to send dispatched file');
          }
        }

        // Send result text
        const elapsed = task.completed_at && task.claimed_at
          ? `${task.completed_at - task.claimed_at}s`
          : '';
        const header = `<b>[${task.worker_hint}${elapsed ? ` ${elapsed}` : ''}]</b>`;

        for (const part of splitMessage(formatForTelegram(`${header}\n\n${text}`))) {
          await botApi.sendMessage(parseInt(chatId), part, { parse_mode: 'HTML' });
        }
      } else if (task.status === 'failed') {
        await botApi.sendMessage(
          parseInt(chatId),
          `Task failed (${task.worker_hint}): ${task.error || 'Unknown error'}`,
        );
      }
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Failed to deliver dispatch result');
    }
  }

  // Prevent unbounded growth of notified set — prune entries older than 1 hour
  if (notifiedTasks.size > 1000) {
    notifiedTasks.clear();
  }
}
