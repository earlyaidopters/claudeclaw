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

// PROJECT_ROOT is the claudeclaw/ directory.
// The SDK uses this as cwd, loading CLAUDE.md and global skills via settingSources.
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');

// Personal config folder — stores personal config outside the repo.
// Tilde is expanded here so the rest of the codebase gets an absolute path.
export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.resolve(p);
}
const rawConfigDir =
  process.env.CLAUDECLAW_CONFIG || envConfig.CLAUDECLAW_CONFIG;
export const CLAUDECLAW_CONFIG = rawConfigDir ? expandHome(rawConfigDir) : '';

// Workspace — the cwd passed to the Claude Agent SDK.
// CLAUDE.md lives here; the SDK loads it as the project-level system prompt.
export const CLAUDECLAW_WORKSPACE = CLAUDECLAW_CONFIG ? path.join(CLAUDECLAW_CONFIG, 'workspace') : '';

// Telegram limits
export const MAX_MESSAGE_LENGTH = 4096;

// How often to refresh the typing indicator while Claude is thinking (ms).
// Telegram's typing action expires after ~5s, so 4s keeps it continuous.
export const TYPING_REFRESH_MS = 4000;

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
