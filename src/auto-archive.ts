import { Api, RawApi } from 'grammy';

import { ALLOWED_CHAT_IDS, AUTO_ARCHIVE_DAYS, FORUM_CHAT_ID } from './config.js';
import { getForumTopics } from './db.js';
import { logger } from './logger.js';
import { closeTopic, getStaleTopics, isForum } from './topic-manager.js';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Initialize auto-archive: periodically check all forum chats for stale topics
 * and close them. Sends a DM notification to the first ALLOWED_CHAT_ID.
 */
export function initAutoArchive(
  api: Api<RawApi>,
  intervalMs = DEFAULT_INTERVAL_MS,
): void {
  if (AUTO_ARCHIVE_DAYS <= 0) {
    logger.info('Auto-archive disabled (AUTO_ARCHIVE_DAYS <= 0)');
    return;
  }

  const run = async () => {
    try {
      await archiveStaleTopics(api);
    } catch (err) {
      logger.error({ err }, 'Auto-archive sweep failed');
    }
  };

  // Delay first run by 5 minutes after startup
  setTimeout(() => {
    void run();
    setInterval(() => void run(), intervalMs);
  }, 5 * 60 * 1000);

  logger.info(
    { intervalMs, maxAgeDays: AUTO_ARCHIVE_DAYS },
    'Auto-archive initialized',
  );
}

async function archiveStaleTopics(api: Api<RawApi>): Promise<void> {
  // Collect all chat IDs that might be forums
  const chatIds = new Set<string>();
  if (FORUM_CHAT_ID) chatIds.add(FORUM_CHAT_ID);

  // Also check ALLOWED_CHAT_IDS for forums
  for (const id of ALLOWED_CHAT_IDS) {
    if (await isForum(api, id)) {
      chatIds.add(id);
    }
  }

  if (chatIds.size === 0) return;

  for (const chatId of chatIds) {
    const stale = getStaleTopics(chatId, AUTO_ARCHIVE_DAYS);
    if (stale.length === 0) continue;

    logger.info({ chatId, count: stale.length }, 'Auto-archiving stale topics');

    for (const topic of stale) {
      try {
        await closeTopic(api, chatId, topic.topic_id);

        // Notify user's personal chat (first ALLOWED_CHAT_ID entry, which is typically the DM)
        await notifyDm(
          api,
          `Auto-archived topic "<b>${escapeHtml(topic.name)}</b>" (inactive ${AUTO_ARCHIVE_DAYS}+ days). Use /reopen ${topic.name} to restore.`,
        );
      } catch (err) {
        logger.warn({ err, chatId, topicId: topic.topic_id }, 'Failed to auto-archive topic');
      }
    }
  }
}

/**
 * Send a DM notification to the user's personal chat.
 * Uses the first entry in ALLOWED_CHAT_IDS (typically the DM chat ID).
 */
export async function notifyDm(api: Api<RawApi>, html: string): Promise<void> {
  const dmChatId = ALLOWED_CHAT_IDS[0];
  if (!dmChatId) return;

  try {
    await api.sendMessage(parseInt(dmChatId), html, { parse_mode: 'HTML' });
  } catch (err) {
    logger.warn({ err }, 'Failed to send DM notification');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
