import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { checkPendingMigrations, compareSemver } from './migrations.js';

// ── compareSemver ────────────────────────────────────────────────────────────

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('v1.0.0', 'v1.0.0')).toBe(0);
  });

  it('patch increment: older < newer', () => {
    expect(compareSemver('v1.0.0', 'v1.0.1')).toBeLessThan(0);
    expect(compareSemver('v1.0.1', 'v1.0.0')).toBeGreaterThan(0);
  });

  it('minor increment dominates patch', () => {
    expect(compareSemver('v1.0.9', 'v1.1.0')).toBeLessThan(0);
  });

  it('major increment dominates minor and patch', () => {
    expect(compareSemver('v1.9.9', 'v2.0.0')).toBeLessThan(0);
  });

  it('sorts a mixed array into ascending order', () => {
    const versions = ['v1.1.0', 'v1.0.0', 'v2.0.0', 'v1.0.1'];
    expect([...versions].sort(compareSemver)).toEqual([
      'v1.0.0',
      'v1.0.1',
      'v1.1.0',
      'v2.0.0',
    ]);
  });

  it('works without v prefix', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('throws on invalid version string', () => {
    expect(() => compareSemver('notaversion', 'v1.0.0')).toThrow('Invalid semver');
    expect(() => compareSemver('v1.0.0', 'notaversion')).toThrow('Invalid semver');
  });
});

// ── checkPendingMigrations ───────────────────────────────────────────────────

describe('checkPendingMigrations', () => {
  let tmpDir: string;

  function writeVersionJson(versions: Record<string, string[]>): void {
    const migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(
      path.join(migrationsDir, 'version.json'),
      JSON.stringify({ migrations: versions }, null, 2),
    );
  }

  function writeAppliedJson(lastApplied: string | null): void {
    const migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(
      path.join(migrationsDir, '.applied.json'),
      JSON.stringify({ lastApplied }, null, 2),
    );
  }

  function createStoreDir(): void {
    fs.mkdirSync(path.join(tmpDir, 'store'), { recursive: true });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-migrations-test-'));
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── fresh clone (no .applied.json, no store/) ───────────────────────────────

  describe('fresh clone', () => {
    it('does not call process.exit', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });

      checkPendingMigrations(tmpDir);

      expect(process.exit).not.toHaveBeenCalled();
    });

    it('writes .applied.json initialised to the latest version', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });

      checkPendingMigrations(tmpDir);

      const appliedFile = path.join(tmpDir, 'migrations', '.applied.json');
      expect(fs.existsSync(appliedFile)).toBe(true);
      const state = JSON.parse(fs.readFileSync(appliedFile, 'utf-8'));
      expect(state.lastApplied).toBe('v1.0.0');
    });

    it('picks the highest version when multiple versions exist', () => {
      writeVersionJson({
        'v1.0.0': ['initial-migration'],
        'v1.1.0': ['add-sessions-table'],
        'v1.0.1': ['fix-index'],
      });

      checkPendingMigrations(tmpDir);

      const state = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'migrations', '.applied.json'), 'utf-8'),
      );
      expect(state.lastApplied).toBe('v1.1.0');
    });

    it('second run does not call process.exit (.applied.json now present)', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });
      checkPendingMigrations(tmpDir); // first run — writes .applied.json
      createStoreDir();               // store/ appears after first real startup

      checkPendingMigrations(tmpDir); // second run

      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  // ── up to date ────────────────────────────────────────────────────────────

  describe('up to date', () => {
    it('does not call process.exit when applied matches latest', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });
      writeAppliedJson('v1.0.0');

      checkPendingMigrations(tmpDir);

      expect(process.exit).not.toHaveBeenCalled();
    });

    it('does not call process.exit when applied matches latest across multiple versions', () => {
      writeVersionJson({
        'v1.0.0': ['initial-migration'],
        'v1.1.0': ['add-sessions-table'],
      });
      writeAppliedJson('v1.1.0');

      checkPendingMigrations(tmpDir);

      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  // ── pending migrations ────────────────────────────────────────────────────

  describe('pending migrations', () => {
    it('calls process.exit(1) when applied is behind latest', () => {
      writeVersionJson({
        'v1.0.0': ['initial-migration'],
        'v1.1.0': ['add-sessions-table'],
      });
      writeAppliedJson('v1.0.0');

      checkPendingMigrations(tmpDir);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('includes applied and latest versions in the error message', () => {
      writeVersionJson({
        'v1.0.0': ['initial-migration'],
        'v1.1.0': ['add-sessions-table'],
      });
      writeAppliedJson('v1.0.0');

      checkPendingMigrations(tmpDir);

      const msg = vi.mocked(console.error).mock.calls[0]?.[0] as string;
      expect(msg).toContain('v1.0.0');
      expect(msg).toContain('v1.1.0');
    });
  });

  // ── pre-migration install (no .applied.json but store/ exists) ─────────────

  describe('pre-migration install', () => {
    it('calls process.exit(1) when store/ exists but .applied.json does not', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });
      createStoreDir();

      checkPendingMigrations(tmpDir);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('error message shows applied as none', () => {
      writeVersionJson({ 'v1.0.0': ['initial-migration'] });
      createStoreDir();

      checkPendingMigrations(tmpDir);

      const msg = vi.mocked(console.error).mock.calls[0]?.[0] as string;
      expect(msg).toContain('none');
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('missing version.json does not throw or call process.exit', () => {
      expect(() => checkPendingMigrations(tmpDir)).not.toThrow();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('empty migrations registry does not call process.exit', () => {
      writeVersionJson({});

      checkPendingMigrations(tmpDir);

      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});
