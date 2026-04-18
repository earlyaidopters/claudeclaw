import fs from 'fs';
import path from 'path';

import { ENGINE, PROJECT_ROOT, agentCwd } from './config.js';
import { logger } from './logger.js';
import { CliEngine } from './engines/cli-engine.js';
import type {
  Engine,
  EngineEvent,
  EngineProgressEvent,
  EngineUsageInfo,
} from './engines/engine.js';

// ── MCP server loading ──────────────────────────────────────────────
// The Agent SDK's settingSources loads CLAUDE.md and permissions from
// project/user settings, but does NOT load mcpServers from those files.
// We read them ourselves and pass them via the `mcpServers` option.
// Cherry-picked from earlyaidopters/claudeclaw-os.

export interface McpStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Merge MCP server configs from user settings (~/.claude/settings.json) and
 * project settings (.claude/settings.json in cwd), optionally filtered by
 * an allowlist (e.g. from an agent's agent.yaml `mcp_servers` field).
 *
 * Project settings take priority over user settings on name collision.
 */
export function loadMcpServers(
  allowlist?: string[],
  projectCwd?: string,
): Record<string, McpStdioConfig> {
  const merged: Record<string, McpStdioConfig> = {};

  const projectSettings = path.join(
    projectCwd ?? agentCwd ?? PROJECT_ROOT,
    '.claude',
    'settings.json',
  );
  const userSettings = path.join(
    process.env.HOME ?? '/tmp',
    '.claude',
    'settings.json',
  );

  // User first, then project — project overrides on name collision
  for (const file of [userSettings, projectSettings]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const servers = raw?.mcpServers;
      if (servers && typeof servers === 'object') {
        for (const [name, config] of Object.entries(servers)) {
          const cfg = config as Record<string, unknown>;
          if (cfg.command && typeof cfg.command === 'string') {
            merged[name] = {
              command: cfg.command,
              ...(cfg.args ? { args: cfg.args as string[] } : {}),
              ...(cfg.env ? { env: cfg.env as Record<string, string> } : {}),
            };
          }
        }
      }
    } catch {
      // File doesn't exist or is invalid — skip
    }
  }

  // Filter by allowlist if provided (empty array = deny all)
  if (allowlist !== undefined) {
    const allowed = new Set(allowlist);
    for (const name of Object.keys(merged)) {
      if (!allowed.has(name)) delete merged[name];
    }
  }

  return merged;
}

// ── Public types (kept as aliases for backward compat) ────────────────
// Consumers (bot.ts, orchestrator.ts, cost-footer.ts, etc.) import these
// names. The shapes live in engines/engine.ts; these aliases preserve the
// existing import paths without forcing a codebase-wide rename.

export type UsageInfo = EngineUsageInfo;
export type AgentProgressEvent = EngineProgressEvent;

export interface AgentResult {
  text: string | null;
  newSessionId: string | undefined;
  usage: UsageInfo | null;
  aborted?: boolean;
}

/**
 * Select the engine implementation for a turn. Phase 1 only ships CliEngine;
 * Phase 2+ of the SDK Engine RFC will add SdkEngine behind ENGINE=sdk.
 */
function selectEngine(): Engine {
  if (ENGINE === 'sdk') {
    logger.warn('ENGINE=sdk requested but SdkEngine is not yet implemented (phase 2+); falling back to CliEngine');
  }
  return new CliEngine();
}

/**
 * Run a single user message through the agent and return the result.
 *
 * Internally delegates to an `Engine` implementation (CliEngine by default,
 * see `ENGINE` in config.ts). Previously contained the SDK event loop inline;
 * that loop now lives in CliEngine — behavior is unchanged for ENGINE=cli.
 *
 * Auth: CliEngine spawns the `claude` CLI subprocess which reads OAuth auth
 * from ~/.claude/ automatically (the same auth used in the terminal).
 * No explicit token needed if you're already logged in via `claude login`.
 * Optionally override with CLAUDE_CODE_OAUTH_TOKEN in .env.
 *
 * @param message    The user's text (may include transcribed voice prefix)
 * @param sessionId  Claude Code session ID to resume, or undefined for new session
 * @param onTyping   Called every TYPING_REFRESH_MS while waiting — sends typing action to Telegram
 * @param onProgress Called when sub-agents start/complete — sends status updates to Telegram
 */
export async function runAgent(
  message: string,
  sessionId: string | undefined,
  onTyping: () => void,
  onProgress?: (event: AgentProgressEvent) => void,
  model?: string,
  abortController?: AbortController,
  onStreamText?: (accumulatedText: string) => void,
): Promise<AgentResult> {
  let newSessionId: string | undefined;
  let resultText: string | null = null;
  let usage: UsageInfo | null = null;

  // Refresh typing indicator on an interval while Claude works.
  // Telegram's "typing..." action expires after ~5s.
  const typingInterval = setInterval(onTyping, 4000);

  const engine = selectEngine();

  try {
    logger.info(
      { sessionId: sessionId ?? 'new', messageLen: message.length, engine: ENGINE },
      'Starting agent query',
    );

    const events: AsyncIterable<EngineEvent> = engine.invoke(message, {
      cwd: agentCwd ?? PROJECT_ROOT,
      sessionId,
      model,
      abortController,
      streamText: !!onStreamText,
      emitProgress: !!onProgress,
    });

    for await (const ev of events) {
      switch (ev.type) {
        case 'init':
          newSessionId = ev.sessionId;
          break;
        case 'progress':
          onProgress?.(ev.event);
          break;
        case 'stream_text':
          onStreamText?.(ev.accumulatedText);
          break;
        case 'compact':
          // Handled inside the engine (logging + usage.didCompact flag).
          break;
        case 'result':
          resultText = ev.text;
          usage = ev.usage;
          break;
      }
    }
  } catch (err) {
    if (abortController?.signal.aborted) {
      logger.info('Agent query aborted by user');
      return { text: null, newSessionId, usage, aborted: true };
    }
    throw err;
  } finally {
    clearInterval(typingInterval);
  }

  return { text: resultText, newSessionId, usage };
}
