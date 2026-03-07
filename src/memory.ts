import {
  decayMemories,
  getRecentMemories,
  logConversationTurn,
  pruneConversationLog,
  saveMemory,
  searchMemories,
  touchMemory,
} from './db.js';

const SEMANTIC_SIGNALS = /\b(my|i am|i'm|i prefer|remember|always|never)\b/i;

/**
 * Build a compact memory context string to prepend to the user's message.
 * Uses 2-layer progressive disclosure:
 *   Layer 1: FTS5 keyword search against user message -> top 3 results
 *   Layer 2: Most recent 5 memories (recency)
 *   Deduplicates between layers.
 * Returns empty string if no memories exist for this chat.
 */
export async function buildMemoryContext(
  chatId: string,
  userMessage: string,
): Promise<string> {
  const seen = new Set<number>();
  const lines: string[] = [];

  // Layer 1: keyword search
  const searched = searchMemories(chatId, userMessage, 3);
  for (const mem of searched) {
    seen.add(mem.id);
    touchMemory(mem.id);
    lines.push(`- ${mem.content} (${mem.sector})`);
  }

  // Layer 2: recent memories (deduplicated)
  const recent = getRecentMemories(chatId, 5);
  for (const mem of recent) {
    if (seen.has(mem.id)) continue;
    seen.add(mem.id);
    touchMemory(mem.id);
    lines.push(`- ${mem.content} (${mem.sector})`);
  }

  if (lines.length === 0) return '';

  return `[Memory context]\n${lines.join('\n')}\n[End memory context]`;
}

/**
 * Extract and save memorable facts from a conversation turn.
 * Called AFTER Claude responds, with both user message and Claude's response.
 *
 * Strategy:
 * - Save user messages containing key signals (my, I am, I prefer, remember,
 *   always, never) as 'semantic' sector (long-lived).
 * - Save other meaningful messages as 'episodic' sector (short decay).
 * - Skip short or command-like messages.
 * - Always log both user and assistant messages to conversation_log.
 */
export function saveConversationTurn(
  chatId: string,
  userMessage: string,
  claudeResponse: string,
  sessionId?: string,
  agentId = 'main',
): void {
  // Always log full conversation to conversation_log (for /respin)
  logConversationTurn(chatId, 'user', userMessage, sessionId, agentId);
  logConversationTurn(chatId, 'assistant', claudeResponse, sessionId, agentId);

  // Skip short or command-like messages for memory extraction
  if (userMessage.length <= 20 || userMessage.startsWith('/')) return;

  if (SEMANTIC_SIGNALS.test(userMessage)) {
    saveMemory(chatId, userMessage, 'semantic');
  } else {
    saveMemory(chatId, userMessage, 'episodic');
  }
}

/**
 * Run the daily decay sweep. Call once on startup and every 24h.
 * Also prunes old conversation_log entries to prevent unbounded growth.
 */
export function runDecaySweep(): void {
  decayMemories();
  pruneConversationLog(500);
}
