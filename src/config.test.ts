import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const TMP_DIR = '/tmp/claudeclaw-config-test';

/**
 * Points readEnvFile to an empty .env so only process.env matters in tests.
 */
function setupEmptyEnv(): void {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, '.env'), '', 'utf-8');
  vi.spyOn(process, 'cwd').mockReturnValue(TMP_DIR);
}

function cleanup(): void {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** Force a fresh import of config.ts so new process.env values take effect. */
async function loadConfig(): Promise<typeof import('./config.js')> {
  vi.resetModules();
  return await import('./config.js');
}

const CCOS_KEYS = [
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
] as const;

describe('config — ccos phase 0 env vars (defaults)', () => {
  beforeEach(() => {
    for (const k of CCOS_KEYS) delete process.env[k];
    setupEmptyEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('AGENT_MAX_TURNS defaults to 30', async () => {
    const cfg = await loadConfig();
    expect(cfg.AGENT_MAX_TURNS).toBe(30);
  });

  it('SMART_ROUTING_ENABLED defaults to false', async () => {
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_ENABLED).toBe(false);
  });

  it('SMART_ROUTING_CHEAP_MODEL defaults to "haiku"', async () => {
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_CHEAP_MODEL).toBe('haiku');
  });

  it('SHOW_COST_FOOTER defaults to "compact"', async () => {
    const cfg = await loadConfig();
    expect(cfg.SHOW_COST_FOOTER).toBe('compact');
  });

  it('DAILY_COST_BUDGET defaults to 0 (disabled)', async () => {
    const cfg = await loadConfig();
    expect(cfg.DAILY_COST_BUDGET).toBe(0);
  });

  it('HOURLY_TOKEN_BUDGET defaults to 0 (disabled)', async () => {
    const cfg = await loadConfig();
    expect(cfg.HOURLY_TOKEN_BUDGET).toBe(0);
  });

  it('EXFILTRATION_GUARD_ENABLED defaults to true (security on by default)', async () => {
    const cfg = await loadConfig();
    expect(cfg.EXFILTRATION_GUARD_ENABLED).toBe(true);
  });

  it('MEMORY_NUDGE_INTERVAL_TURNS defaults to 0 (disabled)', async () => {
    const cfg = await loadConfig();
    expect(cfg.MEMORY_NUDGE_INTERVAL_TURNS).toBe(0);
  });

  it('WARROOM_ENABLED defaults to false', async () => {
    const cfg = await loadConfig();
    expect(cfg.WARROOM_ENABLED).toBe(false);
  });

  it('WARROOM_PORT defaults to 7860', async () => {
    const cfg = await loadConfig();
    expect(cfg.WARROOM_PORT).toBe(7860);
  });
});

describe('config — ccos phase 0 env vars (process.env override)', () => {
  beforeEach(() => {
    for (const k of CCOS_KEYS) delete process.env[k];
    setupEmptyEnv();
  });

  afterEach(() => {
    for (const k of CCOS_KEYS) delete process.env[k];
    vi.restoreAllMocks();
    cleanup();
  });

  it('AGENT_MAX_TURNS parses int from env', async () => {
    process.env.AGENT_MAX_TURNS = '100';
    const cfg = await loadConfig();
    expect(cfg.AGENT_MAX_TURNS).toBe(100);
  });

  it('SMART_ROUTING_ENABLED parses "true" to boolean', async () => {
    process.env.SMART_ROUTING_ENABLED = 'true';
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_ENABLED).toBe(true);
  });

  it('SMART_ROUTING_ENABLED parses "TRUE" (case-insensitive) to true', async () => {
    process.env.SMART_ROUTING_ENABLED = 'TRUE';
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_ENABLED).toBe(true);
  });

  it('SMART_ROUTING_ENABLED parses "false" to false', async () => {
    process.env.SMART_ROUTING_ENABLED = 'false';
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_ENABLED).toBe(false);
  });

  it('SMART_ROUTING_CHEAP_MODEL accepts arbitrary string', async () => {
    process.env.SMART_ROUTING_CHEAP_MODEL = 'claude-haiku-4-5';
    const cfg = await loadConfig();
    expect(cfg.SMART_ROUTING_CHEAP_MODEL).toBe('claude-haiku-4-5');
  });

  it('SHOW_COST_FOOTER accepts "off"', async () => {
    process.env.SHOW_COST_FOOTER = 'off';
    const cfg = await loadConfig();
    expect(cfg.SHOW_COST_FOOTER).toBe('off');
  });

  it('SHOW_COST_FOOTER accepts "verbose"', async () => {
    process.env.SHOW_COST_FOOTER = 'verbose';
    const cfg = await loadConfig();
    expect(cfg.SHOW_COST_FOOTER).toBe('verbose');
  });

  it('DAILY_COST_BUDGET parses float', async () => {
    process.env.DAILY_COST_BUDGET = '10.50';
    const cfg = await loadConfig();
    expect(cfg.DAILY_COST_BUDGET).toBe(10.5);
  });

  it('HOURLY_TOKEN_BUDGET parses int', async () => {
    process.env.HOURLY_TOKEN_BUDGET = '500000';
    const cfg = await loadConfig();
    expect(cfg.HOURLY_TOKEN_BUDGET).toBe(500000);
  });

  it('EXFILTRATION_GUARD_ENABLED can be explicitly disabled', async () => {
    process.env.EXFILTRATION_GUARD_ENABLED = 'false';
    const cfg = await loadConfig();
    expect(cfg.EXFILTRATION_GUARD_ENABLED).toBe(false);
  });

  it('MEMORY_NUDGE_INTERVAL_TURNS parses int', async () => {
    process.env.MEMORY_NUDGE_INTERVAL_TURNS = '5';
    const cfg = await loadConfig();
    expect(cfg.MEMORY_NUDGE_INTERVAL_TURNS).toBe(5);
  });

  it('WARROOM_ENABLED parses "true" to boolean', async () => {
    process.env.WARROOM_ENABLED = 'true';
    const cfg = await loadConfig();
    expect(cfg.WARROOM_ENABLED).toBe(true);
  });

  it('WARROOM_PORT parses int', async () => {
    process.env.WARROOM_PORT = '8080';
    const cfg = await loadConfig();
    expect(cfg.WARROOM_PORT).toBe(8080);
  });
});
