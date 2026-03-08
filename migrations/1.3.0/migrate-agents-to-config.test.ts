import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { runMigration, readClaudeclawConfig, type MigrationDeps } from './migrate-agents-to-config.js';

describe('migrate-agents-to-config', () => {
  let tmpDir: string;
  let projectRoot: string;
  let configDir: string;

  function makeDeps(overrides: Partial<MigrationDeps> = {}): MigrationDeps {
    return { projectRoot, ...overrides };
  }

  function writeAgentYaml(agentName: string, content: string): void {
    const dir = path.join(projectRoot, 'agents', agentName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agent.yaml'), content);
  }

  function writeAgentClaude(agentName: string, content: string): void {
    const dir = path.join(projectRoot, 'agents', agentName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), content);
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-agents-migration-'));
    projectRoot = path.join(tmpDir, 'project');
    configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.env'),
      `CLAUDECLAW_CONFIG=${configDir}\n`,
    );

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── readClaudeclawConfig ───────────────────────────────────────────────────

  describe('readClaudeclawConfig', () => {
    it('returns null when .env is missing', () => {
      fs.rmSync(path.join(projectRoot, '.env'));
      expect(readClaudeclawConfig(projectRoot)).toBeNull();
    });

    it('returns null when CLAUDECLAW_CONFIG is absent from .env', () => {
      fs.writeFileSync(path.join(projectRoot, '.env'), 'OTHER_VAR=foo\n');
      expect(readClaudeclawConfig(projectRoot)).toBeNull();
    });

    it('returns the expanded absolute path', () => {
      fs.writeFileSync(path.join(projectRoot, '.env'), `CLAUDECLAW_CONFIG=${configDir}\n`);
      expect(readClaudeclawConfig(projectRoot)).toBe(configDir);
    });

    it('expands ~ in the path', () => {
      fs.writeFileSync(path.join(projectRoot, '.env'), 'CLAUDECLAW_CONFIG=~/.claudeclaw\n');
      expect(readClaudeclawConfig(projectRoot)).toBe(path.join(os.homedir(), '.claudeclaw'));
    });
  });

  // ── runMigration ──────────────────────────────────────────────────────────

  it('logs and returns early when CLAUDECLAW_CONFIG not in .env', () => {
    fs.writeFileSync(path.join(projectRoot, '.env'), '');
    runMigration(makeDeps());
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('CLAUDECLAW_CONFIG not found');
  });

  it('logs and returns early when agents/ directory does not exist', () => {
    runMigration(makeDeps());
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('No agents/ directory');
  });

  it('logs and returns early when agents/ has no subdirectories', () => {
    fs.mkdirSync(path.join(projectRoot, 'agents'), { recursive: true });
    runMigration(makeDeps());
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('nothing to migrate');
  });

  it('skips directories starting with underscore', () => {
    writeAgentYaml('_template', 'name: template');
    runMigration(makeDeps());
    // agent.yaml must still exist in repo
    expect(fs.existsSync(path.join(projectRoot, 'agents', '_template', 'agent.yaml'))).toBe(true);
  });

  it('skips agent dir that has no agent.yaml', () => {
    const dir = path.join(projectRoot, 'agents', 'myagent');
    fs.mkdirSync(dir, { recursive: true });
    runMigration(makeDeps());
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('no agent.yaml, skipped');
  });

  it('deletes agent.yaml that contains the personal path marker', () => {
    writeAgentYaml('comms', 'vault: /Users/marwankashef/Obsidian\nname: Comms');
    runMigration(makeDeps());

    expect(fs.existsSync(path.join(projectRoot, 'agents', 'comms', 'agent.yaml'))).toBe(false);

    const destYaml = path.join(configDir, 'agents', 'comms', 'agent.yaml');
    expect(fs.existsSync(destYaml)).toBe(false);

    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('deleted');
    expect(output).toContain('personal path');
  });

  it('copies agent.yaml without personal path to config dir and removes from repo', () => {
    const yaml = 'name: Ops\ntelegram_bot_token_env: OPS_BOT_TOKEN\n';
    writeAgentYaml('ops', yaml);

    runMigration(makeDeps());

    const destYaml = path.join(configDir, 'agents', 'ops', 'agent.yaml');
    expect(fs.existsSync(destYaml)).toBe(true);
    expect(fs.readFileSync(destYaml, 'utf-8')).toBe(yaml);
    expect(fs.existsSync(path.join(projectRoot, 'agents', 'ops', 'agent.yaml'))).toBe(false);

    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('copied');
    expect(output).toContain('removed from repo');
  });

  it('also copies CLAUDE.md when present alongside agent.yaml', () => {
    writeAgentYaml('ops', 'name: Ops\ntelegram_bot_token_env: OPS_BOT_TOKEN\n');
    writeAgentClaude('ops', '# Ops agent');

    runMigration(makeDeps());

    expect(fs.readFileSync(path.join(configDir, 'agents', 'ops', 'CLAUDE.md'), 'utf-8')).toBe('# Ops agent');
    expect(fs.existsSync(path.join(projectRoot, 'agents', 'ops', 'CLAUDE.md'))).toBe(false);
  });

  it('skips copying CLAUDE.md when destination already exists', () => {
    writeAgentYaml('ops', 'name: Ops\ntelegram_bot_token_env: OPS_BOT_TOKEN\n');
    writeAgentClaude('ops', 'new content');

    const destDir = path.join(configDir, 'agents', 'ops');
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'CLAUDE.md'), 'existing content');

    runMigration(makeDeps());

    expect(fs.readFileSync(path.join(configDir, 'agents', 'ops', 'CLAUDE.md'), 'utf-8')).toBe('existing content');
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain('already exists');
  });

  it('handles multiple agents independently', () => {
    writeAgentYaml('comms', 'vault: /Users/marwankashef/Obsidian\nname: Comms');
    writeAgentYaml('ops', 'name: Ops\ntelegram_bot_token_env: OPS_BOT_TOKEN\n');

    runMigration(makeDeps());

    // comms: deleted (personal path)
    expect(fs.existsSync(path.join(projectRoot, 'agents', 'comms', 'agent.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(configDir, 'agents', 'comms', 'agent.yaml'))).toBe(false);

    // ops: copied to config
    expect(fs.existsSync(path.join(configDir, 'agents', 'ops', 'agent.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'agents', 'ops', 'agent.yaml'))).toBe(false);
  });
});
