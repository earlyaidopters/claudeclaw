/**
 * Tests for loadMcpServers (per-agent MCP allowlist).
 *
 * Writes temporary settings.json files to simulate user + project MCP
 * configs and asserts that the allowlist correctly filters the result.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mocks must happen before import of agent.js
vi.mock('./env.js', () => ({ readEnvFile: vi.fn(() => ({})) }));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let TMP_HOME: string;
let TMP_PROJECT: string;

beforeEach(() => {
  TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ccos-mcp-home-'));
  TMP_PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'ccos-mcp-proj-'));
  fs.mkdirSync(path.join(TMP_HOME, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(TMP_PROJECT, '.claude'), { recursive: true });
  process.env.HOME = TMP_HOME;
});

afterEach(() => {
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  fs.rmSync(TMP_PROJECT, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeUserSettings(config: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(TMP_HOME, '.claude', 'settings.json'),
    JSON.stringify(config),
    'utf-8',
  );
}

function writeProjectSettings(config: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(TMP_PROJECT, '.claude', 'settings.json'),
    JSON.stringify(config),
    'utf-8',
  );
}

async function loadFreshAgent(): Promise<typeof import('./agent.js')> {
  vi.resetModules();
  return await import('./agent.js');
}

describe('loadMcpServers', () => {
  it('returns empty map when no settings files exist', async () => {
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(result).toEqual({});
  });

  it('loads user settings mcpServers', async () => {
    writeUserSettings({
      mcpServers: {
        'mail-ledger': { command: '/usr/bin/mail-ledger-mcp' },
      },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(result['mail-ledger']).toBeDefined();
    expect(result['mail-ledger'].command).toBe('/usr/bin/mail-ledger-mcp');
  });

  it('loads project settings mcpServers (overrides user on name collision)', async () => {
    writeUserSettings({
      mcpServers: { 'mail-ledger': { command: '/usr/bin/mcp-user' } },
    });
    writeProjectSettings({
      mcpServers: { 'mail-ledger': { command: '/usr/bin/mcp-project' } },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(result['mail-ledger'].command).toBe('/usr/bin/mcp-project');
  });

  it('merges user + project servers with distinct names', async () => {
    writeUserSettings({
      mcpServers: { 'google-drive': { command: '/usr/bin/gdrive-mcp' } },
    });
    writeProjectSettings({
      mcpServers: { 'mail-ledger': { command: '/usr/bin/mail-ledger-mcp' } },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(Object.keys(result).sort()).toEqual(['google-drive', 'mail-ledger']);
  });

  it('filters to allowlist when provided (qonto isolation case)', async () => {
    writeUserSettings({
      mcpServers: {
        'google-drive': { command: '/usr/bin/gdrive-mcp' },
        'mail-ledger': { command: '/usr/bin/mail-ledger-mcp' },
        'slack': { command: '/usr/bin/slack-mcp' },
      },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(['mail-ledger'], TMP_PROJECT);
    expect(Object.keys(result)).toEqual(['mail-ledger']);
  });

  it('empty allowlist returns zero servers (deny-all)', async () => {
    writeUserSettings({
      mcpServers: { 'google-drive': { command: '/usr/bin/gdrive-mcp' } },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers([], TMP_PROJECT);
    expect(result).toEqual({});
  });

  it('preserves args and env fields', async () => {
    writeProjectSettings({
      mcpServers: {
        'mail-ledger': {
          command: '/usr/bin/mail-ledger-mcp',
          args: ['--read-only'],
          env: { LOG_LEVEL: 'info' },
        },
      },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(result['mail-ledger'].args).toEqual(['--read-only']);
    expect(result['mail-ledger'].env).toEqual({ LOG_LEVEL: 'info' });
  });

  it('tolerates malformed JSON in a settings file (skips it)', async () => {
    fs.writeFileSync(
      path.join(TMP_HOME, '.claude', 'settings.json'),
      'not valid json{{',
      'utf-8',
    );
    writeProjectSettings({
      mcpServers: { 'mail-ledger': { command: '/usr/bin/mail-ledger-mcp' } },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(Object.keys(result)).toEqual(['mail-ledger']);
  });

  it('skips MCP entries without a command field', async () => {
    writeProjectSettings({
      mcpServers: {
        'valid': { command: '/bin/ok' },
        'invalid': { args: ['--foo'] }, // no command
      },
    });
    const { loadMcpServers } = await loadFreshAgent();
    const result = loadMcpServers(undefined, TMP_PROJECT);
    expect(Object.keys(result)).toEqual(['valid']);
  });
});
