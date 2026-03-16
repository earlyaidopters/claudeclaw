# ClaudeClaw: Delegation Framework Gap Analysis

**Audit against:** arXiv:2602.11865 — Intelligent AI Delegation framework
**Codebase revision:** feature/forum-topics (commit 56e972c)
**Audited files:** orchestrator.ts, message-queue.ts, state.ts, bot.ts, agent.ts, agent-config.ts, scheduler.ts, db.ts, memory.ts
**Date:** 2026-03-15

---

## 1. Current State Summary

ClaudeClaw has a functioning single-level delegation system and a structured audit store (hive_mind + inter_agent_tasks tables). Phase 4A topic isolation (forum thread keying) is complete. The infrastructure for Phase 4B/4C parallel execution exists in skeleton form (AbortController per chat, message queue per topic key) but several delegation-quality properties from the arXiv framework are absent or only partially implemented.

**What exists today with delegation relevance:**

- **Delegation routing** — `orchestrator.ts:80-111` parses `@agent:` and `/delegate` syntax and dispatches to named sub-agents
- **Task lifecycle record** — `inter_agent_tasks` table (db.ts:205-215) captures from/to agent, prompt, status, result, timestamps
- **Hive mind log** — `hive_mind` table (db.ts:192-203) with agent_id, action, summary, artifacts; written at delegate/result/error events in orchestrator.ts:148-153, 192-196, 219-223
- **Timeout/abort** — `orchestrator.ts:175-176` wraps each delegation in an AbortController with configurable timeout; scheduler.ts:79-80 has a 10-minute hard abort
- **Sequential execution guard** — `message-queue.ts` FIFO queue keyed on `chatId:topicId` prevents concurrent writes to the same session
- **Token + cost tracking** — `token_usage` table (db.ts:163-177) records per-turn cost and context size; bot.ts:505-528 saves and checks against threshold
- **Memory with importance weighting** — `memories` table has `importance` and `salience` floats (db.ts:93-108); ingest pipeline scores memories via Gemini
- **Context window firebreak** — `bot.ts:39-77` warns at 75% context usage and detects exhaustion; auto-compaction detected via SDK event

---

## 2. Gap Table

| # | Concept | Rating | Evidence / File:Line |
|---|---------|--------|----------------------|
| 1 | Task taxonomy metadata | MISSING | No field for complexity, criticality, or reversibility exists anywhere in `scheduled_tasks`, `inter_agent_tasks`, or any message object. agent-config.ts:8-19 defines `AgentConfig` with no capability/trust fields beyond `description`. |
| 2 | Liability firebreaks | PARTIAL | Timeout abort exists (orchestrator.ts:175-176, scheduler.ts:79-80, bot.ts:413-416). Context warning at 75% (bot.ts:39). No cost cap, no scope boundary check, no "halt and wait for confirmation" logic for high-risk operations. |
| 3 | Authority gradient | MISSING | The bot accepts and executes all instructions from authorized chat IDs without resistance. agent.ts:156-157 sets `permissionMode: 'bypassPermissions'` globally. No pushback logic, no task-class gating, no escalation path for destructive commands. |
| 4 | Trust/reputation per agent or tool | MISSING | `inter_agent_tasks` records outcomes (status: pending/completed/failed, db.ts:210-211) but no success rate, latency history, or trust score is ever computed or stored per agent. `agentRegistry` in orchestrator.ts:30 stores only id/name/description. |
| 5 | Verifiable completion artifacts | PARTIAL | `inter_agent_tasks.result` stores the text output (db.ts:211). `hive_mind.artifacts` column exists (db.ts:197) but is never populated — `logToHiveMind` calls in orchestrator.ts:148, 192, 219 all pass `undefined` for artifacts. No hash, no file reference, no structured result object. |
| 6 | Adaptive coordination / re-routing | MISSING | On delegation failure, orchestrator.ts:214-225 logs the error and re-throws — the caller (bot.ts:353-356) just sends an error message to Telegram. No retry, no alternate agent selection, no fallback path. scheduler.ts:109-119 similarly fails to a single error message. |
| 7 | Accountability chain / audit trail | PARTIAL | `hive_mind` and `inter_agent_tasks` form a functional audit log. Hive mind is append-only in practice (no delete path in db.ts). However: (a) delegation chains beyond one hop have no parent_task_id linkage; (b) scheduled tasks write to `scheduled_tasks.last_result` which is mutable (overwritten each run); (c) no cryptographic or timestamp integrity protection on audit rows. |
| 8 | Permission handling / semantic attenuation | MISSING | `agent.ts:157` sets `allowDangerouslySkipPermissions: true` unconditionally for all agents, all tasks, all prompts. `agent-config.ts` YAML schema has no `allowed_tools`, `forbidden_tools`, or scope fields. Permissions are binary: off (permission prompts) or fully bypassed. |

---

## 3. Critical Gaps for Phase 4C

These are the gaps most likely to cause correctness, safety, or debuggability failures when parallel execution ships.

### 3.1 No parent task linkage in inter_agent_tasks

**Why it blocks Phase 4C:** Parallel execution means multiple delegation chains running concurrently. Without a `parent_task_id` or `root_task_id` column, there is no way to reconstruct which sub-delegations belong to which top-level user request. Post-run debugging becomes a forensics problem.

**Location:** `db.ts:205-215` — `inter_agent_tasks` schema. `orchestrator.ts:147` — `createInterAgentTask()` call.

### 3.2 Permission mode is binary and unconditional

**Why it blocks Phase 4C:** When multiple agents run in parallel, a single rogue or confused sub-agent with `bypassPermissions` can cause irreversible filesystem or network actions with no way to scope or contain it. The framework paper's semantic attenuation principle specifically targets this.

**Location:** `agent.ts:156-158` — `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true`. No override path from agent-config.ts.

### 3.3 No cost cap or budget firebreak at the orchestration layer

**Why it blocks Phase 4C:** Parallel agents multiply cost exposure. The only limit today is per-message timeout. A pathological set of parallel tasks could exhaust token budget or Anthropic API limits with no circuit breaker.

**Location:** `orchestrator.ts:33` — `DEFAULT_TIMEOUT_MS` is the only guard. No accumulated cost tracking across delegations.

### 3.4 No retry or adaptive re-routing on delegation failure

**Why it blocks Phase 4C:** In sequential mode, a failed delegation just errors out and the user re-tries manually. In parallel execution, one failed branch needs either a retry policy or graceful degradation without blocking the rest of the parallel set.

**Location:** `orchestrator.ts:214-225` — catch block re-throws with no retry. `bot.ts:353-356` — final error handler.

---

## 4. Quick Wins

Changes requiring less than ~50 lines and no new subsystems.

### QW-1: Populate hive_mind.artifacts on delegation completion

`orchestrator.ts:191` — change `completeInterAgentTask(taskId, 'completed', result.text)` to also pass a structured artifact object (e.g. `{ text_length: N, cost_usd: X, session_id: Y }`), and pass it through to `logToHiveMind` at line 192. The column and the function signature already exist.

### QW-2: Add parent_task_id to inter_agent_tasks

`db.ts:205-215` — add `parent_task_id TEXT` column (nullable, foreign key to self). `orchestrator.ts:127` — add `parentTaskId?: string` to `delegateToAgent` signature, pass through to `createInterAgentTask`. This costs one migration and a parameter thread-through, but unlocks full chain reconstruction.

### QW-3: Track agent success/failure rate in agentRegistry

`orchestrator.ts:21-25` — add `successCount: number` and `failureCount: number` to `AgentInfo`. Increment in the catch/success paths at lines 191, 217. No persistence needed for V1 — in-memory stats survive the process lifetime and give observable trust signals.

### QW-4: Respect a per-agent cost accumulator

`orchestrator.ts:127-226` — after line 190 (`durationMs`), add the delegation's `result.usage.totalCostUsd` to a per-agent accumulated cost map. Log a warning if accumulated cost crosses a configurable threshold (e.g. `MAX_AGENT_COST_USD` from agent.yaml or env). This is five lines and surfaces cost data that is already flowing through `UsageInfo`.

### QW-5: Add task_type to scheduled_tasks schema

`db.ts:72-82` — add `task_type TEXT NOT NULL DEFAULT 'autonomous'` to `scheduled_tasks`. Populate from `schedule-cli.js` at creation time. Accepted values: `autonomous`, `confirmable`, `report_only`. This is a schema migration + one CLI flag — roughly 15 lines. It is the seed of task taxonomy without requiring the full metadata model.

---

## 5. Structural Gaps

Things that require new subsystems, not just column additions.

### SG-1: Task taxonomy and risk classification subsystem

The framework requires that each task carry metadata about complexity (simple/compound/complex), criticality (low/medium/high), and reversibility (reversible/irreversible). Today, every task is treated identically. Building this requires:

- A `TaskMetadata` interface (new file, e.g. `src/task-classifier.ts`)
- Classification logic — either rule-based (keyword matching against known destructive patterns) or LLM-based (lightweight Haiku call before dispatch)
- Propagation of metadata through `delegateToAgent` → `runAgent` → SDK options
- Storage in both `inter_agent_tasks` and `scheduled_tasks`

This is 200-400 lines and affects the core dispatch path.

### SG-2: Semantic permission attenuation layer

Today `agent.ts` passes a single boolean flag. The framework requires permissions to be scoped per task class. This requires:

- `agent-config.ts` YAML schema extended with `allowed_tools: []` / `forbidden_tools: []` / `max_cost_usd: number`
- A permission resolver that maps task metadata (from SG-1) + agent config to a concrete permission set
- Plumbing into the SDK `query()` call options — the Claude Agent SDK does support a `tools` allowlist in query options

This is a new subsystem (~150 lines) but has clear seams in the existing code. The SDK already supports the needed hooks.

### SG-3: Reputation/trust tracking per agent

`agentRegistry` is rebuilt from YAML at startup with no runtime state. A trust subsystem requires:

- A `agent_reputation` table in db.ts: `agent_id, success_count, failure_count, avg_latency_ms, last_error, updated_at`
- Update hooks in `orchestrator.ts` completion/failure paths
- A `getTrustScore(agentId)` function used by orchestrator to gate or warn before dispatch
- Optionally: trust decay over time (similar to memory salience decay in `memory.ts:149`)

### SG-4: Halt-and-escalate firebreak for high-risk tasks

The framework's liability firebreaks require that tasks classified as high-risk/irreversible pause execution and request explicit human confirmation before proceeding. This needs:

- Integration with task taxonomy (SG-1)
- A `pendingApprovals` store (in-memory map or DB table) keyed by task ID
- A Telegram callback (inline keyboard button) that resumes or cancels the pending task
- Timeout on the pending approval (auto-cancel if no response in N minutes)

This is the most user-visible structural gap and a non-trivial stateful interaction pattern (~300 lines including the Telegram callback handlers).

### SG-5: Adaptive re-routing / retry policy

Currently there is no retry logic anywhere (orchestrator, scheduler, or bot). A proper retry subsystem needs:

- Configurable retry policy per task type: `max_retries`, `backoff_ms`, `retry_on: ['timeout', 'error']`
- Alternate agent selection: if agent A fails, try agent B with equivalent capabilities (requires capability tags in agent-config.ts)
- Re-routing hooks in `orchestrator.ts:210-225` (catch block)
- Partial result salvage: if a delegation partially completed before failing, preserve the partial output

---

## 6. Specific Code Locations for Changes

| Gap | File | Line(s) | Change |
|-----|------|---------|--------|
| QW-1: artifacts population | orchestrator.ts | 191-196 | Pass structured artifact dict to logToHiveMind |
| QW-2: parent_task_id | db.ts | 205-215 | Add column to schema + migration |
| QW-2: parent_task_id thread-through | orchestrator.ts | 127, 147 | Add optional param, pass to createInterAgentTask |
| QW-3: in-memory trust counters | orchestrator.ts | 21-25, 191, 217 | Add successCount/failureCount to AgentInfo, increment |
| QW-4: per-delegation cost cap | orchestrator.ts | 134, 190-191 | Accumulate cost, check against threshold |
| QW-5: task_type column | db.ts | 72-82 | Add task_type to scheduled_tasks schema |
| SG-1: task classifier | src/task-classifier.ts | NEW FILE | TaskMetadata interface + classification function |
| SG-2: permission attenuation | agent-config.ts | 8-19 | Extend AgentConfig with allowed_tools/forbidden_tools |
| SG-2: permission attenuation | agent.ts | 143-168 | Replace hardcoded bypassPermissions with resolved policy |
| SG-3: reputation table | db.ts | 205 (after inter_agent_tasks) | New agent_reputation table + CRUD functions |
| SG-3: reputation update hooks | orchestrator.ts | 191, 214-225 | Call updateAgentReputation() on completion/failure |
| SG-4: halt-and-escalate | orchestrator.ts | 127-226 | Pre-dispatch classification check + pending approval path |
| SG-4: approval callbacks | bot.ts | 609+ (after createBot) | Inline keyboard handler for approval/cancel |
| SG-5: retry policy | orchestrator.ts | 210-225 | Replace re-throw with retry loop + fallback agent |
| SG-5: retry policy | scheduler.ts | 109-119 | Add retry count tracking to scheduled_tasks schema + execution |
| Audit integrity | db.ts | 192-215 | Add immutable flag or hash to hive_mind rows |
