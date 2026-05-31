/**
 * agent-voice-bridge.ts
 *
 * CLI entry point called by warroom/agent_bridge.py via subprocess.
 * Spawns Claude Code for a given agent, returns JSON result on stdout.
 *
 * Usage:
 *   node dist/agent-voice-bridge.js <agent_id> <prompt> [--quick] [--chat-id <id>]
 *
 * Output (stdout):
 *   { "text": "...", "agentId": "main" }
 *
 * Exit codes:
 *   0 = success
 *   1 = error (details on stderr)
 */

import fs from 'fs';
import path from 'path';

// ── PATH fix: ensure this node binary's directory is on PATH ──────────────────
// The Claude Agent SDK resolves 'node' by name — if node isn't on PATH the
// spawn fails with ENOENT. This is common when the server runs via launchd
// with a minimal environment. Using process.execPath we guarantee the right
// directory is always present regardless of what PATH looks like.
{
  const nodeBinDir = path.dirname(process.execPath);
  const currentPath = process.env.PATH || '';
  if (!currentPath.split(':').includes(nodeBinDir)) {
    process.env.PATH = nodeBinDir + ':' + currentPath;
  }
  // Also add common fallback locations
  for (const extra of ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin']) {
    if (!process.env.PATH!.split(':').includes(extra)) {
      process.env.PATH = process.env.PATH + ':' + extra;
    }
  }
}

import { AGENT_TIMEOUT_MS, PROJECT_ROOT, setAgentOverrides, activeBotToken } from './config.js';
import { initDatabase, getSession, setSession } from './db.js';
import { resolveAgentDir, resolveAgentClaudeMd } from './agent-config.js';
import { runAgent } from './agent.js';

// ── Debug: log PATH and execPath so we can diagnose spawn failures ────────────
process.stderr.write(`[bridge-debug] execPath=${process.execPath} PATH=${process.env.PATH?.split(':').slice(0, 6).join(':')}\n`);

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 2) {
  process.stderr.write('Usage: node dist/agent-voice-bridge.js <agent_id> <prompt> [--quick] [--chat-id <id>]\n');
  process.exit(1);
}

const agentId = args[0];
const prompt = args[1];
const isQuick = args.includes('--quick');
const chatIdIndex = args.indexOf('--chat-id');
const chatId = chatIdIndex !== -1 ? args[chatIdIndex + 1] : `warroom-${agentId}`;

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  // Init DB (needed for session resumption)
  try {
    initDatabase();
  } catch (err) {
    // Non-fatal — continue without session persistence if DB is unavailable
    process.stderr.write(`DB init warning: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // Resolve agent working directory and CLAUDE.md
  let cwd = PROJECT_ROOT;
  let systemPrompt: string | undefined;

  try {
    cwd = resolveAgentDir(agentId);
    // CRITICAL: spawn() throws ENOENT if cwd doesn't exist, which the SDK
    // misreports as "Claude Code native binary not found". Always fall back
    // to PROJECT_ROOT if the agent directory hasn't been created yet.
    if (!fs.existsSync(cwd)) {
      cwd = PROJECT_ROOT;
    }
    const claudeMdPath = resolveAgentClaudeMd(agentId);
    if (claudeMdPath && fs.existsSync(claudeMdPath)) {
      systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8');
    }
  } catch {
    // Fall back to project root for unknown agents
    cwd = PROJECT_ROOT;
  }

  // Apply agent overrides so runAgent picks up cwd + systemPrompt from config globals
  setAgentOverrides({
    agentId,
    botToken: activeBotToken,
    cwd,
    systemPrompt,
  });

  // Retrieve persisted session ID (enables conversation continuity across voice turns)
  let sessionId: string | undefined;
  try {
    sessionId = getSession(chatId, agentId);
  } catch {
    // No session — will start fresh
  }

  // Run the agent
  const abortController = new AbortController();
  if (AGENT_TIMEOUT_MS) {
    setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS);
  }
  const result = await runAgent(
    prompt,
    sessionId,
    () => {},
    undefined,
    undefined,
    abortController,
    undefined,
    undefined,
  );

  // Persist new session ID
  if (result.newSessionId) {
    try {
      setSession(chatId, result.newSessionId, agentId);
    } catch {
      // Non-fatal
    }
  }

  // Write JSON result to stdout for Python to parse
  const output = {
    text: result.text ?? '',
    agentId,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  };

  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`agent-voice-bridge error: ${message}\n`);
  // Write a fallback JSON so Python doesn't get a parse error
  process.stdout.write(JSON.stringify({ text: 'Agent encountered an error.', agentId }) + '\n');
  process.exit(1);
});
