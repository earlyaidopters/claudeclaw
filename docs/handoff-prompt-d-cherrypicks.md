# Claude Code Handoff — Prompt D: Cherry-pick features from claudeclaw-os + fix loadMcpServers

Run this after Prompts A/B/C finish. Bundles 4 surgical ports/fixes into one atomic commit. **Use Sonnet.**

---

```
# Task: Cherry-pick 4 features from earlyaidopters/claudeclaw-os + fix 2 MCP loader bugs

## Model
Use Sonnet. Touches production code (memory, agent loader, new modules), needs judgment.

## Context
ClaudeClaw at `/Users/aditya_office_ai_assistant/claudeclaw`. Upstream fork `earlyaidopters/claudeclaw-os` (cloned at `/tmp/claudeclaw-os`) has 4 features we want, plus two bugs in our current `loadMcpServers()` that silently drop HTTP MCPs and break env-var substitution.

## Part 1 — Fix loadMcpServers (src/agent.ts)

Current behavior drops:
- HTTP/SSE MCPs like `context7` (uses `url:` not `command:`)
- MCPs whose env values use `${VAR}` (passes literal string to subprocess)

### Changes in `src/agent.ts`

1. **Extend `McpStdioConfig` type** to a union:
   ```ts
   type McpConfig =
     | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
     | { type: 'http'; url: string; headers?: Record<string, string> };
   ```
   Export update the function signature accordingly.

2. **In `loadMcpServers(allowlist?: string[])`:**
   - When parsing a server from settings: if `cfg.url` is a string, emit `{ type: 'http', url: cfg.url, headers: cfg.headers ?? {} }` — do NOT require `command`.
   - Keep the existing stdio branch for `cfg.command`.
   - Before emitting, **expand `${VAR}` in all string values** (env and headers) using `process.env[VAR]`. Leave literal if the var is undefined (log a warning once per run).

3. **Confirm** it still filters by allowlist (the check is unchanged).

### Verification

```bash
# After build, check logs on first agent turn:
tail -f logs/research.log | grep -A8 "mcpServers:"
# Should now include context7 alongside the existing 6

sqlite3 store/claudeclaw.db ".tables" | grep memories  # smoke check
```

Also confirm `context7` is in `~/.claude/settings.json` as `{ "url": "https://mcp.context7.com/mcp", ... }`. If `CONTEXT7_API_KEY` is referenced via `${CONTEXT7_API_KEY}` in headers, make sure the user's .env has that key (if not, note it in your report).

---

## Part 2 — Port `exfiltration-guard.ts` (new file)

Copy **`/tmp/claudeclaw-os/src/exfiltration-guard.ts`** → `/Users/aditya_office_ai_assistant/claudeclaw/src/exfiltration-guard.ts` verbatim (no changes). It's pure regex; zero deps.

Also copy its test: `/tmp/claudeclaw-os/src/exfiltration-guard.test.ts` → `src/exfiltration-guard.test.ts`.

Wire it into `src/bot.ts`:
- Import `scanForSecrets` and `redactSecrets`
- BEFORE sending any bot reply (look for `ctx.reply(part, ...)` around lines 620-635), run `scanForSecrets(text, protectedEnvValues)` where `protectedEnvValues` is a list of all env values longer than 8 chars (tokens, keys, etc.)
- If matches found: call `redactSecrets(text, matches)` and log a warning. Send redacted version.

Build + test. `npm run test -- exfiltration-guard` should pass the ported tests.

---

## Part 3 — Port `message-classifier.ts` (new file)

Copy **`/tmp/claudeclaw-os/src/message-classifier.ts`** → `src/message-classifier.ts` verbatim.
Copy test: `src/message-classifier.test.ts` too.

Wire into `src/bot.ts`:
- Import `classifyMessageComplexity`
- Just BEFORE the `runAgent` call in the message handler (around line 537 in current bot.ts), call `classifyMessageComplexity(message)`.
- If the result is `'simple'`, pass `model: 'claude-haiku-4-5'` (or `'haiku'` depending on SDK naming) to `runAgent`, overriding `agentDefaultModel`.
- If `'complex'`, use existing behavior.
- Log the classification at info level.

Rationale: answers "ok", "thanks", "yes" etc. get Haiku instead of the agent's full Sonnet/Opus. Saves tokens per acknowledgment.

---

## Part 4 — Port memory nudge (small, touches db.ts + memory.ts)

Port from `/tmp/claudeclaw-os/src/memory.ts` and related DB helpers:

1. Add to `src/db.ts`:
   - `getLastMemorySaveTime(chatId: string, agentId?: string): number | null` — returns unix seconds of the most recent `memories.created_at` for this chat+agent, or null
   - `getTurnCountSinceTimestamp(chatId: string, agentId: string, sinceUnixSec: number): number` — counts `conversation_log` rows (role='user') since that timestamp

2. Add to `src/config.ts`:
   - `MEMORY_NUDGE_INTERVAL_TURNS` — default 20, overridable via env
   - `MEMORY_NUDGE_INTERVAL_HOURS` — default 6, overridable via env

3. In `src/memory.ts` `buildMemoryContext`:
   - After the existing layers, check if `getTurnCountSinceTimestamp >= MEMORY_NUDGE_INTERVAL_TURNS` OR `getLastMemorySaveTime` was more than `MEMORY_NUDGE_INTERVAL_HOURS * 3600` seconds ago
   - If yes, append a small block to `parts`: `"[Memory nudge] It's been N turns since your last memory was saved. If this conversation has durable facts worth remembering, consider noting them explicitly."`
   - Do NOT nudge more than once per X minutes (debounce — store state in module-level Map keyed by chatId+agentId)

Refer to `/tmp/claudeclaw-os/src/memory.ts` for the exact implementation if it exists there already.

---

## Constraints

- Do NOT modify the existing v1.2.0 migration or break running agents
- `npm run typecheck` and `npm run build` must pass before commit
- Run `npm run test` — all existing tests should still pass, plus the 2 new test files
- Do NOT commit with broken tests

## Validation

```bash
cd /Users/aditya_office_ai_assistant/claudeclaw
npm run typecheck
npm run build
npm run test

# Restart one spoke agent to verify MCPs load correctly
pkill -f "node dist/index.js --agent trader"
sleep 2
(nohup node dist/index.js --agent trader > logs/trader.log 2>&1 &)
sleep 5
grep -A10 "mcpServers:" logs/trader.log | tail -12
# Should show: supabase, discord, apify, n8n (if they spawn). Context7 only if user's .env has CONTEXT7_API_KEY.
```

## Commit

Single atomic commit: `feat: cherry-pick exfiltration-guard + message-classifier + memory-nudge + fix loadMcpServers (HTTP + env expansion)`

With `Co-Authored-By: Oz <oz-agent@warp.dev>` as the last line.

## Report back

- Files changed (list)
- Tests pass count (before / after)
- Commit SHA
- Which MCPs now appear in agent logs that didn't before (context7? n8n?)
- Any surprises (missing env vars, spawn failures)
```

---

## Summary for the human driver

- **Model:** Sonnet
- **Expected duration:** 45-90 min
- **Risk:** low — all changes are additive except `loadMcpServers` which is a focused bug fix
- **When done, reply here** with commit SHA + any spawn failures so I can troubleshoot the remaining MCPs (discord/apify/etc.)
