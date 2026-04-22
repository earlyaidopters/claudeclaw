export const MODEL_ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

/**
 * Resolves a model alias (haiku|sonnet|opus) or full claude-* ID to a full model ID.
 * Returns undefined for null/undefined input (preserves "use agent default" behavior).
 * Throws on unrecognised input.
 */
export function resolveModelAlias(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  if (input.startsWith('claude-')) return input;
  const resolved = MODEL_ALIASES[input.toLowerCase()];
  if (!resolved) {
    throw new Error(`Unknown model alias: "${input}". Use haiku|sonnet|opus or a full claude-* ID.`);
  }
  return resolved;
}
