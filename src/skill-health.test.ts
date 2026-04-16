import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db.ts before importing skill-health
vi.mock('./db.js', () => ({
  upsertSkillHealth: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child_process.exec
vi.mock('child_process', () => {
  const mockExec = vi.fn();
  return { exec: mockExec };
});

import { exec } from 'child_process';
import { upsertSkillHealth } from './db.js';
import { runSkillHealthCheck, runAllHealthChecks } from './skill-health.js';

const mockExec = vi.mocked(exec);
const mockUpsert = vi.mocked(upsertSkillHealth);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helper to simulate exec behavior ────────────────────────────────

function simulateExec(
  opts: { stdout?: string; stderr?: string; exitCode?: number; killed?: boolean; timeout?: boolean },
): void {
  mockExec.mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: { code?: number; killed?: boolean } | null, stdout: string, stderr: string) => void;
    const child = {
      kill: vi.fn(),
      on: vi.fn((_event: string, handler: () => void) => {
        if (!opts.timeout) {
          // Simulate process closing immediately
          setTimeout(handler, 0);
        }
      }),
    };

    if (opts.timeout) {
      // Simulate timeout: callback fires with killed=true after a delay
      setTimeout(() => {
        callback({ killed: true, code: undefined }, '', '');
      }, 10);
    } else if (opts.exitCode && opts.exitCode !== 0) {
      setTimeout(() => {
        callback({ code: opts.exitCode, killed: false }, opts.stdout || '', opts.stderr || '');
      }, 0);
    } else {
      setTimeout(() => {
        callback(null, opts.stdout || '', opts.stderr || '');
      }, 0);
    }

    return child as unknown as ReturnType<typeof exec>;
  });
}

// ── runSkillHealthCheck ─────────────────────────────────────────────

describe('runSkillHealthCheck', () => {
  it('returns healthy on exit code 0', async () => {
    simulateExec({ stdout: 'OK', exitCode: 0 });

    const result = await runSkillHealthCheck('gmail', 'echo OK');
    expect(result.status).toBe('healthy');
    expect(result.error).toBe('');
    expect(mockUpsert).toHaveBeenCalledWith('gmail', 'healthy', '');
  });

  it('returns unhealthy on non-zero exit code', async () => {
    simulateExec({ stderr: 'connection refused', exitCode: 1 });

    const result = await runSkillHealthCheck('slack', 'curl localhost');
    expect(result.status).toBe('unhealthy');
    expect(result.error).toBe('connection refused');
    expect(mockUpsert).toHaveBeenCalledWith('slack', 'unhealthy', 'connection refused');
  });

  it('uses exit code message when stderr is empty', async () => {
    simulateExec({ stderr: '', exitCode: 2 });

    const result = await runSkillHealthCheck('test-skill', 'false');
    expect(result.status).toBe('unhealthy');
    expect(result.error).toBe('Exited with code 2');
  });

  it('returns timeout when command times out', async () => {
    simulateExec({ timeout: true });

    const result = await runSkillHealthCheck('slow-skill', 'sleep 60');
    expect(result.status).toBe('timeout');
    expect(result.error).toBe('Health check timed out');
    expect(mockUpsert).toHaveBeenCalledWith('slow-skill', 'timeout', 'Health check timed out');
  });
});

// ── runAllHealthChecks ──────────────────────────────────────────────

describe('runAllHealthChecks', () => {
  it('runs health checks for all skills with healthCheck defined', async () => {
    simulateExec({ stdout: 'OK', exitCode: 0 });

    const skills = [
      { id: 'gmail', healthCheck: 'echo ok' },
      { id: 'calendar', healthCheck: 'echo ok' },
      { id: 'no-check' }, // No healthCheck, should be skipped
    ];

    await runAllHealthChecks(skills);
    // exec should have been called twice (gmail and calendar, not no-check)
    expect(mockExec).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no skills have health checks', async () => {
    await runAllHealthChecks([{ id: 'a' }, { id: 'b' }]);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('continues even if one check fails', async () => {
    let callCount = 0;
    mockExec.mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
      const callback = cb as (err: { code?: number; killed?: boolean } | null, stdout: string, stderr: string) => void;
      callCount++;
      const child = {
        kill: vi.fn(),
        on: vi.fn((_event: string, handler: () => void) => setTimeout(handler, 0)),
      };

      if (callCount === 1) {
        setTimeout(() => callback({ code: 1, killed: false }, '', 'fail'), 0);
      } else {
        setTimeout(() => callback(null, 'OK', ''), 0);
      }

      return child as unknown as ReturnType<typeof exec>;
    });

    const skills = [
      { id: 'broken', healthCheck: 'bad-command' },
      { id: 'working', healthCheck: 'echo ok' },
    ];

    // Should not throw
    await expect(runAllHealthChecks(skills)).resolves.toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
