/**
 * Text War Room router and intervention gate.
 *
 * Both functions issue a locked-down `query()` call through the Claude Agent
 * SDK — same OAuth/subscription path Telegram and the voice bridge use. No
 * API key required. The prompts run on Haiku with zero tools, no CLAUDE.md
 * loading, no settings sources: pure classifier mode.
 *
 * Failure tolerant: any thrown error, timeout (>8s), or unparseable JSON
 * falls back to a deterministic default (primary = pinnedAgent ?? 'main',
 * interveners = []). The fallback also sets routerDegraded=true on the
 * decision so the UI can show a subtle "degraded routing" indicator.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import { getScrubbedSdkEnv } from './security.js';
import { isEnabled } from './kill-switches.js';

const ROUTER_MODEL = 'claude-haiku-4-5-20251001';
// Budget: Claude Agent SDK subprocess cold-start is ~3-5s before the first
// token even flows, plus Haiku's actual classification latency. 20s covers
// p99 on a warm machine; the dashboard's progressive status bar hides this
// latency from the user by showing "Routing…" immediately.
const ROUTER_TIMEOUT_MS = 20_000;

export interface RouterContext {
  userText: string;
  /** Sorted roster. Main first. */
  roster: Array<{ id: string; name: string; description: string }>;
  /** Most recent turns, oldest first. Each entry is a single speaker line. */
  recentTurns: Array<{ speaker: string; text: string }>;
  /** Agent id the user pinned for this meeting, or null. */
  pinnedAgent: string | null;
}

export interface RouterDecision {
  primary: string | null;
  interveners: string[];
  reason: string;
  /** True if the router call failed and we fell back to deterministic defaults. */
  routerDegraded: boolean;
}

export interface InterventionContext {
  userText: string;
  primaryAgentId: string;
  primaryReply: string;
  candidateAgentId: string;
  candidateAgentDescription: string;
}

export interface InterventionDecision {
  speak: boolean;
  /** Seed hint passed into the intervener's full query as context. Unused when speak=false. */
  reply: string;
}

function sdkEnvStripped(): Record<string, string | undefined> {
  // Delegate to the shared scrubber in security.ts. It drops nested
  // Claude-Code-session state plus every secret-shaped env var the SDK
  // subprocess doesn't need (DASHBOARD_TOKEN, third-party API keys, etc.)
  // so a prompt-injected agent can't read them.
  const secrets = readEnvFile(['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY']);
  return getScrubbedSdkEnv(secrets);
}

async function* singleTurn(text: string): AsyncGenerator<{
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}> {
  yield {
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
    session_id: '',
  };
}

/**
 * Strip prompt-delimiter sequences from untrusted user text before it lands
 * inside our `"""..."""` blocks in the classifier prompts. A user message
 * containing `"""` would otherwise terminate our block early and let the
 * model read what follows as instruction. Replaces with a visually similar
 * but non-delimiting form so the original intent is preserved for routing.
 */
function sanitizeForPromptBlock(s: string): string {
  if (!s) return '';
  return s.replace(/"""/g, "'''");
}

function rosterBlock(roster: RouterContext['roster']): string {
  return roster.map((a) => `- ${a.id}: ${a.name} — ${sanitizeForPromptBlock(a.description)}`).join('\n');
}

function recentBlock(turns: RouterContext['recentTurns']): string {
  if (turns.length === 0) return '(empty — first message of the meeting)';
  return turns.map((t) => `${t.speaker}: ${sanitizeForPromptBlock(t.text)}`).join('\n');
}

/** The router's system+prompt, baked into one string since we run with maxTurns=1. */
function buildRouterPrompt(ctx: RouterContext): string {
  const pinLine = ctx.pinnedAgent
    ? `\nPinned agent (user has locked this agent as primary): ${ctx.pinnedAgent}`
    : '';
  return `You're dispatching for a text group chat. Imagine a real meeting room: people speak up when the topic is clearly theirs, and stay quiet when it isn't.

Roster (agent_id: NAME — description):
${rosterBlock(ctx.roster)}

Recent transcript (oldest first, up to last 6 turns):
${recentBlock(ctx.recentTurns)}${pinLine}

New user message:
"""
${sanitizeForPromptBlock(ctx.userText)}
"""

Your job is to pick who speaks this turn.

Primary (one agent leads the response):
- Compare the user's message to each agent's description. The single most relevant specialist leads.
- When the topic is generic, triage-style, or doesn't map cleanly to a specialist → primary = "main".
- Social messages (thanks/ok/emoji) or truly unclear ones → primary = null.

Interveners (0 to 2 others raise their hand):
- Include an agent when their description genuinely overlaps the message in a way the primary couldn't fully cover. Think of it as someone in a meeting saying "I've got something to add on that."
- Don't add someone just to echo the primary. Distinct value only.
- Multi-topic messages (two or three distinct domains in one ask) usually pull in one intervener per extra domain, up to 2.

Rules:
- If a pinned agent is set, primary = pinned unless the user explicitly names a different agent with @.
- Never invent an agent_id — pick only from the roster above.
- Order interveners by who should speak first.

Respond with ONLY a JSON object, no prose, no code fences:
{"primary": "<agent_id>" | null, "interveners": ["<agent_id>", ...], "reason": "<one short sentence saying why, in plain terms>"}`;
}

function parseJson<T>(text: string): T | null {
  if (!text) return null;
  // Tolerate the SDK wrapping JSON in code fences even when we asked it not to.
  const stripped = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Grab the first {...} block if the model added commentary.
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

function sanitizeDecision(
  raw: unknown,
  ctx: RouterContext,
): Omit<RouterDecision, 'routerDegraded'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const validIds = new Set(ctx.roster.map((a) => a.id));

  const primaryRaw = obj.primary;
  let primary: string | null = null;
  if (primaryRaw === null || primaryRaw === undefined) {
    primary = null;
  } else if (typeof primaryRaw === 'string' && validIds.has(primaryRaw)) {
    primary = primaryRaw;
  } else {
    return null; // bad agent id — reject and fall back
  }

  const interRaw = obj.interveners;
  const interveners: string[] = [];
  if (Array.isArray(interRaw)) {
    for (const entry of interRaw) {
      if (typeof entry !== 'string') continue;
      if (!validIds.has(entry)) continue;
      if (entry === primary) continue;
      if (interveners.includes(entry)) continue;
      if (interveners.length >= 2) break;
      interveners.push(entry);
    }
  }

  const reason = typeof obj.reason === 'string' ? obj.reason.slice(0, 200) : '';
  return { primary, interveners, reason };
}

export function routerFallback(ctx: RouterContext): RouterDecision {
  return {
    primary: ctx.pinnedAgent ?? 'main',
    interveners: [],
    reason: 'router unavailable — fell back to primary-only',
    routerDegraded: true,
  };
}

/** Run the router classifier. Returns a decision; never throws. */
export async function routeMessage(ctx: RouterContext): Promise<RouterDecision> {
  // Kill-switch: when LLM_SPAWN_ENABLED is off, fall back to the
  // deterministic default so the war-room turn still completes (and the
  // primary agent's own kill-switch check refuses cleanly).
  if (!isEnabled('LLM_SPAWN_ENABLED')) return routerFallback(ctx);
  const prompt = buildRouterPrompt(ctx);
  let text = '';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ROUTER_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    for await (const ev of query({
      prompt: singleTurn(prompt),
      options: {
        model: ROUTER_MODEL,
        allowedTools: [],
        disallowedTools: ['*'],
        settingSources: [],
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        env: sdkEnvStripped(),
        abortController: abort,
      } as any,
    })) {
      const e = ev as Record<string, unknown>;
      if (e.type === 'result') text = (e.result as string | undefined) ?? '';
    }
  } catch (err) {
    logger.warn({
      err: err instanceof Error ? err.message : err,
      elapsedMs: Date.now() - t0,
      outcome: 'timeout_or_error',
    }, 'router query failed');
    clearTimeout(timer);
    return routerFallback(ctx);
  }
  clearTimeout(timer);

  const raw = parseJson(text);
  const clean = raw !== null ? sanitizeDecision(raw, ctx) : null;
  if (!clean) {
    logger.warn({
      rawText: text.slice(0, 300),
      elapsedMs: Date.now() - t0,
      outcome: 'parse_failure',
    }, 'router produced unparseable output');
    return routerFallback(ctx);
  }
  // Successful path — log elapsed for telemetry. Future work: surface a
  // rolling success rate in /api/health if router fallbacks become a
  // chronic issue.
  logger.info({
    elapsedMs: Date.now() - t0,
    outcome: 'success',
    primary: clean.primary,
    interveners: clean.interveners.length,
  }, 'router classified');
  return { ...clean, routerDegraded: false };
}

// Same cold-start math as the router. Gates fire sequentially after the
// primary finishes, so a 25s budget adds at most 50s to a turn (2 max
// interveners). The UI shows "Checking if anyone wants to add…" so the
// user knows the pause is intentional. 15s was too tight — Haiku + SDK
// init consistently exceeded it, which forced every gate to time out
// and drop interveners silently.
const GATE_TIMEOUT_MS = 25_000;

function buildGatePrompt(ctx: InterventionContext): string {
  return `You are ${ctx.candidateAgentId} (${sanitizeForPromptBlock(ctx.candidateAgentDescription)}) in a group chat meeting with the user and a teammate.

The user asked:
"""
${sanitizeForPromptBlock(ctx.userText)}
"""

${ctx.primaryAgentId} just responded:
"""
${sanitizeForPromptBlock(ctx.primaryReply)}
"""

You were pulled in because your domain is relevant. Default: speak up with your angle — that's the meeting vibe we want. People raise their hand when the topic touches their lane.

- Speak if your domain is genuinely in scope, even by one degree of separation. Add your specific perspective from that angle.
- Only stay silent if the primary literally said everything you would (rare) or if your domain truly has nothing to contribute here.
- When you speak: 1-3 sentences, conversational, don't preamble with "To add to that" or "Building on what ${ctx.primaryAgentId} said". Just say your thing.

Respond with ONLY a JSON object, no prose, no code fences:
{"speak": true | false, "reply": "<your 1-3 sentence contribution, empty string if speak is false>"}`;
}

/** Run the intervention gate for a single candidate. Never throws. */
export async function interventionGate(ctx: InterventionContext): Promise<InterventionDecision> {
  // Kill-switch: skip the gate when LLM spawning is disabled. Returning
  // {speak: false} is the safer default — interveners are best-effort.
  if (!isEnabled('LLM_SPAWN_ENABLED')) return { speak: false, reply: '' };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), GATE_TIMEOUT_MS);
  let text = '';

  try {
    for await (const ev of query({
      prompt: singleTurn(buildGatePrompt(ctx)),
      options: {
        model: ROUTER_MODEL,
        allowedTools: [],
        disallowedTools: ['*'],
        settingSources: [],
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        env: sdkEnvStripped(),
        abortController: abort,
      } as any,
    })) {
      const e = ev as Record<string, unknown>;
      if (e.type === 'result') text = (e.result as string | undefined) ?? '';
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, candidate: ctx.candidateAgentId }, 'intervention gate failed');
    clearTimeout(timer);
    return { speak: false, reply: '' };
  }
  clearTimeout(timer);

  const raw = parseJson<{ speak?: unknown; reply?: unknown }>(text);
  if (!raw) return { speak: false, reply: '' };
  const speak = raw.speak === true;
  const reply = typeof raw.reply === 'string' ? raw.reply.slice(0, 800) : '';
  if (speak && !reply.trim()) return { speak: false, reply: '' };
  return { speak, reply };
}

// Exported for tests.
export const _internal = { buildRouterPrompt, buildGatePrompt, parseJson, sanitizeDecision };
