/**
 * Exfiltration guard: scans outbound text for leaked secrets and credentials.
 *
 * Pure regex/string analysis with zero dependencies. Designed to catch
 * API keys, tokens, and other sensitive values before they leave the agent.
 */

export interface SecretMatch {
  type: string;
  position: number;
  length: number;
  preview: string;
}

// ── Detection patterns ─────────────────────────────────────────────

const PATTERNS: Array<{ type: string; regex: RegExp }> = [
  // Anthropic API keys: sk-ant- followed by 20+ alphanumeric chars
  { type: 'anthropic_key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },

  // Generic SK keys: sk- followed by 20+ alphanumeric/dash chars
  // (must not start with sk-ant- to avoid double-matching Anthropic keys)
  { type: 'generic_sk_key', regex: /sk-(?!ant-)[A-Za-z0-9_-]{20,}/g },

  // Slack tokens: xoxb- or xoxp- followed by alphanumeric/dash chars
  { type: 'slack_token', regex: /xox[bp]-[A-Za-z0-9-]+/g },

  // GitHub tokens: ghp_ or gho_ followed by 20+ alphanumeric chars
  { type: 'github_token', regex: /gh[po]_[A-Za-z0-9]{20,}/g },

  // AWS access keys: AKIA followed by exactly 16 alphanumeric chars
  { type: 'aws_key', regex: /AKIA[A-Za-z0-9]{16}/g },

  // Long hex strings: 40+ hex chars that are NOT git commit SHAs.
  // Git SHAs are exactly 40 hex chars typically preceded by "commit "
  // or similar git patterns. We match 41+ unconditionally, and for
  // exactly 40 chars we only match if NOT preceded by a git pattern.
  { type: 'hex_key', regex: /(?<![A-Za-z0-9])[0-9a-fA-F]{41,}(?![A-Za-z0-9])/g },
];

// Git patterns that precede a 40-char hex SHA
const GIT_SHA_PREFIX = /(?:commit |tree |parent |object |[0-9a-f]{40}\.\.)/;

/**
 * Scan text for leaked secrets and credentials.
 *
 * @param text         The text to scan
 * @param protectedValues  Optional array of sensitive env values to check
 *                         (both base64-encoded and URL-encoded variants)
 * @returns Array of matches found, empty if clean
 */
export function scanForSecrets(text: string, protectedValues?: string[]): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const seen = new Set<string>(); // dedupe by "position:length"

  // Run each built-in pattern
  for (const { type, regex } of PATTERNS) {
    // Reset lastIndex since we reuse global regexes
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const key = `${m.index}:${m[0].length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        type,
        position: m.index,
        length: m[0].length,
        preview: m[0].slice(0, 8) + '...',
      });
    }
  }

  // Check for exactly-40-char hex strings that are NOT git SHAs
  const hex40Regex = /(?<![A-Za-z0-9])[0-9a-fA-F]{40}(?![A-Za-z0-9])/g;
  let m40: RegExpExecArray | null;
  while ((m40 = hex40Regex.exec(text)) !== null) {
    // Skip if it's exactly 40 chars (could be a git SHA)
    if (m40[0].length === 40) {
      // Check what precedes this match for git patterns
      const prefix = text.slice(Math.max(0, m40.index - 10), m40.index);
      if (GIT_SHA_PREFIX.test(prefix)) continue;

      const key = `${m40.index}:${m40[0].length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        type: 'hex_key',
        position: m40.index,
        length: m40[0].length,
        preview: m40[0].slice(0, 8) + '...',
      });
    }
  }

  // Check protected env values (base64 and URL-encoded variants)
  if (protectedValues) {
    for (const value of protectedValues) {
      if (value.length <= 8) continue;

      const variants: Array<{ encoded: string; label: string }> = [
        { encoded: Buffer.from(value).toString('base64'), label: 'base64' },
        { encoded: encodeURIComponent(value), label: 'url_encoded' },
      ];

      for (const { encoded, label } of variants) {
        // Skip if the encoded form is the same as the original (no special chars)
        // For URL encoding, this means no special chars were encoded
        if (encoded === value && label === 'url_encoded') continue;

        let idx = text.indexOf(encoded);
        while (idx !== -1) {
          const key = `${idx}:${encoded.length}`;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({
              type: 'env_value',
              position: idx,
              length: encoded.length,
              preview: encoded.slice(0, 8) + '...',
            });
          }
          idx = text.indexOf(encoded, idx + 1);
        }
      }
    }
  }

  // Sort by position for deterministic output
  matches.sort((a, b) => a.position - b.position);
  return matches;
}

/**
 * Replace each matched secret in the text with [REDACTED].
 *
 * Processes matches from end to start so positions remain valid.
 */
export function redactSecrets(text: string, matches: SecretMatch[]): string {
  if (matches.length === 0) return text;

  // Sort descending by position so replacements don't shift indices
  const sorted = [...matches].sort((a, b) => b.position - a.position);
  let result = text;

  for (const match of sorted) {
    result =
      result.slice(0, match.position) +
      '[REDACTED]' +
      result.slice(match.position + match.length);
  }

  return result;
}
