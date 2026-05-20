import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

let tmpRoot: string;
let projectRoot: string;
let claudeclawConfig: string;
let storeDir: string;

// Mock config BEFORE importing agent-config so STORE_DIR/PROJECT_ROOT point at tmp.
vi.mock('./config.js', () => {
  return {
    get CLAUDECLAW_CONFIG() { return claudeclawConfig; },
    get PROJECT_ROOT() { return projectRoot; },
    get STORE_DIR() { return storeDir; },
  };
});

// Mock env reader so loadAgentConfig doesn't fail on missing bot token.
vi.mock('./env.js', () => ({
  readEnvFile: () => ({ TEST_BOT_TOKEN: 'dummy' }),
}));

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeclaw-agent-config-'));
  projectRoot = path.join(tmpRoot, 'project');
  claudeclawConfig = path.join(tmpRoot, 'config');
  storeDir = path.join(tmpRoot, 'store');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(claudeclawConfig, { recursive: true });
  fs.mkdirSync(storeDir, { recursive: true });
  process.env.TEST_BOT_TOKEN = 'dummy';
});

afterEach(() => {
  delete process.env.TEST_BOT_TOKEN;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeAgentYaml(agentId: string, content: Record<string, unknown>): string {
  const agentDir = path.join(projectRoot, 'agents', agentId);
  fs.mkdirSync(agentDir, { recursive: true });
  const yamlPath = path.join(agentDir, 'agent.yaml');
  fs.writeFileSync(yamlPath, yaml.dump(content), 'utf-8');
  return yamlPath;
}

describe('setAgentDescription', () => {
  it('updates the description field in agent.yaml', async () => {
    const yamlPath = writeAgentYaml('raka', {
      name: 'Raka',
      description: 'Old description',
      telegram_bot_token_env: 'TEST_BOT_TOKEN',
      model: 'claude-haiku-4-5',
    });

    const { setAgentDescription, loadAgentConfig } = await import('./agent-config.js');
    setAgentDescription('raka', 'New research librarian');

    const raw = yaml.load(fs.readFileSync(yamlPath, 'utf-8')) as Record<string, unknown>;
    expect(raw.description).toBe('New research librarian');
    expect(raw.model).toBe('claude-haiku-4-5');
    expect(raw.name).toBe('Raka');

    const config = loadAgentConfig('raka');
    expect(config.description).toBe('New research librarian');
  });

  it('trims whitespace before saving', async () => {
    writeAgentYaml('raka', {
      name: 'Raka',
      description: 'old',
      telegram_bot_token_env: 'TEST_BOT_TOKEN',
    });

    const { setAgentDescription, loadAgentConfig } = await import('./agent-config.js');
    setAgentDescription('raka', '  padded value  ');

    expect(loadAgentConfig('raka').description).toBe('padded value');
  });

  it('rejects empty description', async () => {
    writeAgentYaml('raka', {
      name: 'Raka',
      description: 'keep me',
      telegram_bot_token_env: 'TEST_BOT_TOKEN',
    });

    const { setAgentDescription, loadAgentConfig } = await import('./agent-config.js');
    expect(() => setAgentDescription('raka', '   ')).toThrow(/empty/);
    expect(loadAgentConfig('raka').description).toBe('keep me');
  });

  it('throws when agent does not exist', async () => {
    const { setAgentDescription } = await import('./agent-config.js');
    expect(() => setAgentDescription('ghost', 'hi')).toThrow(/not found/);
  });
});

describe('main description', () => {
  it('returns default when no config file exists', async () => {
    const { getMainDescription, DEFAULT_MAIN_DESCRIPTION } = await import('./agent-config.js');
    expect(getMainDescription()).toBe(DEFAULT_MAIN_DESCRIPTION);
  });

  it('persists and reads back the description', async () => {
    const { setMainDescription, getMainDescription } = await import('./agent-config.js');
    setMainDescription('My personal assistant');
    expect(getMainDescription()).toBe('My personal assistant');
  });

  it('trims whitespace on save', async () => {
    const { setMainDescription, getMainDescription } = await import('./agent-config.js');
    setMainDescription('  trimmed  ');
    expect(getMainDescription()).toBe('trimmed');
  });

  it('rejects empty description', async () => {
    const { setMainDescription } = await import('./agent-config.js');
    expect(() => setMainDescription('   ')).toThrow(/empty/);
  });

  it('falls back to default when file is corrupt', async () => {
    fs.writeFileSync(path.join(storeDir, 'main-config.json'), 'not valid json', 'utf-8');
    const { getMainDescription, DEFAULT_MAIN_DESCRIPTION } = await import('./agent-config.js');
    expect(getMainDescription()).toBe(DEFAULT_MAIN_DESCRIPTION);
  });

  it('preserves other keys in main-config.json', async () => {
    const configPath = path.join(storeDir, 'main-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ other: 'value' }), 'utf-8');

    const { setMainDescription } = await import('./agent-config.js');
    setMainDescription('hello');

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(raw.description).toBe('hello');
    expect(raw.other).toBe('value');
  });
});
