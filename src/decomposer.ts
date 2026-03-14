/**
 * Compound Message Decomposer
 *
 * Analyzes incoming messages and splits compound requests into discrete tasks
 * with dependency ordering. Uses Gemini Flash for LLM-powered decomposition
 * with a quick-path bypass for simple messages that don't need it.
 *
 * This solves the "parts getting dropped" problem: when a user sends
 * "Research X, write a post about it, and update the board", each part
 * becomes a separate task that can be executed sequentially or in parallel.
 */

import { generateContent, parseJsonResponse } from './gemini.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface DecomposedTask {
  /** Human-readable task description */
  task: string;
  /** Suggested worker/agent hint (e.g. 'research', 'content', 'coding', 'general') */
  workerHint: string;
  /** Indices of tasks this depends on (e.g. [0] means "wait for task 0") */
  dependsOn: number[];
}

export interface DecompositionResult {
  /** Whether the message was compound (multiple tasks) */
  isCompound: boolean;
  /** The decomposed tasks (length 1 for simple messages) */
  tasks: DecomposedTask[];
  /** Original message, preserved for pass-through */
  originalMessage: string;
}

// ── Quick-path bypass ────────────────────────────────────────────────
// Simple messages skip the LLM call entirely. This keeps latency low
// for greetings, commands, short questions, and single-task requests.

const QUICK_PATH_PATTERNS: RegExp[] = [
  // Bot commands
  /^\/\w+/,

  // Special commands
  /^(convolife|checkpoint|status|ping)\b/i,

  // Greetings and acknowledgements
  /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|got it|cool|nice|good|yes|no|yep|nope)\s*[.!?]?$/i,

  // Short questions (under 80 chars, single question)
  /^(who|what|where|when|why|how|is|are|do|does|did|can|could|will|would|should)\b.{0,75}\?$/i,

  // Memory recall
  /^(remember|recall|what did (i|we)|last time)/i,

  // Simple lookups
  /^(show|list|get|check) (my )?(tasks|schedule|memories|sessions|emails?|inbox|calendar)/i,

  // Delegation syntax (handled by orchestrator, not decomposer)
  /^@\w+/,
  /^\/delegate\s/i,
];

/**
 * Messages under this character length are assumed simple.
 * Most compound requests are longer than a single sentence.
 */
const SHORT_MESSAGE_THRESHOLD = 60;

/**
 * Compound indicators: if none of these appear, the message is likely
 * a single task even if it's long. These suggest multiple distinct actions.
 */
const COMPOUND_INDICATORS: RegExp[] = [
  // Conjunctions joining actions
  /\b(and also|and then|then also|but also|plus also)\b/i,

  // Sequencing words
  /\b(first|second|third|finally|lastly|next|after that|once .+ is done)\b/i,

  // Numbered lists
  /^\s*\d+[.)]\s/m,

  // Bullet lists
  /^\s*[-*]\s+\w/m,

  // Multiple imperative verbs separated by punctuation or conjunctions
  /[.!;]\s*(then\s+)?(also\s+)?(please\s+)?(build|create|write|research|analyze|review|deploy|fix|update|check|send|schedule|draft|implement|refactor)\b/i,

  // "X, Y, and Z" pattern with action verbs
  /\b(build|create|write|research|analyze|review|deploy|fix|update|check|send|schedule|draft|implement|refactor)\b.*,\s*(and\s+)?\b(build|create|write|research|analyze|review|deploy|fix|update|check|send|schedule|draft|implement|refactor)\b/i,
];

// ── Core logic ───────────────────────────────────────────────────────

/**
 * Check if a message should skip LLM decomposition entirely.
 * Returns true for simple messages that are obviously single-task.
 */
function isQuickPath(message: string): boolean {
  const trimmed = message.trim();

  // Bot commands always quick-path
  for (const pattern of QUICK_PATH_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Very short messages are almost always single-task
  if (trimmed.length < SHORT_MESSAGE_THRESHOLD) return true;

  // If no compound indicators are present, skip decomposition
  const hasCompoundIndicator = COMPOUND_INDICATORS.some((p) => p.test(trimmed));
  if (!hasCompoundIndicator) return true;

  return false;
}

/**
 * Build the LLM prompt for decomposition.
 */
function buildDecompositionPrompt(message: string): string {
  return `You are a task decomposer. Analyze the following user message and determine if it contains multiple distinct tasks that should be executed separately.

Rules:
- A "task" is a distinct action the user wants performed (research, write, build, check, etc.)
- If tasks have dependencies (e.g. "research X then write about the findings"), mark the dependency
- Worker hints should be one of: "research", "content", "coding", "ops", "general"
- If the message is truly a single task, return it as-is with isCompound: false
- Do NOT over-decompose. "Build a REST API with authentication" is ONE task, not three
- Conversational messages, questions, and discussions are ALWAYS single tasks
- Preserve the user's intent and context in each decomposed task

Respond with this exact JSON schema:
{
  "isCompound": boolean,
  "tasks": [
    {
      "task": "description of what to do",
      "workerHint": "research|content|coding|ops|general",
      "dependsOn": []
    }
  ]
}

User message:
${message}`;
}

/**
 * Decompose a message into discrete tasks.
 *
 * Flow:
 * 1. Quick-path check — simple messages bypass LLM entirely
 * 2. LLM decomposition — Gemini Flash analyzes compound messages
 * 3. Fallback — if LLM fails, treat as single task
 */
export async function decomposeMessage(message: string): Promise<DecompositionResult> {
  const trimmed = message.trim();

  // Quick-path: skip LLM for simple messages
  if (isQuickPath(trimmed)) {
    return {
      isCompound: false,
      tasks: [{ task: trimmed, workerHint: 'general', dependsOn: [] }],
      originalMessage: trimmed,
    };
  }

  // LLM decomposition via Gemini Flash
  try {
    const prompt = buildDecompositionPrompt(trimmed);
    const response = await generateContent(prompt);
    const parsed = parseJsonResponse<{
      isCompound: boolean;
      tasks: Array<{ task: string; workerHint: string; dependsOn: number[] }>;
    }>(response);

    if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      // Validate task structure
      const validTasks = parsed.tasks.every(
        (t) => typeof t.task === 'string' && t.task.length > 0,
      );

      if (validTasks) {
        // Normalize worker hints
        const validHints = new Set(['research', 'content', 'coding', 'ops', 'general']);
        const tasks = parsed.tasks.map((t) => ({
          task: t.task,
          workerHint: validHints.has(t.workerHint) ? t.workerHint : 'general',
          dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
        }));

        const isCompound = parsed.isCompound && tasks.length > 1;

        logger.info(
          { taskCount: tasks.length, isCompound, hints: tasks.map((t) => t.workerHint) },
          'Message decomposed',
        );

        return { isCompound, tasks, originalMessage: trimmed };
      }
    }

    // LLM returned something but it didn't parse correctly — fall through
    logger.warn({ response: response.slice(0, 200) }, 'Decomposer got unparseable response');
  } catch (err) {
    logger.error({ err }, 'Decomposer LLM call failed');
  }

  // Fallback: treat as single task
  return {
    isCompound: false,
    tasks: [{ task: trimmed, workerHint: 'general', dependsOn: [] }],
    originalMessage: trimmed,
  };
}
