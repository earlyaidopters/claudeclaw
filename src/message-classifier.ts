/**
 * Message complexity classifier for smart model routing.
 *
 * Classifies incoming messages as 'simple' (can use a lighter/faster model)
 * or 'complex' (needs the full model). Pure string analysis, no dependencies.
 */

const ACK_PATTERNS = new Set([
  'ok',
  'ok got it',
  'got it',
  'thanks',
  'thank you',
  'yes',
  'no',
  'yep',
  'nope',
  'do it',
  'send it',
  'sounds good',
  'perfect',
  'cool',
  'nice',
  'great',
  'sure',
  'lol',
  'haha',
  'done',
  'agreed',
  'fine',
  'k',
  'kk',
  'yea',
  'yeah',
  'nah',
  'go ahead',
  'go for it',
  'ship it',
  'approved',
  'looks good',
  'lgtm',
  'ty',
  'thx',
  'np',
  'word',
]);

/**
 * Strip punctuation from edges and collapse whitespace so that
 * "thanks!" or " ok " still match the acknowledgment list.
 */
function normalize(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyMessageComplexity(message: string): 'simple' | 'complex' {
  // Empty or whitespace-only messages are trivially simple.
  if (message.trim().length === 0) return 'simple';

  // Long messages are always complex.
  if (message.length > 120) return 'complex';

  // Code fences signal technical content.
  if (message.includes('```')) return 'complex';

  // URLs indicate external references.
  if (/https?:\/\//.test(message)) return 'complex';

  // File paths starting with / or ~ indicate technical context.
  if (/(?:^|\s)[~/]/.test(message)) return 'complex';

  // Question marks suggest a question that needs the full model.
  if (message.includes('?')) return 'complex';

  // Check against the acknowledgment set after normalizing.
  const normalized = normalize(message);
  if (ACK_PATTERNS.has(normalized)) return 'simple';

  // Anything that didn't match an acknowledgment pattern is complex.
  return 'complex';
}
