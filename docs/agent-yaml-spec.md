# agent.yaml Specification v2.0

Complete reference for the agent configuration format, including the `execution` block.

## Schema

```yaml
# --- Required ---
name: string                    # Display name

# --- Optional ---
description: string             # What this agent does. Default: ""

type: named | worker            # "named" = own Telegram bot + token
                                # "worker" = no bot, delegated via Mission Control
                                # Default: "named"

telegram_bot_token_env: string  # Env var holding the Telegram bot token
                                # Required when type = "named"
                                # Ignored when type = "worker"

model: string                   # Default LLM model
                                # Default: system default (currently claude-sonnet-4-6)

tags: string[]                  # Labels for coarse-grained agent matching
                                # Default: []

skills:                         # Structured skill declarations
  - name: string                # Skill identifier
    description: string         # What this skill does
    examples: string[]          # Example prompts (optional)
    verification: string        # Success criteria (optional)

obsidian:                       # Obsidian vault integration (optional)
  vault: string                 # Absolute path to vault
  folders: string[]             # Read/write folders
  read_only: string[]           # Read-only folders

# --- Execution Block (NEW) ---
execution:                      # Optional. Absent = prompt-inject (legacy)
  mode: agent-sdk | prompt-inject
                                # Required when execution block is present

  tools: string[]               # Allowed Claude Code tools
                                # Default: [Read, Glob, Grep, Write, Edit, Bash]

  mcpServers:                   # MCP server configs (object, not array)
    server-name:                # Key = server name
      command: string           # Required. Binary to spawn
      args: string[]            # CLI args. Default: []
      env:                      # Env vars. Supports ${VAR} interpolation
        KEY: "${ENV_VAR}"

  canSpawnSubAgents: boolean    # Add Agent tool to tools list. Default: false

  maxTurns: number              # Max agentic turns. Default: 25. Min: 1

  timeout: number               # Hard timeout in ms. Default: 900000. Min: 60000
```

## Validation Rules

| Rule | Behavior |
|------|----------|
| `name` missing or empty | throws |
| `type: named` without `telegram_bot_token_env` | throws |
| `type: named` with env var that resolves to empty | throws |
| `execution.mode` invalid or missing (when block present) | throws |
| `execution.tools` not a string array | throws |
| `execution.mcpServers` entry without `command` | throws |
| `execution.maxTurns` < 1 or NaN | clamped to 1 / default |
| `execution.timeout` < 60000 or NaN | clamped to 60000 / default |
| `obsidian.vault` path doesn't exist | console.warn (not error) |
| `canSpawnSubAgents: true` + Agent not in tools | Agent added automatically |

## File Structure

```
agents/<agent-id>/
  agent.yaml          # This config
  CLAUDE.md           # System prompt / personality
  mcp-config.json     # MCP server config (optional, for advanced setups)
```

Agent directories can live in either:
- `$CLAUDECLAW_CONFIG/agents/<id>/` (external, default `~/.claudeclaw/agents/`)
- `$PROJECT_ROOT/agents/<id>/` (repo, gitignored for personal configs)

External config takes priority when both exist.

## Examples

### Worker persona (no execution -- legacy prompt-inject)

```yaml
name: Content
description: YouTube scripts, LinkedIn posts, carousels
type: worker
model: claude-sonnet-4-6
tags: [content, writing, social-media]
```

### Worker agent (scoped execution)

```yaml
name: Ravage
description: Software engineering specialist
type: worker
model: claude-sonnet-4-6
tags: [coding, debugging, testing, git]

skills:
  - name: coding
    description: Write, debug, refactor, and test code

execution:
  mode: agent-sdk
  tools: [Read, Glob, Grep, Write, Edit, Bash]
  mcpServers: {}
  canSpawnSubAgents: true
  maxTurns: 30
  timeout: 900000
```

### Named agent with execution (research + MCP)

```yaml
name: Soundwave
description: Deep web research, competitive intel, trend analysis
type: named
telegram_bot_token_env: SOUNDWAVE_BOT_TOKEN
model: claude-sonnet-4-6
tags: [research, analysis, web-search]

skills:
  - name: research
    description: Deep research with web search and source analysis

execution:
  mode: agent-sdk
  tools: [Read, Glob, Grep, Bash, WebSearch, WebFetch]
  mcpServers:
    firecrawl:
      command: npx
      args: ["-y", "firecrawl-mcp"]
      env:
        FIRECRAWL_API_KEY: "${FIRECRAWL_API_KEY}"
  canSpawnSubAgents: false
  maxTurns: 30
  timeout: 900000
```

## Migration from CMD agent.config.json

| CMD field | agent.yaml field |
|-----------|-----------------|
| `name` | `name` |
| `skills` (string[]) | `tags` |
| `tier` | dropped |
| `tools` | `execution.tools` |
| `mcpServers` | `execution.mcpServers` (needs full config, not just names) |
| `canSpawnSubAgents` | `execution.canSpawnSubAgents` |
| `maxTurns` | `execution.maxTurns` |
| `timeout` | `execution.timeout` |

CMD's `AGENT.md` becomes `CLAUDE.md` -- content is directly portable.

## Terminology

| Term | Definition |
|------|-----------|
| **Persona** | Agent without `execution` block. Prompt-inject only. |
| **Agent** | Agent with `execution` block. Scoped SDK execution. |
| **Worker** | No Telegram bot. Invoked via delegation only. |
| **Named** | Has Telegram bot + token. Can receive messages directly. |
