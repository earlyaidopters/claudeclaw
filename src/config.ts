import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { readEnvFile } from './env.js';

const envConfig = readEnvFile([
  'TELEGRAM_BOT_TOKEN',
  'ALLOWED_CHAT_ID',
  'MESSENGER_TYPE',
  'SIGNAL_PHONE_NUMBER',
  'SIGNAL_RPC_HOST',
  'SIGNAL_RPC_PORT',
  'SIGNAL_AUTHORIZED_RECIPIENTS',
  'GROQ_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'WHATSAPP_ENABLED',
  'SLACK_USER_TOKEN',
  'CONTEXT_LIMIT',
  'DASHBOARD_PORT',
  'DASHBOARD_TOKEN',
  'DASHBOARD_URL',
  'CLAUDECLAW_CONFIG',
  'DB_ENCRYPTION_KEY',
  'GOOGLE_API_KEY',
  'AGENT_TIMEOUT_MS',
  'MISSION_TIMEOUT_MS',
  'AGENT_MAX_TURNS',
  'SECURITY_PIN_HASH',
  'IDLE_LOCK_MINUTES',
  'EMERGENCY_KILL_PHRASE',
  'MODEL_FALLBACK_CHAIN',
  'SMART_ROUTING_ENABLED',
  'SMART_ROUTING_CHEAP_MODEL',
  'SHOW_COST_FOOTER',
  'MEMORY_NOTIFY',
  'DAILY_COST_BUDGET',
  'HOURLY_TOKEN_BUDGET',
  'MEMORY_NUDGE_INTERVAL_TURNS',
  'MEMORY_NUDGE_INTERVAL_HOURS',
  'EXFILTRATION_GUARD_ENABLED',
  'PROTECTED_ENV_VARS',
  'WARROOM_ENABLED',
  'WARROOM_PORT',
  'STREAM_STRATEGY',
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
export let agentMcpAllowlist: string[] | undefined; // from agent.yaml mcp_servers
export let agentSkillsAllowlist: string[] | undefined; // from agent.yaml skills_allowlist

export function setAgentOverrides(opts: {
  agentId: string;
  botToken: string;
  cwd: string;
  model?: string;
  obsidian?: { vault: string; folders: string[]; readOnly?: string[] };
  systemPrompt?: string;
  mcpServers?: string[];
  skillsAllowlist?: string[];
}): void {
  AGENT_ID = opts.agentId;
  activeBotToken = opts.botToken;
  agentCwd = opts.cwd;
  agentDefaultModel = opts.model;
  agentObsidianConfig = opts.obsidian;
  agentSystemPrompt = opts.systemPrompt;
  agentMcpAllowlist = opts.mcpServers;
  agentSkillsAllowlist = opts.skillsAllowlist;
}

export const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN || '';

// Only respond to this Telegram chat ID. Set this after getting your ID via /chatid.
export const ALLOWED_CHAT_ID =
  process.env.ALLOWED_CHAT_ID || envConfig.ALLOWED_CHAT_ID || '';

// ── Messenger adapter selection ──────────────────────────────────────
// Which messenger front-end runs: 'telegram' (default, grammy via bot.ts)
// or 'signal' (signal-cli JSON-RPC via signal-bot.ts). Picked once at
// startup in index.ts; the two code paths never run simultaneously.
export type MessengerType = 'telegram' | 'signal';
export const MESSENGER_TYPE: MessengerType =
  ((process.env.MESSENGER_TYPE || envConfig.MESSENGER_TYPE || 'telegram').toLowerCase() as MessengerType);

// ── Signal (alternative messenger via signal-cli) ────────────────────
export const SIGNAL_PHONE_NUMBER =
  process.env.SIGNAL_PHONE_NUMBER || envConfig.SIGNAL_PHONE_NUMBER || '';
export const SIGNAL_RPC_HOST =
  process.env.SIGNAL_RPC_HOST || envConfig.SIGNAL_RPC_HOST || '127.0.0.1';
export const SIGNAL_RPC_PORT = parseInt(
  process.env.SIGNAL_RPC_PORT || envConfig.SIGNAL_RPC_PORT || '7583',
  10,
);
// Comma-separated list of allowed sender numbers. Messages from anyone
// else get dropped with a single audit entry. Usually just your own number.
export const SIGNAL_AUTHORIZED_RECIPIENTS = (
  process.env.SIGNAL_AUTHORIZED_RECIPIENTS || envConfig.SIGNAL_AUTHORIZED_RECIPIENTS || ''
).split(',').map((s) => s.trim()).filter(Boolean);

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
// STORE_DIR can be overridden via CLAUDECLAW_STORE_DIR so tests (or other
// isolated invocations) don't write to the live DB at store/claudeclaw.db.
export const STORE_DIR = process.env.CLAUDECLAW_STORE_DIR
  ? path.resolve(process.env.CLAUDECLAW_STORE_DIR)
  : path.resolve(PROJECT_ROOT, 'store');

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
// Default: 30 minutes. Use /stop in Telegram to manually kill a running query.
// History: 5 min was too tight (mid-execution timeouts on bulk API work,
// duplicate posts). 15 min still hit the ceiling on complex multi-step
// refactors and large codebase searches. 30 min covers the 95th percentile
// without being absurd; stuck agents are still contained inside the window,
// and users who prefer faster feedback can dial it down.
export const AGENT_TIMEOUT_MS = parseInt(
  process.env.AGENT_TIMEOUT_MS || envConfig.AGENT_TIMEOUT_MS || '1800000',
  10,
);

// Mission task timeout — per-task overrides take priority, this is the global default.
// Floor of 60 s to prevent misconfiguration.
export const MISSION_TIMEOUT_MS = Math.max(
  60_000,
  parseInt(process.env.MISSION_TIMEOUT_MS || envConfig.MISSION_TIMEOUT_MS || '900000', 10),
);

// Maximum number of agentic turns (tool-use rounds) per query.
// Prevents runaway loops when external services fail (e.g. stale cookies causing
// 40+ sequential Bash retries). 0 = unlimited (SDK default).
// Default: 30 turns, which is generous for complex skills but stops spirals.
export const AGENT_MAX_TURNS = parseInt(
  process.env.AGENT_MAX_TURNS || envConfig.AGENT_MAX_TURNS || '30',
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

// ── Hermes-inspired enhancements ────────────────────────────────────

// Model fallback chain: comma-separated model IDs. When the primary model
// fails with an overloaded/billing error, try the next model in the chain.
// Example: "claude-sonnet-4-6,claude-haiku-4-5"
export const MODEL_FALLBACK_CHAIN = (
  process.env.MODEL_FALLBACK_CHAIN || envConfig.MODEL_FALLBACK_CHAIN || ''
).split(',').map((s) => s.trim()).filter(Boolean);

// Smart model routing: route simple messages to a cheap model.
// Defaults to false to preserve existing behavior. Opt in via .env.
export const SMART_ROUTING_ENABLED =
  (process.env.SMART_ROUTING_ENABLED || envConfig.SMART_ROUTING_ENABLED || 'false').toLowerCase() === 'true';
export const SMART_ROUTING_CHEAP_MODEL =
  process.env.SMART_ROUTING_CHEAP_MODEL || envConfig.SMART_ROUTING_CHEAP_MODEL || 'claude-haiku-4-5';

// Cost footer on every response.
// compact = model only, verbose = model + tokens, cost = model + $, full = everything
export type CostFooterMode = 'off' | 'compact' | 'verbose' | 'cost' | 'full';
export const SHOW_COST_FOOTER: CostFooterMode =
  (process.env.SHOW_COST_FOOTER || envConfig.SHOW_COST_FOOTER || 'compact') as CostFooterMode;

// Memory notifications: send Telegram message when high-importance memories are created.
// Set to 'off' to disable. Default: 'on'.
export const MEMORY_NOTIFY: boolean =
  (process.env.MEMORY_NOTIFY || envConfig.MEMORY_NOTIFY || 'on') !== 'off';

// Daily cost budget in USD. Warns at 80%. Set to 0 to disable (default).
// Only useful for API/pay-per-use users. Subscription users should leave off.
export const DAILY_COST_BUDGET = parseFloat(
  process.env.DAILY_COST_BUDGET || envConfig.DAILY_COST_BUDGET || '0',
);

// Hourly token budget. Warns at 80%. Set to 0 to disable (default).
export const HOURLY_TOKEN_BUDGET = parseInt(
  process.env.HOURLY_TOKEN_BUDGET || envConfig.HOURLY_TOKEN_BUDGET || '0',
  10,
);

// Memory nudge intervals
export const MEMORY_NUDGE_INTERVAL_TURNS = parseInt(
  process.env.MEMORY_NUDGE_INTERVAL_TURNS || envConfig.MEMORY_NUDGE_INTERVAL_TURNS || '10',
  10,
);
export const MEMORY_NUDGE_INTERVAL_HOURS = parseInt(
  process.env.MEMORY_NUDGE_INTERVAL_HOURS || envConfig.MEMORY_NUDGE_INTERVAL_HOURS || '2',
  10,
);

// Secret exfiltration guard
export const EXFILTRATION_GUARD_ENABLED =
  (process.env.EXFILTRATION_GUARD_ENABLED || envConfig.EXFILTRATION_GUARD_ENABLED || 'true').toLowerCase() === 'true';
export const PROTECTED_ENV_VARS = (
  process.env.PROTECTED_ENV_VARS || envConfig.PROTECTED_ENV_VARS ||
  'ANTHROPIC_API_KEY,CLAUDE_CODE_OAUTH_TOKEN,DB_ENCRYPTION_KEY,TELEGRAM_BOT_TOKEN,SLACK_USER_TOKEN,GROQ_API_KEY,ELEVENLABS_API_KEY,GOOGLE_API_KEY'
).split(',').map((s) => s.trim()).filter(Boolean);

// ── War Room (voice meeting via Pipecat WebSocket) ──────────────────
export const WARROOM_ENABLED =
  (process.env.WARROOM_ENABLED || envConfig.WARROOM_ENABLED || 'false').toLowerCase() === 'true';
export const WARROOM_PORT = parseInt(
  process.env.WARROOM_PORT || envConfig.WARROOM_PORT || '7860',
  10,
);

