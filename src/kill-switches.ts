/**
 * Runtime kill switches.
 *
 * Lets an operator hot-disable a feature surface by flipping an env var in
 * .env without redeploying or restarting any process. The values are
 * re-read from .env every TTL_MS (1.5s) so a flag flip lands in <2s
 * across all agent processes.
 *
 * Why not module-load-time? An incident may need to disable LLM spawns or
 * dashboard mutations RIGHT NOW. Restarting the main agent loses in-flight
 * state. Editing .env and waiting 2 seconds is better.
 *
 * All flags default to ENABLED so removing them is a no-op. Set a flag to
 * "false" / "0" / "no" / "off" to disable. Anything else (including unset)
 * is treated as enabled.
 */

import { readEnvFile } from './env.js';

export type KillSwitch =
  | 'WARROOM_TEXT_ENABLED'
  | 'WARROOM_VOICE_ENABLED'
  | 'LLM_SPAWN_ENABLED'
  | 'DASHBOARD_MUTATIONS_ENABLED'
  | 'MISSION_AUTO_ASSIGN_ENABLED'
  | 'SCHEDULER_ENABLED';

const ALL_SWITCHES: KillSwitch[] = [
  'WARROOM_TEXT_ENABLED',
  'WARROOM_VOICE_ENABLED',
  'LLM_SPAWN_ENABLED',
  'DASHBOARD_MUTATIONS_ENABLED',
  'MISSION_AUTO_ASSIGN_ENABLED',
  'SCHEDULER_ENABLED',
];

const TTL_MS = 1500;

interface CacheEntry {
  values: Record<KillSwitch, boolean>;
  loadedAt: number;
}

let _cache: CacheEntry | null = null;

function isOff(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === 'false' || v === '0' || v === 'no' || v === 'off' || v === 'disabled';
}

function loadAll(): CacheEntry {
  // process.env wins over .env file so an operator running with an
  // explicit shell-set value still sees it. Most users edit .env.
  const fromEnvFile = readEnvFile(ALL_SWITCHES);
  const values = {} as Record<KillSwitch, boolean>;
  for (const k of ALL_SWITCHES) {
    const raw = process.env[k] ?? fromEnvFile[k];
    values[k] = !isOff(raw); // default: enabled
  }
  return { values, loadedAt: Date.now() };
}

/**
 * True if the named kill switch is currently in the ENABLED state.
 * Cached for TTL_MS to avoid disk reads on every request.
 */
export function isEnabled(name: KillSwitch): boolean {
  const now = Date.now();
  if (!_cache || now - _cache.loadedAt > TTL_MS) {
    _cache = loadAll();
  }
  return _cache.values[name];
}

/**
 * Snapshot of every kill switch state. Used by /api/health so an operator
 * can verify a flag flip from outside the process.
 */
export function snapshot(): Record<KillSwitch, boolean> {
  const now = Date.now();
  if (!_cache || now - _cache.loadedAt > TTL_MS) {
    _cache = loadAll();
  }
  return { ..._cache.values };
}

/** Bypass the cache. Useful in tests. */
export function _reset(): void {
  _cache = null;
}

/**
 * Typed error thrown by `requireEnabled()` when an LLM-spawning code path
 * runs while a kill switch is off. Callers can catch + surface a clean
 * "feature disabled" message to the user instead of an opaque crash.
 */
export class KillSwitchDisabledError extends Error {
  constructor(public readonly switchName: KillSwitch) {
    super(`Kill switch ${switchName} is currently disabled (set in .env to re-enable)`);
    this.name = 'KillSwitchDisabledError';
  }
}

// Counter of refused LLM spawns since boot, surfaced via /api/health so
// an operator can see "we just refused 3 LLM spawns in the last minute"
// after flipping a flag during an incident.
let _refusalCounts: Record<string, number> = {};

/**
 * Throw if the named kill switch is disabled. Intended for centralized
 * enforcement at every LLM-spawning boundary so a single switch flip in
 * .env actually stops all spawn paths, not just the one route that
 * happens to be wrapped.
 */
export function requireEnabled(name: KillSwitch): void {
  if (!isEnabled(name)) {
    _refusalCounts[name] = (_refusalCounts[name] || 0) + 1;
    throw new KillSwitchDisabledError(name);
  }
}

/** Snapshot of refusal counters since boot. Used by /api/health. */
export function refusalCounts(): Record<string, number> {
  return { ..._refusalCounts };
}
