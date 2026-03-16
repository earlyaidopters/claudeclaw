import { generateContent, parseJsonResponse } from './gemini.js';
import { embedText } from './embeddings.js';
import { GOOGLE_API_KEY } from './config.js';
import { saveStructuredMemory, saveMemoryEmbedding } from './db.js';
import { logger } from './logger.js';

interface ExtractionResult {
  summary: string;
  entities: string[];
  topics: string[];
  importance: number;
}

const EXTRACTION_PROMPT = `You are a memory extraction agent. Given a conversation exchange between a user and their AI assistant, decide if it contains information worth remembering long-term.

SKIP (return {"skip": true}) if:
- The message is just an acknowledgment (ok, yes, no, got it, thanks, send it, do it)
- It's a command with no lasting context (/chatid, /help, checkpoint, convolife, etc)
- It's ephemeral task execution (send this email, check my calendar, read this message, draft a response)
- The content is only relevant to this exact moment
- It's a greeting or small talk with no substance
- It's a one-off action request like "shorten that", "generate 3 ideas", "look up X", "draft a reply" — these are tasks, not memories
- It's a correction of a typo or minor instruction adjustment
- It's asking for information or a status check ("how much did we make", "what's trending", "what time is it")

EXTRACT if the exchange contains:
- User preferences, habits, or personal facts
- Decisions or policies (how to handle X going forward)
- Important relationships or contacts and how the user relates to them
- Project context that will matter in future sessions
- Corrections to the assistant's behavior (feedback on approach)
- Business rules or workflows
- Recurring patterns or routines
- Technical preferences or architectural decisions
- Emotional context about relationships or situations

If extracting, return JSON:
{
  "skip": false,
  "summary": "1-2 sentence summary of what to remember",
  "entities": ["entity1", "entity2"],
  "topics": ["topic1", "topic2"],
  "importance": 0.0-1.0
}

Importance guide:
- 0.8-1.0: Core identity, strong preferences, critical business rules, relationship dynamics
- 0.5-0.7: Useful context, project details, moderate preferences, workflow patterns
- 0.2-0.4: Nice to know, minor details, one-off context that might be relevant later

User message: {USER_MESSAGE}
Assistant response: {ASSISTANT_RESPONSE}`;

/**
 * Analyze a conversation turn and extract structured memory if warranted.
 * Called async (fire-and-forget) after the assistant responds.
 * Returns true if a memory was saved, false if skipped.
 */
export async function ingestConversationTurn(
  chatId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<boolean> {
  // Skip if Gemini is not configured
  if (!GOOGLE_API_KEY) return false;

  // Hard filter: skip very short messages and commands
  if (userMessage.length <= 15 || userMessage.startsWith('/')) return false;

  try {
    const prompt = EXTRACTION_PROMPT
      .replace('{USER_MESSAGE}', userMessage.slice(0, 2000))
      .replace('{ASSISTANT_RESPONSE}', assistantResponse.slice(0, 2000));

    const raw = await generateContent(prompt);
    const result = parseJsonResponse<ExtractionResult & { skip?: boolean }>(raw);

    if (!result || result.skip) return false;

    // Validate required fields
    if (!result.summary || typeof result.importance !== 'number') {
      logger.warn({ result }, 'Gemini extraction missing required fields');
      return false;
    }

    // Hard filter: don't save low importance (0.3 threshold kills borderline noise)
    if (result.importance < 0.3) return false;

    // Clamp importance to valid range
    const importance = Math.max(0, Math.min(1, result.importance));

    const memoryId = saveStructuredMemory(
      chatId,
      userMessage,
      result.summary,
      result.entities ?? [],
      result.topics ?? [],
      importance,
      'conversation',
    );

    // Generate and store embedding (async, non-blocking for the save itself)
    try {
      const embeddingText = `${result.summary} ${(result.entities ?? []).join(' ')} ${(result.topics ?? []).join(' ')}`;
      const embedding = await embedText(embeddingText);
      if (embedding.length > 0) {
        saveMemoryEmbedding(memoryId, embedding);
      }
    } catch (embErr) {
      // Embedding failure is non-fatal; memory is still saved, just not vector-searchable
      logger.warn({ err: embErr, memoryId }, 'Failed to generate embedding for memory');
    }

    logger.info(
      { chatId, importance, topics: result.topics, summary: result.summary.slice(0, 80) },
      'Memory ingested',
    );
    return true;
  } catch (err) {
    // Gemini failure should never block the bot
    logger.error({ err }, 'Memory ingestion failed (Gemini)');
    return false;
  }
}
