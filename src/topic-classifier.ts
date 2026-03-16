import { generateContent, parseJsonResponse } from './gemini.js';
import { TOPIC_CLASSIFY_ENABLED, GOOGLE_API_KEY } from './config.js';
import { logger } from './logger.js';

export interface ClassificationResult {
  isNewWorkStream: boolean;
  suggestedName: string;
  confidence: number;
}

/**
 * Classify a message to determine if it represents a new work stream
 * that should get its own forum topic.
 *
 * Returns null if classification is skipped or fails.
 * Biased toward NOT creating topics (false positives are worse than false negatives).
 */
export async function classifyMessage(message: string): Promise<ClassificationResult | null> {
  if (!TOPIC_CLASSIFY_ENABLED || !GOOGLE_API_KEY) return null;

  // Skip short messages, commands, and trivial content
  if (message.length < 50) return null;
  if (message.startsWith('/')) return null;

  const prompt = `You are a message classifier for a Telegram bot. Determine if this message represents the START of a new, distinct work stream that would benefit from its own forum topic thread.

IMPORTANT: Be CONSERVATIVE. Most messages do NOT need their own topic. Only flag messages that clearly introduce a new project, task, or discussion area that will require multiple back-and-forth exchanges.

Do NOT classify as new work stream:
- Quick questions or one-off requests
- Follow-ups to existing conversations
- Casual chat, greetings, status checks
- Commands or short instructions
- Messages that are part of an ongoing discussion

DO classify as new work stream:
- "I want to build a new feature for X that does Y and Z"
- "Let's set up a CI/CD pipeline for the project"
- "I need help debugging the authentication system, it's been failing with..."
- Clear project kickoffs or multi-step task descriptions

Message to classify:
"""
${message.slice(0, 500)}
"""

Respond with JSON:
{
  "isNewWorkStream": boolean,
  "suggestedName": "short topic name if true, empty string if false",
  "confidence": number between 0 and 1
}`;

  try {
    const raw = await generateContent(prompt);
    const result = parseJsonResponse<ClassificationResult>(raw);
    if (!result) return null;

    logger.debug(
      { isNew: result.isNewWorkStream, name: result.suggestedName, confidence: result.confidence },
      'Topic classification result',
    );

    return result;
  } catch (err) {
    logger.warn({ err }, 'Topic classification failed');
    return null;
  }
}
