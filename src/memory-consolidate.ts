import { generateContent, parseJsonResponse } from './gemini.js';
import {
  getUnconsolidatedMemories,
  markMemoriesConsolidated,
  saveConsolidation,
  saveConsolidationEmbedding,
  supersedeMemory,
  updateMemoryConnections,
} from './db.js';
import { embedText } from './embeddings.js';
import { logger } from './logger.js';

interface ConsolidationResult {
  summary: string;
  insight: string;
  connections: Array<{
    from_id: number;
    to_id: number;
    relationship: string;
  }>;
  contradictions?: Array<{
    stale_id: number;
    supersedes_id: number;
    reason: string;
  }>;
}

const CONSOLIDATION_PROMPT = `You are a memory consolidation agent. You find patterns and connections across a user's recent memories.

Given these unconsolidated memories:
{MEMORIES}

Your job:
1. Find cross-cutting patterns, themes, or connections between memories
2. Create a synthesized summary that captures the overall picture
3. Identify one key insight that emerges from these memories together
4. Map connections between specific memories (use their IDs)
5. Check for CONTRADICTIONS: if any memory updates, corrects, or supersedes an earlier one, flag it. IMPORTANT: Compare the created_at timestamps to determine which is newer. The memory with the LATER timestamp is authoritative (it's the correction). Set stale_id to the OLDER memory's ID and supersedes_id to the NEWER memory's ID.

Return JSON:
{
  "summary": "A synthesized view across all source memories",
  "insight": "One key pattern or insight that emerges",
  "connections": [
    {"from_id": N, "to_id": M, "relationship": "description of how they relate"}
  ],
  "contradictions": [
    {"stale_id": N, "supersedes_id": M, "reason": "why the newer one replaces the older"}
  ]
}

If memories are unrelated, still summarize but note they cover different topics. Connections and contradictions arrays can be empty if none exist.`;

// Guard against overlapping consolidation runs (keyed by chatId)
const consolidatingChats = new Set<string>();

/**
 * Run consolidation for a given chat. Finds patterns across unconsolidated
 * memories and creates synthesis records. Safe to call frequently; it's
 * a no-op if fewer than 2 memories are pending or if already running.
 */
export async function runConsolidation(chatId: string): Promise<void> {
  if (consolidatingChats.has(chatId)) {
    logger.debug({ chatId }, 'Consolidation already running for this chat, skipping');
    return;
  }

  consolidatingChats.add(chatId);
  try {
    const memories = getUnconsolidatedMemories(chatId, 20);

    if (memories.length < 2) {
      logger.debug({ count: memories.length }, 'Not enough memories to consolidate');
      return;
    }

    // Format memories for Gemini
    const memoriesJson = memories.map((m) => ({
      id: m.id,
      summary: m.summary,
      entities: JSON.parse(m.entities),
      topics: JSON.parse(m.topics),
      importance: m.importance,
      created_at: new Date(m.created_at * 1000).toISOString(),
    }));

    const prompt = CONSOLIDATION_PROMPT.replace(
      '{MEMORIES}',
      JSON.stringify(memoriesJson, null, 2),
    );

    const raw = await generateContent(prompt);
    const result = parseJsonResponse<ConsolidationResult>(raw);

    if (!result || !result.summary || !result.insight) {
      logger.warn({ raw: raw.slice(0, 200) }, 'Consolidation produced invalid result');
      return;
    }

    const sourceIds = memories.map((m) => m.id);

    // Save the consolidation record
    const consolidationId = saveConsolidation(chatId, sourceIds, result.summary, result.insight);

    // Generate embedding for semantic retrieval of consolidation insights
    try {
      const embeddingText = `${result.summary} ${result.insight}`;
      const embedding = await embedText(embeddingText);
      if (embedding.length > 0) {
        saveConsolidationEmbedding(consolidationId, embedding);
      }
    } catch (embErr) {
      logger.warn({ err: embErr, consolidationId }, 'Failed to embed consolidation');
    }

    // Wire up connections between memories
    if (result.connections && result.connections.length > 0) {
      for (const conn of result.connections) {
        if (!conn.from_id || !conn.to_id) continue;
        // Verify both IDs are in our source set
        if (!sourceIds.includes(conn.from_id) || !sourceIds.includes(conn.to_id)) continue;

        updateMemoryConnections(conn.from_id, [
          { linked_to: conn.to_id, relationship: conn.relationship },
        ]);
        updateMemoryConnections(conn.to_id, [
          { linked_to: conn.from_id, relationship: conn.relationship },
        ]);
      }
    }

    // Handle contradictions: mark stale memories as superseded
    if (result.contradictions && result.contradictions.length > 0) {
      for (const contra of result.contradictions) {
        if (!sourceIds.includes(contra.stale_id) || !sourceIds.includes(contra.supersedes_id)) {
          logger.warn(
            { staleId: contra.stale_id, supersededBy: contra.supersedes_id, reason: contra.reason },
            'Contradiction detected but IDs not in current batch, skipping',
          );
          continue;
        }
        // Verify timestamp order: the newer memory should be the authoritative one.
        // If the LLM got the direction wrong, swap the IDs.
        const staleMem = memories.find((m) => m.id === contra.stale_id);
        const newMem = memories.find((m) => m.id === contra.supersedes_id);
        let staleId = contra.stale_id;
        let supersededBy = contra.supersedes_id;
        if (staleMem && newMem && staleMem.created_at > newMem.created_at) {
          // LLM got it backwards: the "stale" one is actually newer
          staleId = contra.supersedes_id;
          supersededBy = contra.stale_id;
          logger.warn(
            { originalStale: contra.stale_id, correctedStale: staleId },
            'Corrected contradiction direction (LLM assigned newer memory as stale)',
          );
        }
        supersedeMemory(staleId, supersededBy);
        logger.info(
          { staleId, supersededBy, reason: contra.reason },
          'Memory superseded (contradiction resolved)',
        );
      }
    }

    // Mark all source memories as consolidated
    markMemoriesConsolidated(sourceIds);

    logger.info(
      {
        chatId,
        sourceCount: sourceIds.length,
        connections: result.connections?.length ?? 0,
        insight: result.insight.slice(0, 80),
      },
      'Consolidation complete',
    );
  } catch (err) {
    logger.error({ err }, 'Consolidation failed');
  } finally {
    consolidatingChats.delete(chatId);
  }
}
