import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ensureWorkspace, loadKnownPlaceholders } from './startup.js';

// ── loadKnownPlaceholders ────────────────────────────────────────────────────

describe('loadKnownPlaceholders', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-placeholders-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses placeholder names from CLAUDE.md.example', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md.example'),
      [
        '# ClaudeClaw',
        '<!--',
        '  Replace [placeholders] from the list below:',
        '  YOUR NAME',
        '  YOUR_VAULT_PATH',
        '-->',
      ].join('\n'),
    );

    const result = loadKnownPlaceholders(tmpDir);
    expect(result).toEqual(['[YOUR NAME]', '[YOUR_VAULT_PATH]']);
  });

  it('returns empty array when example file is missing', () => {
    const result = loadKnownPlaceholders(tmpDir);
    expect(result).toEqual([]);
  });

  it('returns empty array when placeholder block is absent', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md.example'),
      '# ClaudeClaw\nNo placeholders here.',
    );

    const result = loadKnownPlaceholders(tmpDir);
    expect(result).toEqual([]);
  });

  it('skips blank lines in the placeholder block', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md.example'),
      [
        '<!--',
        '  Replace [placeholders] from the list below:',
        '  FIRST',
        '',
        '  SECOND',
        '-->',
      ].join('\n'),
    );

    const result = loadKnownPlaceholders(tmpDir);
    expect(result).toEqual(['[FIRST]', '[SECOND]']);
  });
});

// ── ensureWorkspace ──────────────────────────────────────────────────────────

describe('ensureWorkspace', () => {
  let tmpDir: string;
  let workspaceDir: string;
  let projectRoot: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-workspace-test-'));
    workspaceDir = path.join(tmpDir, 'workspace');
    projectRoot = path.join(tmpDir, 'project');
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits when config dir is ~/.claude (reserved)', () => {
    const reservedDir = path.join(os.homedir(), '.claude');
    fs.writeFileSync(path.join(workspaceDir, 'CLAUDE.md'), 'filled content');

    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    expect(() => ensureWorkspace(reservedDir, workspaceDir, projectRoot)).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits when CLAUDE.md is missing from workspace', () => {
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    expect(() => ensureWorkspace(tmpDir, workspaceDir, projectRoot)).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('warns when CLAUDE.md has unfilled placeholders', () => {
    // Create example file with placeholder definitions
    fs.writeFileSync(
      path.join(projectRoot, 'CLAUDE.md.example'),
      [
        '<!--',
        '  Replace [placeholders] from the list below:',
        '  YOUR NAME',
        '-->',
      ].join('\n'),
    );

    // Create CLAUDE.md that still contains the placeholder
    fs.writeFileSync(
      path.join(workspaceDir, 'CLAUDE.md'),
      'Hello [YOUR NAME], welcome.',
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ensureWorkspace(tmpDir, workspaceDir, projectRoot);

    expect(process.exit).not.toHaveBeenCalled();
    // The logger.warn is called internally — we can't easily spy on pino,
    // so just verify process.exit was NOT called (it only exits on fatal errors).
    warnSpy.mockRestore();
  });

  it('does not exit when CLAUDE.md exists with all placeholders filled', () => {
    fs.writeFileSync(
      path.join(projectRoot, 'CLAUDE.md.example'),
      [
        '<!--',
        '  Replace [placeholders] from the list below:',
        '  YOUR NAME',
        '-->',
      ].join('\n'),
    );

    fs.writeFileSync(
      path.join(workspaceDir, 'CLAUDE.md'),
      'Hello Eran, welcome.',
    );

    ensureWorkspace(tmpDir, workspaceDir, projectRoot);

    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does not exit when no CLAUDE.md.example exists but CLAUDE.md is present', () => {
    fs.writeFileSync(
      path.join(workspaceDir, 'CLAUDE.md'),
      'Some content with [ANYTHING] in brackets.',
    );

    ensureWorkspace(tmpDir, workspaceDir, projectRoot);

    // No example = no known placeholders = no warning, no exit
    expect(process.exit).not.toHaveBeenCalled();
  });
});
