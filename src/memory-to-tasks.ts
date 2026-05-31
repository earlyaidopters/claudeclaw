// Memory → action dispatcher.
//
// When the memory ingestion pipeline saves a high-importance memory, this
// module uses Gemini to detect whether the memory contains an actionable
// commitment (call X by Y, follow up with Z, schedule a meeting). If so, it
// creates a ClickUp task in the user's default ClickUp list so the to-do
// surfaces in their existing workflow.
//
// Designed to fail QUIETLY — task creation failures are logged but never
// crash the memory pipeline. The goal is "best-effort surfacing", not
// guaranteed-delivery automation.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import { PROJECT_ROOT } from './config.js';
import { generateContent, parseJsonResponse } from './gemini.js';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);
const CLICKUP_SERVER = path.join(PROJECT_ROOT, 'connectors', 'clickup', 'server.mjs');

// Default to the "Personal Tasks" list since memories are usually personal
// reminders. Override via CLICKUP_MEMORY_TASKS_LIST env var if you'd rather
// route to a project-specific list.
const DEFAULT_LIST_ID = process.env.CLICKUP_MEMORY_TASKS_LIST || '901326621319';

interface ActionDetection {
  is_actionable: boolean;
  title?: string;
  description?: string;
  due_date?: string;       // YYYY-MM-DD or YYYY-MM-DDTHH:MM
  priority?: 1 | 2 | 3 | 4;
  reason?: string;
}

const DETECT_PROMPT = `You are an action-item detector. Given a memory that was just saved, decide if it contains a concrete personal commitment that should become a task.

EXTRACT only if the memory contains:
- A commitment to follow up with a specific person ("call Ralph", "follow up with Sarah")
- A scheduled action with a date or relative timing ("send X by Friday", "next week", "in 3 days")
- A reminder about a future event the user is responsible for
- A deadline or due-date statement the user committed to

DO NOT extract if the memory is:
- A general fact, preference, or rule (not actionable)
- A description of a system or how something works
- Already a completed action (past tense)
- A policy or standing decision (not a one-time task)
- Generic context (no specific person + verb + time)

If actionable, return JSON:
{
  "is_actionable": true,
  "title": "Short imperative title, max 80 chars. Start with a verb.",
  "description": "1-3 lines of context from the memory. Optional.",
  "due_date": "YYYY-MM-DD if a date is mentioned or implied, otherwise omit",
  "priority": 1-4 (1=urgent, 2=high, 3=normal, 4=low; default 3 if uncertain),
  "reason": "Why this is actionable in one sentence"
}

If not actionable, return:
{ "is_actionable": false, "reason": "..." }

Today's date: ${new Date().toISOString().slice(0, 10)}

Memory summary: {SUMMARY}
Memory full text: {RAW_TEXT}`;

async function clickupCreateTask(args: {
  list_id: string;
  name: string;
  description?: string;
  priority?: number;
  due_date_ms?: number;
  tags?: string[];
}): Promise<{ id: string; url?: string }> {
  const callArgs: Record<string, unknown> = {
    list_id: args.list_id,
    name: args.name,
  };
  if (args.description) callArgs.description = args.description;
  if (args.priority) callArgs.priority = args.priority;
  if (args.due_date_ms) callArgs.due_date = args.due_date_ms;
  if (args.tags) callArgs.tags = args.tags;

  const { stdout } = await execFileAsync(
    'node',
    [CLICKUP_SERVER, '--call', 'clickup_create_task', JSON.stringify(callArgs)],
    { env: { ...process.env }, maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function parseDueDate(s: string | undefined): number | undefined {
  if (!s) return undefined;
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return undefined;
  const [, y, mo, d, hh, mm, ss] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    hh ? Number(hh) : 9,           // default to 9am if only date given
    mm ? Number(mm) : 0,
    ss ? Number(ss) : 0,
  );
  return date.getTime();
}

/**
 * Called when a high-importance memory is created. Detects whether it's
 * actionable; if yes, creates a ClickUp task. Returns the task id on
 * success, null otherwise. Never throws.
 */
export async function dispatchMemoryToClickUp(
  memoryId: number,
  summary: string,
  rawText: string,
  importance: number,
): Promise<{ taskId: string | null; reason: string }> {
  // Only consider very-high-importance memories. Lower importance items
  // usually aren't actionable commitments.
  if (importance < 0.7) return { taskId: null, reason: 'importance below 0.7' };

  let detection: ActionDetection;
  try {
    const prompt = DETECT_PROMPT
      .replace('{SUMMARY}', summary)
      .replace('{RAW_TEXT}', rawText.slice(0, 2000));
    const raw = await generateContent(prompt);
    const parsed = parseJsonResponse<ActionDetection>(raw);
    if (!parsed) return { taskId: null, reason: 'gemini returned no parseable JSON' };
    detection = parsed;
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e), memoryId }, 'memory-to-tasks: detection failed');
    return { taskId: null, reason: 'detection error' };
  }

  if (!detection.is_actionable) {
    logger.debug({ memoryId, reason: detection.reason }, 'memory-to-tasks: not actionable');
    return { taskId: null, reason: detection.reason || 'not actionable' };
  }

  const title = (detection.title || summary).slice(0, 100);
  const description = [
    detection.description || '',
    '',
    `Auto-created from memory #${memoryId} (importance ${importance.toFixed(2)}).`,
  ].filter(Boolean).join('\n');
  const due = parseDueDate(detection.due_date);

  try {
    const r = await clickupCreateTask({
      list_id: DEFAULT_LIST_ID,
      name: title,
      description,
      priority: detection.priority,
      due_date_ms: due,
      tags: ['auto:memory'],
    });
    logger.info(
      { memoryId, taskId: r.id, title, due: detection.due_date },
      'memory-to-tasks: ClickUp task created',
    );
    return { taskId: r.id, reason: detection.reason || 'actionable' };
  } catch (e) {
    logger.error(
      { err: String((e as Error)?.message || e), memoryId, title },
      'memory-to-tasks: ClickUp create failed',
    );
    return { taskId: null, reason: 'clickup create failed' };
  }
}
