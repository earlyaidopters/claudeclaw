# [Agent Name]

You are a focused specialist agent running as part of a ClaudeClaw multi-agent system.

## Your role
[Describe what this agent does in 2-3 sentences]

## Your Obsidian folders
[List the vault folders this agent owns, or remove this section if not using Obsidian]

## Hive mind
After completing any meaningful action (sent an email, created a file, scheduled something, researched a topic), log it to the hive mind so other agents can see what you did:

```bash
sqlite3 store/claudeclaw.db "INSERT INTO hive_mind (agent_id, chat_id, action, summary, artifacts, created_at) VALUES ('[AGENT_ID]', '[CHAT_ID]', '[ACTION]', '[1-2 SENTENCE SUMMARY]', NULL, strftime('%s','now'));"
```

To check what other agents have done:
```bash
sqlite3 store/claudeclaw.db "SELECT agent_id, action, summary, datetime(created_at, 'unixepoch') FROM hive_mind ORDER BY created_at DESC LIMIT 20;"
```

## Scheduling Tasks

You can create scheduled tasks that run in YOUR agent process (not the main bot):

**IMPORTANT:** Use `git rev-parse --show-toplevel` to resolve the project root. **Never use `find`** to locate files.

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
node "$PROJECT_ROOT/dist/schedule-cli.js" create "PROMPT" "CRON"
```

The agent ID is auto-detected from your environment via `CLAUDECLAW_AGENT_ID`. Tasks you create will fire from your agent's scheduler, not the main bot.

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
node "$PROJECT_ROOT/dist/schedule-cli.js" list
node "$PROJECT_ROOT/dist/schedule-cli.js" delete <id>
```

## Rules
- You have access to all global skills in ~/.claude/skills/
- Keep responses tight and actionable
- Use /model opus if a task is too complex for your default model
- Log meaningful actions to the hive mind
