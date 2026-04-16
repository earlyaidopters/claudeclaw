import { exec } from 'child_process';

import { upsertSkillHealth } from './db.js';
import { logger } from './logger.js';

// ── Health check runner ─────────────────────────────────────────────

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export interface HealthCheckResult {
  status: string;
  error: string;
}

/**
 * Run a health check command for a single skill.
 * Returns { status: 'healthy', error: '' } on exit 0,
 * { status: 'unhealthy', error: stderr } on non-zero exit,
 * { status: 'timeout', error: 'Health check timed out' } on timeout.
 *
 * Stores the result in the skill_health table.
 */
export async function runSkillHealthCheck(
  skillId: string,
  command: string,
): Promise<HealthCheckResult> {
  try {
    const result = await execWithTimeout(command, HEALTH_CHECK_TIMEOUT_MS);
    const healthResult: HealthCheckResult = {
      status: 'healthy',
      error: '',
    };

    if (result.exitCode !== 0) {
      healthResult.status = 'unhealthy';
      healthResult.error = result.stderr.trim() || `Exited with code ${result.exitCode}`;
    }

    upsertSkillHealth(skillId, healthResult.status, healthResult.error);
    logger.debug({ skillId, status: healthResult.status }, 'Skill health check complete');
    return healthResult;
  } catch (err: unknown) {
    if (err instanceof TimeoutError) {
      const healthResult: HealthCheckResult = {
        status: 'timeout',
        error: 'Health check timed out',
      };
      upsertSkillHealth(skillId, healthResult.status, healthResult.error);
      logger.warn({ skillId }, 'Skill health check timed out');
      return healthResult;
    }

    // exec can throw for signal kills, permission errors, etc.
    const errorMsg = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string })?.stderr?.trim() || errorMsg;
    const healthResult: HealthCheckResult = {
      status: 'unhealthy',
      error: stderr,
    };
    upsertSkillHealth(skillId, healthResult.status, healthResult.error);
    logger.warn({ skillId, error: stderr }, 'Skill health check failed');
    return healthResult;
  }
}

/**
 * Run health checks for all skills that have a healthCheck command defined.
 * Results are stored in the DB via upsertSkillHealth.
 */
export async function runAllHealthChecks(
  skills: Array<{ id: string; healthCheck?: string }>,
): Promise<void> {
  const withChecks = skills.filter((s) => s.healthCheck);
  if (withChecks.length === 0) return;

  logger.info({ count: withChecks.length }, 'Running skill health checks');

  const results = await Promise.allSettled(
    withChecks.map((s) => runSkillHealthCheck(s.id, s.healthCheck!)),
  );

  let healthy = 0;
  let unhealthy = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.status === 'healthy') {
      healthy++;
    } else {
      unhealthy++;
    }
  }

  logger.info({ healthy, unhealthy }, 'Skill health checks complete');
}

// ── Internal helpers ────────────────────────────────────────────────

class TimeoutError extends Error {
  constructor() {
    super('Health check timed out');
    this.name = 'TimeoutError';
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function execWithTimeout(command: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // Settle-once guard. Without this, both exec's native timeout and
    // our belt-and-suspenders setTimeout could fire and call reject()
    // twice, surfacing as an UnhandledPromiseRejection warning in Node.
    let settled = false;
    const doResolve = (v: ExecResult) => { if (!settled) { settled = true; resolve(v); } };
    const doReject = (e: Error) => { if (!settled) { settled = true; reject(e); } };

    const child = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error && error.killed) {
        doReject(new TimeoutError());
        return;
      }

      doResolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error?.code ?? 0,
      });
    });

    // Belt-and-suspenders timeout in case Node's exec timeout doesn't fire
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }
      doReject(new TimeoutError());
    }, timeoutMs + 500);

    child.on('close', () => clearTimeout(timer));
  });
}
