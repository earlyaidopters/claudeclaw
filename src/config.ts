import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { readEnvFile } from './env.js';

const envConfig = readEnvFile([
  'TELEGRAM_BOT_TOKEN',
  'ALLOWED_CHAT_ID',
  'GROQ_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'WHATSAPP_ENABLED',
  'SLACK_USER_TOKEN',
  'CONTEXT_LIMIT',
  'DASHBOARD_PORT',
  'DASHBOARD_TOKEN',
  'DASHBOARD_USER',
  'DASHBOARD_PASSWORD',
  'DASHBOARD_URL',
  'CLAUDECLAW_CONFIG',
  'DB_ENCRYPTION_KEY',
  'GOOGLE_API_KEY',
  'AGENT_TIMEOUT_MS',
  'SECURITY_PIN_HASH',
  'IDLE_LOCK_MINUTES',
  'EMERGENCY_KILL_PHRASE',
  'STREAM_STRATEGY',
  // ── ccos phase 0 ───────────────────────────────────────────────────
  'AGENT_MAX_TURNS',
  'SMART_ROUTING_ENABLED',
  'SMART_ROUTING_CHEAP_MODEL',
  'SHOW_COST_FOOTER',
  'DAILY_COST_BUDGET',
  'HOURLY_TOKEN_BUDGET',
  'EXFILTRATION_GUARD_ENABLED',
  'MEMORY_NUDGE_INTERVAL_TURNS',
  'WARROOM_ENABLED',
  'WARROOM_PORT',
]);

// ── Multi-agent support ──────────────────────────────────────────────
// These are mutable and overridden by index.ts when --agent is passed.
export let AGENT_ID = 'main';
export let activeBotToken =
  process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN || '';
export let agentCwd: string | undefined; // undefined = use PROJECT_ROOT
export let agentDefaultModel: string | undefined; // from agent.yaml
export let agentObsidianConfig: { vault: string; folders: string[]; readOnly?: string[] } | undefined;
export let agentSystemPrompt: string | undefined; // loaded from agents/{id}/CLAUDE.md
// undefined = all MCPs exposed (default). Empty array = deny all.
// Specific list = only those MCPs exposed to this agent.
export let agentMcpAllowlist: string[] | undefined;

export function setAgentOverrides(opts: {
  agentId: string;
  botToken: string;
  cwd: string;
  model?: string;
  obsidian?: { vault: string; folders: string[]; readOnly?: string[] };
  systemPrompt?: string;
  mcpServers?: string[];
}): void {
  AGENT_ID = opts.agentId;
  activeBotToken = opts.botToken;
  agentCwd = opts.cwd;
  agentDefaultModel = opts.model;
  agentObsidianConfig = opts.obsidian;
  agentSystemPrompt = opts.systemPrompt;
  agentMcpAllowlist = opts.mcpServers;
}

export const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN || '';

// Only respond to this Telegram chat ID. Set this after getting your ID via /chatid.
export const ALLOWED_CHAT_ID =
  process.env.ALLOWED_CHAT_ID || envConfig.ALLOWED_CHAT_ID || '';

export const WHATSAPP_ENABLED =
  (process.env.WHATSAPP_ENABLED || envConfig.WHATSAPP_ENABLED || '').toLowerCase() === 'true';

export const SLACK_USER_TOKEN =
  process.env.SLACK_USER_TOKEN || envConfig.SLACK_USER_TOKEN || '';

// Voice — read via readEnvFile, not process.env
export const GROQ_API_KEY = envConfig.GROQ_API_KEY ?? '';
export const ELEVENLABS_API_KEY = envConfig.ELEVENLABS_API_KEY ?? '';
export const ELEVENLABS_VOICE_ID = envConfig.ELEVENLABS_VOICE_ID ?? '';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PROJECT_ROOT is the claudeclaw/ directory — where CLAUDE.md lives.
// The SDK uses this as cwd, which causes Claude Code to load our CLAUDE.md
// and all global skills from ~/.claude/skills/ via settingSources.
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');

// ── External config directory ────────────────────────────────────────
// Personal config files (CLAUDE.md, agent.yaml, agent CLAUDE.md) can live
// outside the repo in CLAUDECLAW_CONFIG (default ~/.claudeclaw) so they
// never get committed. The repo ships only .example template files.

/** Expand ~/... to an absolute path. */
export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

const rawConfigDir =
  process.env.CLAUDECLAW_CONFIG || envConfig.CLAUDECLAW_CONFIG || '~/.claudeclaw';

/**
 * Absolute path to the external config directory.
 * Defaults to ~/.claudeclaw. Set CLAUDECLAW_CONFIG in .env or environment to override.
 */
export const CLAUDECLAW_CONFIG = expandHome(rawConfigDir);

// Telegram limits
export const MAX_MESSAGE_LENGTH = 4096;

// How often to refresh the typing indicator while Claude is thinking (ms).
// Telegram's typing action expires after ~5s, so 4s keeps it continuous.
export const TYPING_REFRESH_MS = 4000;

// Maximum time (ms) an agent query can run before being auto-aborted.
// Safety net for truly stuck commands (e.g. recursive `find /`).
// Default: 15 minutes. Use /stop in Telegram to manually kill a running query.
// Previously 5 min, which caused mid-execution timeouts on bulk API work
// (posting YouTube comments, sending multiple messages) leading to duplicate posts.
export const AGENT_TIMEOUT_MS = parseInt(
  process.env.AGENT_TIMEOUT_MS || envConfig.AGENT_TIMEOUT_MS || '900000',
  10,
);

// Context window limit for the model. Opus 4.6 (1M context) = 1,000,000.
// Override via CONTEXT_LIMIT in .env if using a different model variant.
export const CONTEXT_LIMIT = parseInt(
  process.env.CONTEXT_LIMIT || envConfig.CONTEXT_LIMIT || '1000000',
  10,
);

// Dashboard — web UI for monitoring ClaudeClaw state
export const DASHBOARD_PORT = parseInt(
  process.env.DASHBOARD_PORT || envConfig.DASHBOARD_PORT || '3141',
  10,
);
export const DASHBOARD_TOKEN =
  process.env.DASHBOARD_TOKEN || envConfig.DASHBOARD_TOKEN || '';
export const DASHBOARD_USER =
  process.env.DASHBOARD_USER || envConfig.DASHBOARD_USER || '';
export const DASHBOARD_PASSWORD =
  process.env.DASHBOARD_PASSWORD || envConfig.DASHBOARD_PASSWORD || '';
export const DASHBOARD_URL =
  process.env.DASHBOARD_URL || envConfig.DASHBOARD_URL || '';

// Database encryption key (SQLCipher). Required for encrypted database access.
export const DB_ENCRYPTION_KEY =
  process.env.DB_ENCRYPTION_KEY || envConfig.DB_ENCRYPTION_KEY || '';

// Google API key for Gemini (memory extraction + consolidation)
export const GOOGLE_API_KEY =
  process.env.GOOGLE_API_KEY || envConfig.GOOGLE_API_KEY || '';

// Streaming strategy for progressive Telegram updates.
// 'global-throttle' (default): edits a placeholder message with streamed text,
//   rate-limited to ~24 edits/min per chat to respect Telegram limits.
// 'single-agent-only': streaming disabled when multiple agents are active on same chat.
// 'off': no streaming, wait for full response.
export type StreamStrategy = 'global-throttle' | 'single-agent-only' | 'off';
export const STREAM_STRATEGY: StreamStrategy =
  (process.env.STREAM_STRATEGY || envConfig.STREAM_STRATEGY || 'off') as StreamStrategy;

// ── Security ─────────────────────────────────────────────────────────
// PIN lock: SHA-256 hash of your PIN. Generate: node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PIN').digest('hex'))"
export const SECURITY_PIN_HASH =
  process.env.SECURITY_PIN_HASH || envConfig.SECURITY_PIN_HASH || '';

// Auto-lock after N minutes of inactivity. 0 = disabled. Only active when PIN is set.
export const IDLE_LOCK_MINUTES = parseInt(
  process.env.IDLE_LOCK_MINUTES || envConfig.IDLE_LOCK_MINUTES || '0',
  10,
);

// Emergency kill phrase. Sending this to any bot immediately stops all agents and exits.
export const EMERGENCY_KILL_PHRASE =
  process.env.EMERGENCY_KILL_PHRASE || envConfig.EMERGENCY_KILL_PHRASE || '';

// ── ccos phase 0 — claudeclaw-os feature flags ───────────────────────
// All new vars are optional with sensible defaults. Nothing forces existing
// behavior to change.

// Max agentic turns per query. Caps runaway tool-use loops. Default: 30.
export const AGENT_MAX_TURNS = parseInt(
  process.env.AGENT_MAX_TURNS || envConfig.AGENT_MAX_TURNS || '30',
  10,
);

// Engine backend for agent invocation (docs/rfc-sdk-engine.md).
//   cli — spawn the claude CLI subprocess (default, current behavior)
//   sdk — direct Anthropic Messages API (phases 2-5, not yet implemented)
export type EngineKind = 'cli' | 'sdk';
export const ENGINE: EngineKind =
  ((process.env.ENGINE || envConfig.ENGINE || 'cli').toLowerCase() as EngineKind);

// Smart routing: dispatches incoming messages to the best-fit agent using
// a cheap classifier. Default: disabled (keeps current explicit-bot routing).
export const SMART_ROUTING_ENABLED =
  (process.env.SMART_ROUTING_ENABLED || envConfig.SMART_ROUTING_ENABLED || '')
    .toLowerCase() === 'true';

// Model used for the smart-routing classifier call. Default: haiku.
export const SMART_ROUTING_CHEAP_MODEL =
  process.env.SMART_ROUTING_CHEAP_MODEL ||
  envConfig.SMART_ROUTING_CHEAP_MODEL ||
  'haiku';

// Cost/usage footer displayed with agent responses.
//   off     — no footer
//   compact — tokens + $ on one line
//   verbose — input/output/cache breakdown
//   cost    — $ only
//   full    — compact + context window % used
export type CostFooterMode = 'off' | 'compact' | 'verbose' | 'cost' | 'full';
export const SHOW_COST_FOOTER: CostFooterMode =
  ((process.env.SHOW_COST_FOOTER || envConfig.SHOW_COST_FOOTER || 'compact')
    .toLowerCase() as CostFooterMode);

// Daily budget in USD for rate-tracker warnings at 80% and 95%. 0 = disabled.
export const DAILY_COST_BUDGET = parseFloat(
  process.env.DAILY_COST_BUDGET || envConfig.DAILY_COST_BUDGET || '0',
);

// Hourly token budget for rate-tracker warnings at 80% and 95%. 0 = disabled.
export const HOURLY_TOKEN_BUDGET = parseInt(
  process.env.HOURLY_TOKEN_BUDGET || envConfig.HOURLY_TOKEN_BUDGET || '0',
  10,
);

// Scan outgoing messages for credential leaks (API keys, tokens, etc.).
// Default: true (security on). Set to 'false' to disable.
export const EXFILTRATION_GUARD_ENABLED =
  (process.env.EXFILTRATION_GUARD_ENABLED ||
    envConfig.EXFILTRATION_GUARD_ENABLED ||
    'true')
    .toLowerCase() !== 'false';

// Memory nudge : trigger a "what's worth remembering?" pass every N turns.
// 0 = disabled.
export const MEMORY_NUDGE_INTERVAL_TURNS = parseInt(
  process.env.MEMORY_NUDGE_INTERVAL_TURNS ||
    envConfig.MEMORY_NUDGE_INTERVAL_TURNS ||
    '0',
  10,
);

// War Room voice meeting feature. Default: disabled. Requires separate
// Python service (see warroom/) and DAILY_API_KEY + GOOGLE_API_KEY
// (or VOXTRAL_LOCAL_URL + GROQ_API_KEY for voxtral mode).
export const WARROOM_ENABLED =
  (process.env.WARROOM_ENABLED || envConfig.WARROOM_ENABLED || '')
    .toLowerCase() === 'true';

// War Room WebSocket port. Default: 7860.
export const WARROOM_PORT = parseInt(
  process.env.WARROOM_PORT || envConfig.WARROOM_PORT || '7860',
  10,
);

