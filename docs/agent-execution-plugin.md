# RFC: Agent Execution Plugin

**Status:** Draft
**Author:** Matthew Snow
**Date:** 2026-03-26

## Summary

This RFC proposes an optional `execution` block in `agent.yaml` that enables agents to run with scoped tools and constraints via the Claude Agent SDK. Today, ClaudeClaw agents are personality layers -- a CLAUDE.md system prompt injected into the host session. The execution plugin adds a declarative way to give agents real tool boundaries, MCP server isolation, turn limits, and timeouts.

## Motivation

ClaudeClaw agents currently operate in a single mode: the bot reads the agent's CLAUDE.md, prepends it to the user's message, and passes everything to `runAgent()`. Every agent shares the same tools and permissions as the host session.

This creates two problems:

1. **No capability boundaries.** A research agent can write files. A content agent can run shell commands. There is no way to scope an agent to only the tools it needs.

2. **No structured execution metadata.** Mission Control assigns subtasks to agents based on skill matching, but has no way to enforce how long an agent should run, what tools it can use, or whether it can spawn sub-agents.

## Design

### The `execution` block

A new optional top-level key in `agent.yaml`:

```yaml
name: Code Agent
description: Writes and reviews code
type: worker
model: claude-sonnet-4-6

execution:
  mode: agent-sdk        # or prompt-inject (legacy)
  tools:
    - Read
    - Glob
    - Grep
    - Write
    - Edit
    - Bash
  mcpServers: {}
  canSpawnSubAgents: true
  maxTurns: 30
  timeout: 900000          # 15 minutes
```

When `execution` is absent, the agent behaves exactly as it does today. When present with `mode: agent-sdk`, `delegateToAgent()` routes to the execution engine instead of the prompt-injection path.

### Execution modes

| Mode | Behavior |
|------|----------|
| `prompt-inject` | Current behavior. Agent's CLAUDE.md is prepended to the prompt. No tool scoping. |
| `agent-sdk` | Spawns a scoped Claude Code session via Agent SDK `query()` with explicit tool list, max turns, and isolated settings. |

### Architecture

```
User message
     |
     v
+-------------------+
|  Mission Control   |
|  (plan + assign)   |
+-------------------+
     |
     v
+-------------------+     execution: absent or prompt-inject?
|  delegateToAgent() |----------------------------------------+
+-------------------+                                         |
     |                                                        v
     | execution.mode = agent-sdk                   +------------------+
     v                                              | runAgent()       |
+------------------------+                          | (prompt-inject)  |
| executeWithEngine()    |                          | Full host tools  |
| - scoped tools         |                          +------------------+
| - isolated settings    |                                    |
| - max-turns cap        |                                    v
| - timeout enforcement  |                             Result back to
+------------------------+                             Mission Control
     |
     v
Result back to
Mission Control
     |
     v
+-------------------+
| Synthesize + send  |
| response to user   |
+-------------------+
```

### Plugin structure

```
src/plugins/agent-execution/
  index.ts           -- Re-exports public API
  types.ts           -- ExecutionConfig, ExecutorRequest, ExecutorResult
  config-parser.ts   -- Parses execution: block from agent.yaml
  executor.ts        -- Wraps Agent SDK query() with scoped options
```

### Integration points

Only 3 existing files are modified:

| File | Change |
|------|--------|
| `agent-config.ts` | Add `execution?: ExecutionConfig` to `AgentConfig`, call `parseExecutionConfig()` |
| `agent-card.ts` | Add `execution?: ExecutionConfig` to `AgentCard`, pass through |
| `mission-control.ts` | Conditional routing in `delegateToAgent()` and `executeSubtask()` |

### SDK usage

The executor calls `query()` with:

- `tools: string[]` -- scopes available tools to the agent's declared list
- `maxTurns` -- caps agentic turns
- `systemPrompt: { type: 'preset', preset: 'claude_code', append: <CLAUDE.md> }` -- preserves built-in tool instructions while injecting agent persona
- `settingSources: []` -- full isolation from user skills and settings
- `persistSession: false` -- ephemeral sessions for delegated tasks
- `permissionMode: 'bypassPermissions'` -- trusted personal bot context

### MCP server isolation

When `mcpServers` is declared, the executor resolves environment variables (`${VAR}` syntax) from `process.env` and passes server configs to the SDK. Agents only see their declared MCP servers, not the user's personal ones.

### Backward compatibility

- Agents without an `execution` block behave identically to today
- The `execution` field is optional at every level
- No existing files are moved or deleted
- Zero behavioral changes to existing code paths

### Security

- Tool allowlisting is enforced by the Agent SDK's `tools` option
- `canSpawnSubAgents` controls whether `Agent` appears in the tool list
- Timeout is enforced both by SDK `maxTurns` (soft) and `AbortController` (hard)
- No permission escalation possible -- agents cannot declare tools the host doesn't support

## Testing

- Unit tests for execution block parsing (`config-parser.test.ts`)
- Unit tests for tool list construction (`executor.test.ts`)
- Integration test: agent with `execution.mode: agent-sdk` runs a prompt and returns output
- Backward-compat test: agent without `execution` block works via prompt-inject

## Open questions

1. Should `prompt-inject` mode also respect `tools` if declared?
2. Working directory isolation -- should agents run in their own directory or project root?
3. Should `executeWithEngine()` support multi-turn session resumption?
