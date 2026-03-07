#!/usr/bin/env node
/**
 * ClaudeClaw Schedule CLI
 *
 * Used by your Claude assistant via the Bash tool to manage scheduled tasks.
 *
 * Usage:
 *   node dist/schedule-cli.js create "prompt text" "0 9 * * 1"
 *   node dist/schedule-cli.js list
 *   node dist/schedule-cli.js delete <id>
 *   node dist/schedule-cli.js pause <id>
 *   node dist/schedule-cli.js resume <id>
 */

import { randomBytes } from 'crypto';

import {
  initDatabase,
  createScheduledTask,
  getAllScheduledTasks,
  deleteScheduledTask,
  pauseScheduledTask,
  resumeScheduledTask,
} from './db.js';
import { computeNextRun } from './scheduler.js';

initDatabase();

// Parse --agent flag from anywhere in argv
const agentFlagIdx = process.argv.indexOf('--agent');
const cliAgentId = agentFlagIdx !== -1 ? process.argv[agentFlagIdx + 1] ?? 'main' : 'main';
// Remove --agent and its value from rest args
const cleanedArgv = process.argv.filter((_, i) => i !== agentFlagIdx && i !== agentFlagIdx + 1);
const [, , command, ...rest] = cleanedArgv;

function formatDate(unix: number | null): string {
  if (!unix) return 'never';
  return new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

switch (command) {
  case 'create': {
    const prompt = rest[0];
    const cron = rest[1];

    if (!prompt || !cron) {
      console.error('Usage: schedule-cli create "prompt" "cron expression"');
      console.error('Example: schedule-cli create "Summarise AI news" "0 9 * * 1"');
      process.exit(1);
    }

    let nextRun: number;
    try {
      nextRun = computeNextRun(cron);
    } catch {
      console.error(`Invalid cron expression: "${cron}"`);
      console.error('Examples: "0 9 * * 1" (Mon 9am)  "0 8 * * *" (daily 8am)  "0 */4 * * *" (every 4h)');
      process.exit(1);
    }

    const id = randomBytes(4).toString('hex');
    createScheduledTask(id, prompt, cron, nextRun, cliAgentId);

    console.log(`Task created: ${id}`);
    console.log(`Agent:        ${cliAgentId}`);
    console.log(`Prompt:       ${prompt}`);
    console.log(`Schedule:     ${cron}`);
    console.log(`Next run:     ${formatDate(nextRun)}`);
    break;
  }

  case 'list': {
    const tasks = getAllScheduledTasks(cliAgentId === 'main' ? undefined : cliAgentId);
    if (tasks.length === 0) {
      console.log('No scheduled tasks.');
      break;
    }
    console.log(`${tasks.length} scheduled task${tasks.length === 1 ? '' : 's'}:\n`);
    for (const t of tasks) {
      const status = t.status === 'paused' ? ' [PAUSED]' : '';
      console.log(`${t.id}${status}`);
      console.log(`  Prompt:   ${t.prompt}`);
      console.log(`  Schedule: ${t.schedule}`);
      console.log(`  Next run: ${formatDate(t.next_run)}`);
      console.log(`  Last run: ${formatDate(t.last_run)}`);
      console.log();
    }
    break;
  }

  case 'delete': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli delete <id>'); process.exit(1); }
    deleteScheduledTask(id);
    console.log(`Deleted task: ${id}`);
    break;
  }

  case 'pause': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli pause <id>'); process.exit(1); }
    pauseScheduledTask(id);
    console.log(`Paused task: ${id}`);
    break;
  }

  case 'resume': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli resume <id>'); process.exit(1); }
    resumeScheduledTask(id);
    console.log(`Resumed task: ${id}`);
    break;
  }

  default:
    console.error('Commands: create | list | delete | pause | resume');
    process.exit(1);
}
