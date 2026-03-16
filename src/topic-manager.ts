import { Api, RawApi } from 'grammy';

import {
  saveForumTopic,
  getForumTopics,
  getForumTopic,
  getForumTopicByName,
  updateTopicActivity,
  updateTopicStatus,
  getStaleForumTopics,
  ForumTopic,
} from './db.js';
import { FORUM_CHAT_ID } from './config.js';
import { logger } from './logger.js';

// ── Forum detection cache ─────────────────────────────────────────────
// grammY's inline chat object doesn't always include is_forum.
// Cache a full getChat() call per unique chat_id on first message.
const forumCache = new Map<string, boolean>();

/**
 * Check whether a chat is a Telegram Forum Group.
 * Uses FORUM_CHAT_ID config override, then cached getChat() result.
 */
export async function isForum(api: Api<RawApi>, chatId: string): Promise<boolean> {
  if (FORUM_CHAT_ID && chatId === FORUM_CHAT_ID) return true;

  const cached = forumCache.get(chatId);
  if (cached !== undefined) return cached;

  try {
    const chat = await api.getChat(parseInt(chatId));
    const result = !!((chat as unknown) as Record<string, unknown>)['is_forum'];
    forumCache.set(chatId, result);
    return result;
  } catch (err) {
    logger.warn({ err, chatId }, 'Failed to check if chat is forum');
    forumCache.set(chatId, false);
    return false;
  }
}

export interface CreatedTopic {
  messageThreadId: number;
  name: string;
}

/**
 * Create a new forum topic via Telegram API and save to DB.
 */
export async function createTopic(
  api: Api<RawApi>,
  chatId: string,
  name: string,
): Promise<CreatedTopic> {
  const result = await api.createForumTopic(parseInt(chatId), name);
  saveForumTopic(chatId, result.message_thread_id.toString(), name, 'bot');
  logger.info({ chatId, topicId: result.message_thread_id, name }, 'Created forum topic');
  return { messageThreadId: result.message_thread_id, name };
}

/**
 * Close (archive) a forum topic.
 */
export async function closeTopic(
  api: Api<RawApi>,
  chatId: string,
  messageThreadId: string,
): Promise<void> {
  await api.closeForumTopic(parseInt(chatId), parseInt(messageThreadId));
  updateTopicStatus(chatId, messageThreadId, 'archived');
  logger.info({ chatId, topicId: messageThreadId }, 'Closed forum topic');
}

/**
 * Reopen an archived forum topic.
 */
export async function reopenTopic(
  api: Api<RawApi>,
  chatId: string,
  messageThreadId: string,
): Promise<void> {
  await api.reopenForumTopic(parseInt(chatId), parseInt(messageThreadId));
  updateTopicStatus(chatId, messageThreadId, 'active');
  logger.info({ chatId, topicId: messageThreadId }, 'Reopened forum topic');
}

/**
 * List active topics from DB for a chat.
 */
export function listTopics(chatId: string): ForumTopic[] {
  return getForumTopics(chatId, 'active');
}

/**
 * Record activity on a topic (updates last_active_at).
 */
export function recordTopicActivity(chatId: string, topicId: string): void {
  // Ensure topic exists in DB (may have been created outside the bot)
  const existing = getForumTopic(chatId, topicId);
  if (existing) {
    updateTopicActivity(chatId, topicId);
  } else {
    // Auto-register topic we haven't seen before
    saveForumTopic(chatId, topicId, `Topic ${topicId}`, 'external');
  }
}

/**
 * Get stale topics (inactive for more than maxAgeDays).
 */
export function getStaleTopics(chatId: string, maxAgeDays: number): ForumTopic[] {
  return getStaleForumTopics(chatId, maxAgeDays);
}

/**
 * Find an archived topic by name for reopening.
 */
export function findArchivedTopicByName(chatId: string, name: string): ForumTopic | undefined {
  const topic = getForumTopicByName(chatId, name);
  if (topic && topic.status === 'archived') return topic;
  return undefined;
}
