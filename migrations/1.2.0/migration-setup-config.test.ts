import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { runMigration, type MigrationDeps } from './setup-config-folder.js';

describe('setup-config-folder migration', () => {
  let tmpDir: string;
  let projectRoot: string;
  let configDir: string;
  let workspaceDir: string;

  function makeDeps(overrides: Partial<MigrationDeps> = {}): MigrationDeps {
    return {
      prompt: async (_q, _d) => configDir,
      confirm: async (_q, _defaultYes) => false,
      projectRoot,
      ...overrides,
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-migration-test-'));
    projectRoot = path.join(tmpDir, 'project');
    configDir = path.join(tmpDir, 'config');
    workspaceDir = path.join(configDir, 'workspace');
    fs.mkdirSync(projectRoot, { recursive: true });

    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects ~/.claude as config folder', async () => {
    const reservedDir = path.join(os.homedir(), '.claude');
    let callCount = 0;

    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), 'test');

    await runMigration(makeDeps({
      prompt: async () => {
        callCount++;
        // First call returns reserved dir, second returns valid dir
        return callCount === 1 ? reservedDir : configDir;
      },
    }));

    const logCalls = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(logCalls).toContain('reserved by Claude Code');
    expect(callCount).toBe(2);
  });

  it('copies CLAUDE.md to workspace and removes original', async () => {
    const sourceContent = '# My personal CLAUDE.md';
    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), sourceContent);

    await runMigration(makeDeps());

    const destPath = path.join(workspaceDir, 'CLAUDE.md');
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.readFileSync(destPath, 'utf-8')).toBe(sourceContent);
    expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
  });

  it('skips copy when destination exists and user declines overwrite', async () => {
    const sourceContent = 'source content';
    const existingContent = 'existing content';

    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), sourceContent);
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, 'CLAUDE.md'), existingContent);

    await runMigration(makeDeps({
      confirm: async () => false,
    }));

    // Existing file should be unchanged
    expect(fs.readFileSync(path.join(workspaceDir, 'CLAUDE.md'), 'utf-8')).toBe(existingContent);
    // Source should still be removed
    expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
  });

  it('overwrites destination when user confirms', async () => {
    const sourceContent = 'new content';
    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), sourceContent);
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, 'CLAUDE.md'), 'old content');

    await runMigration(makeDeps({
      confirm: async () => true,
    }));

    expect(fs.readFileSync(path.join(workspaceDir, 'CLAUDE.md'), 'utf-8')).toBe(sourceContent);
    expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
  });

  it('appends CLAUDECLAW_CONFIG to .env when not present', async () => {
    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), 'content');
    fs.writeFileSync(path.join(projectRoot, '.env'), 'SOME_VAR=value');

    await runMigration(makeDeps());

    const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf-8');
    expect(envContent).toContain(`CLAUDECLAW_CONFIG=${configDir}`);
  });

  it('does not duplicate CLAUDECLAW_CONFIG in .env if already present', async () => {
    fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), 'content');
    fs.writeFileSync(
      path.join(projectRoot, '.env'),
      'CLAUDECLAW_CONFIG=~/existing\n',
    );

    await runMigration(makeDeps());

    const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf-8');
    const matches = envContent.match(/CLAUDECLAW_CONFIG=/g);
    expect(matches).toHaveLength(1);
  });

  it('exits when no source CLAUDE.md and no destination exists', async () => {
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    // No CLAUDE.md in projectRoot, no destination either
    await expect(runMigration(makeDeps())).rejects.toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('returns gracefully when source missing but destination already exists', async () => {
    // No source, but destination exists
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, 'CLAUDE.md'), 'already there');

    await runMigration(makeDeps());

    expect(process.exit).not.toHaveBeenCalled();
  });
});
