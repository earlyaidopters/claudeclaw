/**
 * CliEngine — wraps the Claude Agent SDK `query()` (spawns the `claude` CLI
 * subprocess) behind the Engine interface.
 *
 * This is Phase 1 of the SDK Engine RFC: a pure extraction of the current
 * `runAgent()` event loop. Behavior must stay 100% identical with
 * `ENGINE=cli` (the default).
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

import { agentMcpAllowlist } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { loadMcpServers } from '../agent.js';
import {
  Engine,
  EngineEvent,
  EngineOptions,
  EngineProgressEvent,
  EngineUsageInfo,
} from './engine.js';

/** Map SDK tool names to human-readable labels (identical to legacy agent.ts). */
const TOOL_LABELS: Record<string, string> = {
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  Bash: 'Running command',
  Grep: 'Searching code',
  Glob: 'Finding files',
  WebSearch: 'Web search',
  WebFetch: 'Fetching page',
  Agent: 'Sub-agent',
  NotebookEdit: 'Editing notebook',
  AskUserQuestion: 'User question',
};

function toolLabel(toolName: string): string {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    return parts.length >= 3 ? `${parts[1]}: ${parts.slice(2).join(' ')}` : toolName;
  }
  return toolName;
}

/**
 * Minimal AsyncIterable that yields a single user message then closes.
 * The Claude Agent SDK expects this shape for its `prompt` parameter.
 */
async function* singleTurn(text: string): AsyncGenerator<{
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}> {
  yield {
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
    session_id: '',
  };
}

export class CliEngine implements Engine {
  async *invoke(
    message: string,
    options: EngineOptions,
  ): AsyncIterable<EngineEvent> {
    const secrets = readEnvFile(['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY']);
    const sdkEnv: Record<string, string | undefined> = { ...process.env };
    if (secrets.CLAUDE_CODE_OAUTH_TOKEN) {
      sdkEnv.CLAUDE_CODE_OAUTH_TOKEN = secrets.CLAUDE_CODE_OAUTH_TOKEN;
    }
    if (secrets.ANTHROPIC_API_KEY) {
      sdkEnv.ANTHROPIC_API_KEY = secrets.ANTHROPIC_API_KEY;
    }

    const mcpServers = loadMcpServers(agentMcpAllowlist);
    const mcpServerNames = Object.keys(mcpServers);

    logger.info(
      { sessionId: options.sessionId ?? 'new', messageLen: message.length },
      'CliEngine starting query',
    );

    let didCompact = false;
    let preCompactTokens: number | null = null;
    let lastCallCacheRead = 0;
    let lastCallInputTokens = 0;
    let streamedText = '';

    for await (const event of query({
      prompt: singleTurn(message),
      options: {
        cwd: options.cwd,
        resume: options.sessionId,
        settingSources: ['project', 'user'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        env: sdkEnv,
        includePartialMessages: !!options.streamText,
        ...(options.model ? { model: options.model } : {}),
        ...(options.abortController ? { abortController: options.abortController } : {}),
        ...(mcpServerNames.length > 0 ? { mcpServers } : {}),
      },
    })) {
      const ev = event as Record<string, unknown>;

      if (ev['type'] === 'system' && ev['subtype'] === 'init') {
        const sessionId = ev['session_id'] as string;
        logger.info({ newSessionId: sessionId }, 'Session initialized');
        yield { type: 'init', sessionId };
        continue;
      }

      if (ev['type'] === 'system' && ev['subtype'] === 'compact_boundary') {
        didCompact = true;
        const meta = ev['compact_metadata'] as
          | { trigger: string; pre_tokens: number }
          | undefined;
        preCompactTokens = meta?.pre_tokens ?? null;
        logger.warn(
          { trigger: meta?.trigger, preCompactTokens },
          'Context window compacted',
        );
        yield { type: 'compact', preCompactTokens };
        continue;
      }

      if (ev['type'] === 'assistant') {
        const msg = ev['message'] as Record<string, unknown> | undefined;
        const msgUsage = msg?.['usage'] as Record<string, number> | undefined;
        const callCacheRead = msgUsage?.['cache_read_input_tokens'] ?? 0;
        const callInputTokens = msgUsage?.['input_tokens'] ?? 0;
        if (callCacheRead > 0) lastCallCacheRead = callCacheRead;
        if (callInputTokens > 0) lastCallInputTokens = callInputTokens;

        if (options.emitProgress) {
          const content = msg?.['content'] as
            | Array<{ type: string; name?: string }>
            | undefined;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use' && block.name) {
                const progress: EngineProgressEvent = {
                  type: 'tool_active',
                  description: toolLabel(block.name),
                };
                yield { type: 'progress', event: progress };
              }
            }
          }
        }
        continue;
      }

      if (ev['type'] === 'system' && ev['subtype'] === 'task_started' && options.emitProgress) {
        const description = (ev['description'] as string) ?? 'Sub-agent started';
        yield { type: 'progress', event: { type: 'task_started', description } };
        continue;
      }
      if (ev['type'] === 'system' && ev['subtype'] === 'task_notification' && options.emitProgress) {
        const summary = (ev['summary'] as string) ?? 'Sub-agent finished';
        const status = (ev['status'] as string) ?? 'completed';
        const description = status === 'failed' ? `Failed: ${summary}` : summary;
        yield { type: 'progress', event: { type: 'task_completed', description } };
        continue;
      }

      if (
        ev['type'] === 'stream_event' &&
        options.streamText &&
        ev['parent_tool_use_id'] === null
      ) {
        const streamEvent = ev['event'] as Record<string, unknown> | undefined;
        if (streamEvent?.['type'] === 'message_start') {
          streamedText = '';
        }
        if (streamEvent?.['type'] === 'content_block_delta') {
          const delta = streamEvent['delta'] as Record<string, unknown> | undefined;
          if (delta?.['type'] === 'text_delta' && typeof delta['text'] === 'string') {
            streamedText += delta['text'];
            yield { type: 'stream_text', accumulatedText: streamedText };
          }
        }
        continue;
      }

      if (ev['type'] === 'result') {
        const text = (ev['result'] as string | null | undefined) ?? null;
        const evUsage = ev['usage'] as Record<string, number> | undefined;
        let usage: EngineUsageInfo;
        if (evUsage) {
          usage = {
            inputTokens: evUsage['input_tokens'] ?? 0,
            outputTokens: evUsage['output_tokens'] ?? 0,
            cacheReadInputTokens: evUsage['cache_read_input_tokens'] ?? 0,
            totalCostUsd: (ev['total_cost_usd'] as number) ?? 0,
            didCompact,
            preCompactTokens,
            lastCallCacheRead,
            lastCallInputTokens,
          };
          logger.info(
            {
              inputTokens: usage.inputTokens,
              cacheReadTokens: usage.cacheReadInputTokens,
              lastCallCacheRead: usage.lastCallCacheRead,
              lastCallInputTokens: usage.lastCallInputTokens,
              costUsd: usage.totalCostUsd,
              didCompact,
            },
            'Turn usage',
          );
        } else {
          usage = {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            totalCostUsd: 0,
            didCompact,
            preCompactTokens,
            lastCallCacheRead,
            lastCallInputTokens,
          };
        }

        logger.info(
          { hasResult: !!text, subtype: ev['subtype'] },
          'Agent result received',
        );
        yield { type: 'result', text, usage };
        return;
      }
    }
  }
}
