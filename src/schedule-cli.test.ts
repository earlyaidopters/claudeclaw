import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { _initTestDatabase, getAllScheduledTasks } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '..', 'dist', 'schedule-cli.js');
const PROJECT_DIR = path.resolve(__dirname, '..');

/** 32-byte key as hex; the compiled CLI loads db.ts which requires this. */
const TEST_DB_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// Isolate from the live DB so test fixtures don't end up in production cron
// and get claimed by live agent processes.
let TMP_STORE_DIR = '';
beforeAll(() => {
  TMP_STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeclaw-schedule-test-'));
});
afterAll(() => {
  if (TMP_STORE_DIR && fs.existsSync(TMP_STORE_DIR)) {
    fs.rmSync(TMP_STORE_DIR, { recursive: true, force: true });
  }
});

function cliEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DB_ENCRYPTION_KEY: TEST_DB_ENCRYPTION_KEY,
    CLAUDECLAW_STORE_DIR: TMP_STORE_DIR,
    ...overrides,
  };
}

describe('schedule-cli agent routing', () => {
  // These tests run the actual CLI as a child process to verify env var behavior

  it('auto-detects agent from CLAUDECLAW_AGENT_ID env var', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test auto-detect" "0 9 * * *"`,
      cliEnv({ CLAUDECLAW_AGENT_ID: 'comms' }),
    );

    expect(result).toContain('Agent:        comms');
  });

  it('--agent flag overrides CLAUDECLAW_AGENT_ID env var', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test override" "0 9 * * *" --agent ops`,
      cliEnv({ CLAUDECLAW_AGENT_ID: 'comms' }),
    );

    expect(result).toContain('Agent:        ops');
  });

  it('defaults to main when no env var and no --agent flag', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test default" "0 9 * * *"`,
      cliEnv({ CLAUDECLAW_AGENT_ID: undefined }),
    );

    expect(result).toContain('Agent:        main');
  });

  // Track task IDs created during tests for targeted cleanup
  const createdTaskIds: string[] = [];

  // Monkey-patch: extract task ID from CLI output
  function createAndTrack(cmd: string, env: NodeJS.ProcessEnv): string {
    const result = execSync(cmd, { cwd: PROJECT_DIR, env, encoding: 'utf-8' });
    const match = result.match(/Task created:\s+([a-f0-9]+)/);
    if (match) createdTaskIds.push(match[1]);
    return result;
  }

  afterEach(() => {
    // Only delete tasks we created, not pre-existing ones
    for (const id of createdTaskIds) {
      try {
        execSync(`node "${CLI_PATH}" delete ${id}`, {
          cwd: PROJECT_DIR,
          env: cliEnv({}),
        });
      } catch {
        // ignore if already gone
      }
    }
    createdTaskIds.length = 0;
  });
});
