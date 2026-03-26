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
  'DASHBOARD_URL',
  'CLAUDECLAW_CONFIG',
  'DB_ENCRYPTION_KEY',
  'GOOGLE_API_KEY',
  'ALLOWED_CHAT_IDS',
  'BACKGROUND_MAX_CONCURRENT',
  'AUTO_ARCHIVE_DAYS',
  'TOPIC_CLASSIFY_ENABLED',
  'FORUM_CHAT_ID',
  'AGENT_TIMEOUT_MS',
  'AGENT_TIMEOUT_MS_SHORT',
  'MISSION_TIMEOUT_MS',
  'SUBTASK_TIMEOUT_MS',
  'MISSION_MAX_RETRIES',
  'SECURITY_PIN_HASH',
  'IDLE_LOCK_MINUTES',
  'EMERGENCY_KILL_PHRASE',
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

export function setAgentOverrides(opts: {
  agentId: string;
  botToken: string;
  cwd: string;
  model?: string;
  obsidian?: { vault: string; folders: string[]; readOnly?: string[] };
  systemPrompt?: string;
}): void {
  AGENT_ID = opts.agentId;
  activeBotToken = opts.botToken;
  agentCwd = opts.cwd;
  agentDefaultModel = opts.model;
  agentObsidianConfig = opts.obsidian;
  agentSystemPrompt = opts.systemPrompt;
}

export const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN || '';

// Only respond to this Telegram chat ID. Set this after getting your ID via /chatid.
export const ALLOWED_CHAT_ID =
  process.env.ALLOWED_CHAT_ID || envConfig.ALLOWED_CHAT_ID || '';

/** Comma-separated list of allowed chat IDs (supports both DM and Forum Group). Falls back to ALLOWED_CHAT_ID. */
export const ALLOWED_CHAT_IDS: string[] = (() => {
  const raw = process.env.ALLOWED_CHAT_IDS || envConfig.ALLOWED_CHAT_IDS || '';
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ALLOWED_CHAT_ID) return [ALLOWED_CHAT_ID];
  return [];
})();

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
// Prevents runaway commands (e.g. recursive `find /`) from blocking the bot indefinitely.
// Default: 15 minutes — raised from 5m because Data regularly does multi-file builds,
// project scaffolding, and dashboard changes that legitimately take 10-12 minutes.
// Override via AGENT_TIMEOUT_MS in .env.
export const AGENT_TIMEOUT_MS = parseInt(
  process.env.AGENT_TIMEOUT_MS || envConfig.AGENT_TIMEOUT_MS || '900000',
  10,
);

// For simple/conversational messages, use a shorter timeout to fail fast.
// A message is "complex" if it mentions build/create/scaffold/implement/write/fix
// or is longer than 300 chars. Complex tasks get the full AGENT_TIMEOUT_MS.
// Simple tasks get AGENT_TIMEOUT_MS_SHORT (default: 3 minutes).
export const AGENT_TIMEOUT_MS_SHORT = parseInt(
  process.env.AGENT_TIMEOUT_MS_SHORT || envConfig.AGENT_TIMEOUT_MS_SHORT || '180000',
  10,
);

const COMPLEX_KEYWORDS = /\b(build|create|scaffold|implement|write|fix|install|deploy|migrate|refactor|generate|add|update|modify|edit)\b/i;
export function getTimeoutForMessage(message: string): number {
  if (message.length > 300 || COMPLEX_KEYWORDS.test(message)) {
    return AGENT_TIMEOUT_MS;
  }
  return AGENT_TIMEOUT_MS_SHORT;
}

// Mission-specific timeouts — independent from per-message agent timeouts.
// SUBTASK_TIMEOUT_MS: max time for a single focused subtask within a mission.
// Default 10 minutes — subtasks are decomposed to be focused; if one needs 15m,
// the decomposition was too coarse.
export const SUBTASK_TIMEOUT_MS = parseInt(
  process.env.SUBTASK_TIMEOUT_MS || envConfig.SUBTASK_TIMEOUT_MS || '600000',
  10,
);

// MISSION_TIMEOUT_MS: overall wall-clock cap for an entire mission.
// Default 45 minutes — a 5-subtask mission at 10m each = 50m worst case.
export const MISSION_TIMEOUT_MS = parseInt(
  process.env.MISSION_TIMEOUT_MS || envConfig.MISSION_TIMEOUT_MS || '2700000',
  10,
);

// MISSION_MAX_RETRIES: how many times a timed-out subtask can be retried.
// Only timeouts are retried, not logic errors.
export const MISSION_MAX_RETRIES = parseInt(
  process.env.MISSION_MAX_RETRIES || envConfig.MISSION_MAX_RETRIES || '1',
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

// ── Forum Topics ────────────────────────────────────────────────

/** Maximum concurrent background tasks (semaphore slots). */
export const BACKGROUND_MAX_CONCURRENT = parseInt(
  process.env.BACKGROUND_MAX_CONCURRENT || envConfig.BACKGROUND_MAX_CONCURRENT || '2',
  10,
);

/** Days of inactivity before a forum topic is auto-archived. */
export const AUTO_ARCHIVE_DAYS = parseInt(
  process.env.AUTO_ARCHIVE_DAYS || envConfig.AUTO_ARCHIVE_DAYS || '7',
  10,
);

/** Kill switch for LLM-powered topic classification. */
export const TOPIC_CLASSIFY_ENABLED =
  (process.env.TOPIC_CLASSIFY_ENABLED || envConfig.TOPIC_CLASSIFY_ENABLED || 'true').toLowerCase() === 'true';

/** Explicit forum group chat ID. If set, this chat is treated as a forum regardless of auto-detection. */
export const FORUM_CHAT_ID =
  process.env.FORUM_CHAT_ID || envConfig.FORUM_CHAT_ID || '';

/**
 * Build a composite key for per-topic state and queue isolation.
 * Returns `chatId` for DMs (topicId is null/undefined) or `chatId:topicId` for Forum Topics.
 */
export function contextKey(chatId: string, topicId?: string | null): string {
  return topicId ? `${chatId}:${topicId}` : chatId;
}

// ── Streaming ────────────────────────────────────────────────────────
// Streaming strategy for progressive Telegram updates.
// 'global-throttle' (default): edits a placeholder message with streamed text,
//   rate-limited to ~24 edits/min per chat to respect Telegram limits.
// 'single-agent-only': streaming disabled when multiple agents are active on same chat.
// 'off': no streaming, wait for full response.
export type StreamStrategy = 'global-throttle' | 'single-agent-only' | 'off';
export const STREAM_STRATEGY: StreamStrategy =
  (process.env.STREAM_STRATEGY || 'off') as StreamStrategy;

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
