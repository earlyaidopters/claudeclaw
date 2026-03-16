import { Api, RawApi } from 'grammy';

import { runAgent } from './agent.js';
import { BACKGROUND_MAX_CONCURRENT, AGENT_ID } from './config.js';
import { saveTokenUsage } from './db.js';
import { logger } from './logger.js';
import { saveConversationTurn } from './memory.js';
import { formatForTelegram, splitMessage } from './bot.js';

// ── Semaphore ─────────────────────────────────────────────────────────

class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }

  get running(): number {
    return this.current;
  }

  get queued(): number {
    return this.queue.length;
  }
}

const semaphore = new Semaphore(BACKGROUND_MAX_CONCURRENT);

// ── Background execution ──────────────────────────────────────────────

export interface BackgroundOpts {
  api: Api<RawApi>;
  chatId: string;
  topicId: string;
  message: string;
  sessionId: string | undefined;
}

/**
 * Fire-and-forget background task. Acquires a semaphore slot, runs the agent,
 * and posts the result back to the originating topic thread.
 * Does NOT use messageQueue (background tasks bypass per-topic FIFO).
 */
export function enqueueBackground(opts: BackgroundOpts): void {
  const { api, chatId, topicId, message, sessionId } = opts;

  void (async () => {
    await semaphore.acquire();
    try {
      logger.info({ chatId, topicId, messageLen: message.length }, 'Background task started');

      const result = await runAgent(
        message,
        sessionId,
        () => {}, // no typing indicator for background tasks
      );

      const response = result.text?.trim() || 'Background task completed with no output.';

      // Save conversation turn
      saveConversationTurn(chatId, message, response, result.newSessionId ?? sessionId, AGENT_ID, topicId);

      // Post result to topic thread
      const formatted = formatForTelegram(response);
      for (const part of splitMessage(formatted)) {
        await api.sendMessage(parseInt(chatId), part, {
          parse_mode: 'HTML',
          message_thread_id: parseInt(topicId),
        });
      }

      // Save token usage
      if (result.usage) {
        try {
          saveTokenUsage(
            chatId,
            result.newSessionId ?? sessionId,
            result.usage.inputTokens,
            result.usage.outputTokens,
            result.usage.lastCallCacheRead,
            result.usage.lastCallInputTokens,
            result.usage.totalCostUsd,
            result.usage.didCompact,
            AGENT_ID,
            topicId,
          );
        } catch (dbErr) {
          logger.error({ err: dbErr }, 'Background task: failed to save token usage');
        }
      }

      logger.info({ chatId, topicId }, 'Background task completed');
    } catch (err) {
      logger.error({ err, chatId, topicId }, 'Background task failed');
      try {
        const errMsg = err instanceof Error ? err.message : String(err);
        await api.sendMessage(
          parseInt(chatId),
          `Background task failed: ${errMsg.slice(0, 500)}`,
          { message_thread_id: parseInt(topicId) },
        );
      } catch {
        // Can't even post the error — give up
      }
    } finally {
      semaphore.release();
    }
  })();
}

/**
 * Get current background execution status.
 */
export function getBackgroundStatus(): { running: number; queued: number } {
  return { running: semaphore.running, queued: semaphore.queued };
}
