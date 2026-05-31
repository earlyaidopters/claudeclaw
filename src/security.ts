/**
 * Security module for ClaudeClaw.
 *
 * Layers:
 * 1. PIN lock + idle auto-lock: session must be unlocked before commands execute
 * 2. Emergency kill switch: a phrase that shuts down the process immediately
 * 3. Audit logging: every action is recorded to SQLite + structured logger
 *
 * All layers are optional and zero-friction when not configured.
 */

import crypto from 'crypto';
import { execSync } from 'child_process';
import os from 'os';

import { logger } from './logger.js';

// ── Configuration (set via initSecurity) ─────────────────────────────

let _pinHash = '';           // salted SHA-256 hash of the PIN
let _pinSalt = '';           // salt prefix extracted from the stored hash
let _idleLockMinutes = 0;   // 0 = disabled
let _killPhrase = '';        // empty = disabled

export function initSecurity(opts: {
  pinHash?: string;
  idleLockMinutes?: number;
  killPhrase?: string;
}): void {
  if (opts.pinHash) {
    // Format: "salt:hash" or legacy bare hash (no salt)
    const parts = opts.pinHash.split(':');
    if (parts.length === 2) {
      _pinSalt = parts[0];
      _pinHash = opts.pinHash; // store full "salt:hash"
    } else {
      // Legacy format (bare hash, no salt). Still works but less secure.
      _pinHash = opts.pinHash;
      _pinSalt = '';
    }
    _locked = true;
    logger.info('Security: PIN lock enabled, bot starts locked');
  }
  _idleLockMinutes = opts.idleLockMinutes ?? 0;
  _killPhrase = opts.killPhrase || '';

  if (_idleLockMinutes > 0 && _pinHash) {
    logger.info({ minutes: _idleLockMinutes }, 'Security: idle auto-lock enabled');
  }
  if (_killPhrase) {
    logger.info('Security: emergency kill phrase configured');
  }
}

/** Whether PIN lock is configured. */
export function isSecurityEnabled(): boolean {
  return !!_pinHash;
}

// ── PIN Lock ─────────────────────────────────────────────────────────

let _locked = false;
let _lastActivity = Date.now();

export function isLocked(): boolean {
  if (!_pinHash) return false;
  // Check idle timeout on every lock query (simpler than setInterval)
  if (!_locked && _idleLockMinutes > 0) {
    const idleMs = Date.now() - _lastActivity;
    if (idleMs >= _idleLockMinutes * 60 * 1000) {
      _locked = true;
      logger.info('Security: session auto-locked (idle timeout)');
    }
  }
  return _locked;
}

export function lock(): void {
  if (!_pinHash) return;
  _locked = true;
  logger.info('Security: session locked');
}

export function unlock(pin: string): boolean {
  if (!_pinHash) return true;
  if (verifyPin(pin, _pinHash)) {
    _locked = false;
    _lastActivity = Date.now();
    logger.info('Security: session unlocked');
    return true;
  }
  logger.warn('Security: incorrect PIN attempt');
  return false;
}

/** Record activity to reset idle timeout. */
export function touchActivity(): void {
  _lastActivity = Date.now();
}

/**
 * Hash a PIN with a random salt. Returns "salt:hash".
 * Used during setup to generate the value stored in .env.
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + pin.trim()).digest('hex');
  return `${salt}:${hash}`;
}

/** Verify a PIN against a stored "salt:hash" or legacy bare hash. */
function verifyPin(pin: string, stored: string): boolean {
  const trimmed = pin.trim();
  const parts = stored.split(':');
  if (parts.length === 2) {
    // Salted format
    const hash = crypto.createHash('sha256').update(parts[0] + trimmed).digest('hex');
    return hash === parts[1];
  }
  // Legacy bare hash (no salt)
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  return hash === stored;
}

// ── Emergency Kill ───────────────────────────────────────────────────

/** Check if the message is the emergency kill phrase. */
export function checkKillPhrase(message: string): boolean {
  if (!_killPhrase) return false;
  return message.trim().toLowerCase() === _killPhrase.toLowerCase();
}

/**
 * Execute the emergency shutdown.
 * Stops all ClaudeClaw services and force-exits after a brief timeout.
 */
export function executeEmergencyKill(): void {
  logger.warn('EMERGENCY KILL activated');

  // Force exit after 5s even if launchctl/systemctl hangs
  setTimeout(() => process.exit(1), 5000);

  try {
    if (os.platform() === 'darwin') {
      // Stop all ClaudeClaw launchd services
      try {
        const output = execSync('launchctl list 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
        for (const line of output.split('\n')) {
          const cols = line.trim().split(/\s+/);
          const label = cols[cols.length - 1]; // label is the last column
          if (label && label.startsWith('com.claudeclaw.')) {
            try { execSync(`launchctl stop "${label}"`, { stdio: 'ignore', timeout: 2000 }); } catch { /* ok */ }
          }
        }
      } catch { /* launchctl failed, still exit */ }
    } else if (os.platform() === 'linux') {
      try {
        execSync('systemctl --user stop "com.claudeclaw.*" 2>/dev/null', { stdio: 'ignore', timeout: 3000 });
      } catch { /* ok */ }
    } else if (os.platform() === 'win32') {
      // Enumerate scheduled tasks matching com.claudeclaw.* and end each one.
      // schtasks doesn't accept wildcards in /End, so we parse /Query output.
      try {
        const out = execSync('schtasks /Query /FO CSV /NH', { encoding: 'utf-8', timeout: 3000 });
        for (const line of out.split(/\r?\n/)) {
          // CSV: "TaskName","Next Run Time","Status"
          const match = line.match(/^"(\\?com\.claudeclaw\.[^"]+)"/);
          if (match) {
            const name = match[1];
            try { execSync(`schtasks /End /TN "${name}"`, { stdio: 'ignore', timeout: 2000 }); } catch { /* ok */ }
          }
        }
      } catch { /* schtasks failed, still exit */ }
    }
  } catch { /* don't let anything prevent exit */ }

  process.exit(0);
}

// ── Audit Log ────────────────────────────────────────────────────────

export type AuditAction =
  | 'message'
  | 'command'
  | 'delegation'
  | 'unlock'
  | 'lock'
  | 'kill'
  | 'blocked';

export interface AuditEntry {
  agentId: string;
  chatId: string;
  action: AuditAction;
  detail: string;
  blocked: boolean;
}

let _auditCallback: ((entry: AuditEntry) => void) | null = null;

export function setAuditCallback(cb: (entry: AuditEntry) => void): void {
  _auditCallback = cb;
}

export function audit(entry: AuditEntry): void {
  if (_auditCallback) {
    try { _auditCallback(entry); } catch { /* don't let audit failures block operations */ }
  }
  logger.info({ audit: true, ...entry }, `Audit: ${entry.action}`);
}

// ── SDK subprocess env scrubbing ─────────────────────────────────────
//
// Every Claude Agent SDK call spawns a `claude` subprocess that inherits
// our env. By default that means `DASHBOARD_TOKEN`, `DB_ENCRYPTION_KEY`,
// `DAILY_API_KEY`, third-party API keys, etc. are visible to the model
// and to whatever tools it runs. A prompt-injected agent can read them
// trivially.
//
// `getScrubbedSdkEnv` returns the env to pass to `query({ env, ... })`:
//   - Drops nested Claude-Code-session state so the child SDK process
//     doesn't try to attach to the parent's IPC socket (legacy bug).
//   - Drops every secret-shaped variable the SDK doesn't actually need.
//   - Preserves whichever of CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY
//     the caller passed (SDK auth requires one of them; without one, the
//     subprocess exits 1).
//   - Resolves missing tokens from .env via readEnvFile so callers don't
//     have to know how the secret is sourced.
//
// This is a blocklist (drop the dangerous), not a strict allowlist (keep
// only the explicitly safe), to avoid breaking obscure-but-required env
// vars like NODE_PATH, NPM config, locale. Tighten further as we verify
// each site.

const SDK_DROP_VARS_NESTED_CLAUDE = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_CODE_IPC_PORT',
  'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
] as const;

// Exact secret env names we never want the SDK subprocess to see.
const SDK_DROP_VARS_SECRETS = [
  'DASHBOARD_TOKEN',
  'DB_ENCRYPTION_KEY',
  'DAILY_API_KEY',
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'ELEVENLABS_API_KEY',
  'PIKA_DEV_KEY',
  'TELEGRAM_BOT_TOKEN',
  'SLACK_USER_TOKEN',
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'RESEND_API_KEY',
  'GUMROAD_ACCESS_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'CLOUDFLARE_API_TOKEN',
  'GITHUB_TOKEN',
  'NOTION_API_KEY',
  'PIN_HASH',
  'DAILY_DOMAIN',
] as const;

// Heuristic: any env var whose name matches one of these patterns is a
// likely secret (defense in depth for keys we haven't enumerated).
// `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` are exceptions —
// the SDK needs them to authenticate.
const SDK_SECRET_NAME_PATTERNS = [
  /_API_KEY$/,
  /_TOKEN$/,
  /_SECRET$/,
  /^SECRET_/,
] as const;

const SDK_AUTH_VARS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'] as const;

/**
 * Return a scrubbed env dict suitable for passing to `query({ env, ... })`.
 * Pass `authSecrets` only if you've already loaded them via readEnvFile
 * (e.g. when the caller is itself running with secrets stripped from
 * process.env). When omitted, falls back to whatever's in process.env.
 */
export function getScrubbedSdkEnv(
  authSecrets?: Partial<Record<typeof SDK_AUTH_VARS[number], string>>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };

  for (const k of SDK_DROP_VARS_NESTED_CLAUDE) delete env[k];
  for (const k of SDK_DROP_VARS_SECRETS) delete env[k];

  // Pattern-based drop. Walk a snapshot of keys so we can mutate the
  // dict during iteration.
  for (const key of Object.keys(env)) {
    if ((SDK_AUTH_VARS as readonly string[]).includes(key)) continue;
    if (SDK_SECRET_NAME_PATTERNS.some((re) => re.test(key))) {
      delete env[key];
    }
  }

  // Re-inject auth secrets the caller explicitly opted to allow. Without
  // at least one of these, the SDK subprocess can't authenticate.
  if (authSecrets) {
    for (const k of SDK_AUTH_VARS) {
      const v = authSecrets[k];
      if (v) env[k] = v;
    }
  }

  return env;
}

// ── Status ───────────────────────────────────────────────────────────

export function getSecurityStatus(): {
  pinEnabled: boolean;
  locked: boolean;
  idleLockMinutes: number;
  killPhraseEnabled: boolean;
  lastActivity: number;
} {
  return {
    pinEnabled: !!_pinHash,
    locked: isLocked(), // also triggers idle check
    idleLockMinutes: _idleLockMinutes,
    killPhraseEnabled: !!_killPhrase,
    lastActivity: _lastActivity,
  };
}
