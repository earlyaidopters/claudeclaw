# Intelligent AI Delegation — ClaudeClaw Phase 4B/4C Integration Design

**Architect:** Claude Sonnet 4.6
**Paper:** arXiv:2602.11865 — "Intelligent AI Delegation" (Tomašev, Franklin, Osindero — Google DeepMind)
**Date:** 2026-03-15

---

## 1. Executive Summary

ClaudeClaw's current architecture already implements a basic multi-agent delegation layer (orchestrator, inter-agent tasks, hive_mind log) and Phase 4A added per-topic conversation isolation via Telegram Forum Topics. The Intelligent AI Delegation paper (IAD) provides a principled framework that directly maps onto three gaps in the current system: ClaudeClaw has no task characterization before delegation (it delegates on syntax pattern alone), no liability stop-points for irreversible actions, and no trust or reputation model per agent. Phase 4B should embed lightweight task taxonomy scoring into the topic auto-creation decision path so that criticality, reversibility, and verifiability determine how a topic is scoped and which agent receives it. Phase 4C should layer liability firebreaks and an authority gradient on top of the parallel execution model so that high-criticality or irreversible delegated tasks cannot run unsupervised without an explicit human checkpoint. The full IAD framework (market auctions, ZKPs, blockchain) is out of scope for a personal assistant bot, but six of its nine technical concepts have direct, proportionate analogues that can be built with SQLite and TypeScript.

---

## 2. Integration Map

| IAD Concept | Relevance | Rationale |
|---|---|---|
| Task taxonomy (complexity, criticality, reversibility, verifiability, contextuality, subjectivity) | **RELEVANT** | Directly informs topic auto-creation logic in 4B — a message asking "delete all emails from 2023" scores differently than "draft a reply to Matt." |
| Liability firebreaks (assume liability OR halt and escalate) | **RELEVANT** | The current `delegateToAgent` flow has no stop-points. An irreversible action (send email, push git commit, file delete) needs a firebreak before sub-agent execution in 4C. |
| Authority gradient (assertive enough to push back, yield on valid overrides) | **RELEVANT** | Sub-agents today are sycophantic by design — they receive a prompt and execute. 4C should give the orchestrator a mechanism to challenge or refuse a sub-task and surface the reason before the user. |
| Accountability chains / moral crumple zone | **RELEVANT** | The `inter_agent_tasks` + `hive_mind` log is the right primitive. It needs immutable provenance: who delegated what, what the sub-agent did, and what the outcome artifact was. Currently `result` is mutable. |
| Trust and reputation per delegatee | **PARTIAL** | Agent registry exists (`agentRegistry` in orchestrator) with name/description. No runtime performance record. A lightweight per-agent success/failure/latency table is feasible and valuable for routing in 4C. |
| Verifiable task completion artifacts | **PARTIAL** | `inter_agent_tasks.result` stores free-text. No structured artifact or verification check. A defined artifact schema with a pass/fail flag would make audit meaningful. |
| Adaptive coordination (dynamic re-allocation on failure/context shift) | **PARTIAL** | The AbortController + timeout pattern exists. No re-delegation on failure — the error is returned to the user. 4C can add retry-with-alternate-agent logic for tasks that score high on uncertainty. |
| De-skilling risk and curriculum-aware task routing | **NOT APPLICABLE** | ClaudeClaw has one human user (Matthew) who is the delegator, not a delegatee. The paper's concern applies to workforces; not relevant to a personal AI assistant. |
| Market auctions, smart contracts, ZKPs, blockchain | **NOT APPLICABLE** | These are web-scale coordination mechanisms. ClaudeClaw is a single-user, single-machine system. The trust primitives (DB-level reputation scores) are sufficient. |

---

## 3. Phase 4B — Smart Topic Creation with Task Taxonomy Awareness

### 3.1 Problem Being Solved

Today, ClaudeClaw receives a Telegram message and either (a) routes it to an existing topic if the message arrives in one, or (b) processes it in the default context. Phase 4B adds automatic topic creation. Without task taxonomy, auto-creation is forced to rely on keyword heuristics or NLP topic clustering — both brittle.

IAD's task characteristics give us a principled scoring rubric that drives topic creation decisions.

### 3.2 Proposed Flow

```
Incoming message
      │
      ▼
[TaskClassifier] ── scores 6 dimensions → TaskProfile
      │
      ├─ complexity HIGH or duration LONG  → create new topic (isolated context)
      ├─ criticality HIGH                  → create new topic + flag for firebreak
      ├─ reversibility LOW                 → create new topic + require confirmation
      ├─ verifiability LOW                 → route to human-review topic
      └─ complexity LOW, criticality LOW   → handle inline (no new topic)
```

### 3.3 TaskClassifier Design

The classifier runs as a lightweight pre-processing step in `bot.ts` before the message is enqueued. It calls Claude with a structured prompt that returns a `TaskProfile` JSON object. This is a single fast API call (Haiku-tier, not Sonnet) and should complete in under 2 seconds.

**Input:** raw user message
**Output:** `TaskProfile` (see Section 5 for schema)

Classification prompt should score each dimension on a 3-point scale (low / medium / high) and return a routing recommendation: `inline`, `new-topic`, `new-topic-with-firebreak`, `escalate-human`.

### 3.4 Topic Lifecycle from Taxonomy

| Condition | Topic Action |
|---|---|
| Complexity HIGH + Duration LONG | Create topic with descriptive name; persist session to topic_id |
| Criticality HIGH | Create topic; attach `firebreak_required: true` metadata |
| Reversibility LOW | Create topic; add confirmation gate before agent execution |
| Contextuality HIGH | Create topic; restrict context shared with any sub-agents |
| Subjectivity HIGH | Create topic; flag for iterative human feedback loop |
| All LOW | No topic creation; route inline |

### 3.5 Topic Naming

Topic names should be generated by the classifier as a short imperative phrase derived from the task intent (e.g., "Delete 2023 emails", "Draft reply — Matt thread"). This replaces generic auto-naming.

### 3.6 Complexity Floor

Per IAD Section 4.3: tasks with low criticality, high certainty, and short expected duration should bypass the delegation protocols entirely. In 4B terms: if the `TaskProfile` scores all dimensions LOW, skip topic creation and skip the classifier on subsequent quick follow-ups in the same conversation. This avoids adding 2s latency to every "what time is it" query.

---

## 4. Phase 4C — Parallel Execution with Liability Firebreaks and Authority Gradient

### 4.1 Problem Being Solved

Phase 4C introduces concurrent agent execution across topics. Without firebreaks, multiple agents can independently execute irreversible actions (send messages, delete files, call external APIs) with no checkpoint. The moral crumple zone risk is real: the user nominally retains authority but has no practical ability to intercept parallel sub-agent chains.

### 4.2 Firebreak Gates

A firebreak is a pre-execution pause. When the `TaskProfile` for a delegated sub-task has `reversibility = LOW` or `criticality = HIGH`, the orchestrator must halt and surface the action to the user before the sub-agent's `runAgent` call proceeds.

**Firebreak behavior:**
1. Orchestrator constructs the sub-task prompt as normal.
2. Before calling `delegateToAgent`, checks the attached `TaskProfile`.
3. If firebreak conditions are met, sends a Telegram message: "About to [action summary]. Confirm? (yes/no/edit)"
4. Awaits user reply (timeout: 5 minutes default, configurable per task type).
5. On `yes`: proceeds with delegation.
6. On `no`: aborts the topic task and logs to `hive_mind` with `action: 'firebreak_halted'`.
7. On `edit`: presents the draft sub-prompt to the user for modification before re-delegating.
8. On timeout: assumes NO (safety default), notifies user.

This maps directly to IAD Section 5.2's two options: "assume full liability OR halt and request updated authority from human principal."

### 4.3 Authority Gradient Implementation

The authority gradient controls how sub-agents respond when a task is ambiguous or potentially problematic. Currently, `delegateToAgent` builds a full prompt and runs it unconditionally.

Add a new execution mode: `challenged`. When a sub-agent's task scores HIGH on uncertainty or LOW on verifiability, the sub-agent should be instructed (via system prompt injection) to:
- State explicitly what it is about to do before doing it.
- Flag any action it considers irreversible or ambiguous.
- Return a structured pre-flight report for the orchestrator to inspect before tool execution.

This is implemented as a prompt modifier in `orchestrator.ts` — not a new agent, just an additional instruction block prepended to the delegation prompt when the gradient trigger fires.

**Gradient levels:**

| Level | Trigger | Behavior |
|---|---|---|
| 0 — Direct | All dimensions LOW | Execute with no extra scaffolding |
| 1 — Transparent | Complexity/Uncertainty MED | Sub-agent prepends action summary before each tool call |
| 2 — Challenged | Criticality HIGH or Reversibility LOW | Sub-agent generates pre-flight report; orchestrator reviews before proceeding |
| 3 — Firebreak | Irreversible + High-criticality | Human confirmation gate (Section 4.2 above) |

### 4.4 Parallel Execution Coordination

`MessageQueue` already serializes per chat:topic key. For Phase 4C parallel execution, multiple topic keys can run concurrently — that part is already built. What needs to be added:

1. **Resource awareness:** Track how many sub-agent tasks are running concurrently. Cap at a configurable `MAX_PARALLEL_DELEGATIONS` (default: 3). Excess tasks queue behind the cap.
2. **Cross-topic dependency detection:** If two parallel tasks are operating on the same resource (e.g., both modifying the same file), the orchestrator should serialize them automatically.
3. **Adaptive re-delegation:** If a sub-agent times out or returns an error, and the task scored LOW on reversibility, re-try once with the same agent. If it fails again, escalate to the user rather than silently failing.

### 4.5 Delegation Overhead Floor

IAD Section 4.3 notes that there is a complexity floor below which intelligent delegation protocols are not worth the overhead. For ClaudeClaw, the practical threshold:
- If message is conversational (no tool use expected, no external action): skip all taxonomy scoring.
- If the message is clearly a direct question: classify as complexity LOW inline, skip firebreak logic.
- Only invoke full taxonomy scoring if the message contains action keywords (delete, send, post, push, create, modify, deploy, cancel, book, transfer, call).

---

## 5. New Data Models

### 5.1 TaskProfile (in-memory + persisted to delegation audit)

```typescript
interface TaskProfile {
  // IAD Section 2.2 dimensions
  complexity:   'low' | 'medium' | 'high';
  criticality:  'low' | 'medium' | 'high';
  reversibility: 'low' | 'medium' | 'high';  // low = irreversible
  verifiability: 'low' | 'medium' | 'high';
  contextuality: 'low' | 'medium' | 'high';
  subjectivity:  'low' | 'medium' | 'high';
  uncertainty:   'low' | 'medium' | 'high';

  // Derived routing decision
  routing: 'inline' | 'new-topic' | 'new-topic-with-firebreak' | 'escalate-human';
  topicName?: string;          // suggested Forum Topic name if routing != 'inline'
  authorityGradient: 0 | 1 | 2 | 3;
  requiresFirebreak: boolean;

  // Metadata
  classifiedAt: number;        // unix timestamp
  classificationModel: string; // which model was used
}
```

### 5.2 agent_reputation (new DB table)

```sql
CREATE TABLE IF NOT EXISTS agent_reputation (
  agent_id        TEXT NOT NULL,
  task_id         TEXT NOT NULL,
  success         INTEGER NOT NULL DEFAULT 0,  -- 1 = completed, 0 = failed/timeout
  duration_ms     INTEGER,
  error_type      TEXT,                         -- 'timeout' | 'error' | null
  task_complexity TEXT,                         -- from TaskProfile
  task_criticality TEXT,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (agent_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_rep_agent ON agent_reputation(agent_id, created_at DESC);
```

Reputation is queried as a rolling window (last 30 tasks) to compute:
- `successRate`: completed / total
- `p95LatencyMs`: 95th percentile duration
- `reliabilityScore`: weighted composite used in agent selection

### 5.3 delegation_audit (new DB table)

The existing `inter_agent_tasks` table stores the prompt and result but is mutable and lacks provenance structure. A new `delegation_audit` table provides the immutable log IAD's accountability chains require.

```sql
CREATE TABLE IF NOT EXISTS delegation_audit (
  id              TEXT PRIMARY KEY,             -- UUID
  parent_task_id  TEXT,                         -- for recursive delegation chains
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  topic_id        TEXT,
  prompt_hash     TEXT NOT NULL,                -- SHA-256 of prompt (non-repudiable)
  task_profile    TEXT NOT NULL,                -- JSON TaskProfile
  authority_level INTEGER NOT NULL DEFAULT 0,   -- gradient level used
  firebreak_shown INTEGER NOT NULL DEFAULT 0,   -- was human shown confirmation?
  firebreak_response TEXT,                      -- 'yes' | 'no' | 'edit' | 'timeout'
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|halted
  result_hash     TEXT,                         -- SHA-256 of result
  result_summary  TEXT,                         -- first 500 chars of result
  started_at      INTEGER,
  completed_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_delegation_audit_chain ON delegation_audit(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_chat ON delegation_audit(chat_id, created_at DESC);
```

Storing `prompt_hash` rather than the full prompt makes the record tamper-evident without storing sensitive content twice. The full prompt remains in `inter_agent_tasks`.

### 5.4 topic_metadata (new DB table)

```sql
CREATE TABLE IF NOT EXISTS topic_metadata (
  chat_id         TEXT NOT NULL,
  topic_id        TEXT NOT NULL,
  topic_name      TEXT NOT NULL,
  routing         TEXT NOT NULL,
  task_profile    TEXT,                         -- JSON TaskProfile that triggered creation
  firebreak_required INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  closed_at       INTEGER,                      -- for lifecycle management
  PRIMARY KEY (chat_id, topic_id)
);
```

---

## 6. Integration with Existing Components

### 6.1 Files That Change

**`src/bot.ts`**
- Add `classifyTask(message: string): Promise<TaskProfile>` call before `messageQueue.enqueue`.
- If `routing == 'new-topic'` or `'new-topic-with-firebreak'`: call Telegram API to create Forum Topic, store in `topic_metadata`, then enqueue under the new `topicId`.
- If `requiresFirebreak`: after topic creation, call `presentFirebreak(chatId, topicId, taskProfile)` and await user response before enqueuing the agent call.
- Apply complexity floor: skip classifier if message matches conversational-only heuristic (no action keywords).

**`src/orchestrator.ts`**
- `delegateToAgent` gains two new parameters: `taskProfile?: TaskProfile` and `parentTaskId?: string`.
- Before calling `runAgent`, check `taskProfile.requiresFirebreak` and `taskProfile.authorityGradient`.
- For gradient levels 1 and 2, prepend appropriate scaffolding instructions to `fullPrompt`.
- For gradient level 3 (firebreak): block on `presentFirebreak()`.
- On `runAgent` completion: write to `delegation_audit` and `agent_reputation`.
- On `runAgent` failure/timeout: update `delegation_audit.status = 'failed'`; if `task_complexity != 'low'` and retry count < 2, re-invoke `runAgent` with same session; if still fails, escalate.
- Add `MAX_PARALLEL_DELEGATIONS` cap using a simple semaphore counter.

**`src/db.ts`**
- Add `createSchema` entries for `agent_reputation`, `delegation_audit`, `topic_metadata`.
- Add `runMigrations` checks for each new table.
- New exported functions: `logDelegationAudit()`, `completeDelegationAudit()`, `updateAgentReputation()`, `getAgentReputationSummary()`, `createTopicMetadata()`.

**`src/state.ts`**
- No structural changes needed. The `_processingKeys` set already handles per-topic processing state.
- Consider adding a `_parallelDelegationCount` counter here to track the concurrent delegation cap.

**`src/scheduler.ts`**
- Scheduled tasks should also receive TaskProfile classification. Add a `taskProfile` column to `scheduled_tasks` so recurring tasks retain their classification from first run.
- High-criticality scheduled tasks should send a pre-execution notification to Telegram ("About to run: [task]. Running in 60s unless you cancel.") rather than a blocking firebreak.

### 6.2 New Files Needed

**`src/task-classifier.ts`**
- Exports `classifyTask(message: string, model?: string): Promise<TaskProfile>`.
- Calls Claude API (Haiku-tier by default, configurable) with a structured classification prompt.
- Returns a validated `TaskProfile`.
- Include a fast-path heuristic: if message has no action keywords, return a LOW/inline profile without an API call.
- Cache results by message hash for the duration of a session (avoids re-classifying the same message on retries).

**`src/firebreak.ts`**
- Exports `presentFirebreak(chatId: string, topicId: string | null, taskProfile: TaskProfile, actionSummary: string): Promise<'yes' | 'no' | 'edit' | 'timeout'>`.
- Sends a structured Telegram message summarizing the planned action and its risk profile.
- Waits for user reply using a `Promise` that resolves on the next message matching `yes/no/edit` from the authorized chat.
- Includes a timeout (default 5 minutes) that resolves to `'timeout'` and defaults to NO.
- Stores the response in `delegation_audit`.

**`src/reputation.ts`**
- Exports `getAgentReputationSummary(agentId: string): AgentReputationSummary`.
- Exports `selectBestAgent(taskProfile: TaskProfile, candidates: AgentInfo[]): AgentInfo`.
- `selectBestAgent` ranks candidates by their `reliabilityScore` filtered by `task_complexity` match (don't route a high-complexity task to an agent with only low-complexity history).

---

## 7. Risk Flags

### 7.1 Classifier Latency Creep

The `classifyTask` call adds a network round-trip before every non-trivial message. If the fast-path heuristic is too narrow, users will experience 2-3 second delays on routine messages. The complexity floor must be tuned aggressively. Monitor classifier invocation rate in logs; if it exceeds 40% of all messages, the keyword filter needs expanding.

### 7.2 Firebreak Fatigue

IAD Section 5.1 explicitly warns against this: if firebreaks fire too often, users habituate and approve everything without reading. If every moderately complex task hits a firebreak, the mechanism becomes noise. The authority gradient levels 0-2 (transparent and challenged modes) should handle most cases without human interruption. Firebreaks (level 3) must be reserved for genuinely irreversible actions with high criticality — not "write a file to disk."

**Mitigation:** Log every firebreak with user response. If approval rate exceeds 95% over 50 consecutive firebreaks, alert that the threshold is too low and prompt recalibration.

### 7.3 Moral Crumple Zone via Firebreak Bypass

If users routinely approve firebreaks quickly (without reading), ClaudeClaw provides the appearance of human oversight with none of the substance — the exact moral crumple zone IAD warns about. The firebreak UI must present the specific action, not just a generic "confirm?". Include: what file/API/service, what the action is, and why it was flagged (reversibility LOW, criticality HIGH).

### 7.4 `delegation_audit` Table Growth

Every delegation writes a row. At high usage (parallel topics, scheduled tasks), this table will grow quickly. Add a retention policy: archive or delete `delegation_audit` rows older than 90 days where `status = 'completed'` and `firebreak_shown = 0`. Retain all rows where `status = 'failed'`, `firebreak_shown = 1`, or where the parent is a high-criticality task.

### 7.5 Reputation Bootstrap Problem

A new agent starts with no reputation history. `selectBestAgent` must handle the cold-start case — default to round-robin or description-match when no history exists. Do not default to routing all tasks to the agent with the longest history, as that creates a rich-get-richer dynamic where new agents never get enough tasks to build reputation.

### 7.6 Classifier Prompt Injection

The `classifyTask` function receives user-supplied text and feeds it to Claude. A prompt injection attack could cause the classifier to return a falsely LOW risk profile, bypassing firebreaks. The classifier prompt must be structured to resist this: use a strict JSON schema response with no freeform fields that could carry injected instructions, and validate the returned schema rigorously before using any dimension score.

### 7.7 Parallel Execution Session Conflicts

`MessageQueue` already serializes per `chatId:topicId` key, so two messages within the same topic cannot race. But parallel topics can still produce conflicts if both topics are trying to modify the same file or call the same external service. The cross-topic dependency detection proposed in Section 4.4 requires knowing the resource target in advance — which the `TaskProfile` alone cannot provide. A pragmatic approach: for Phase 4C initial release, add a resource lock table (resource URI → task_id) that agents acquire before writing and release on completion. Deadlock protection: lock timeout of 2 minutes.

### 7.8 Misclassification of Criticality

The classifier is an LLM, not a formal verifier. It will misclassify tasks. A "delete the test branch" might score criticality LOW (it's just a branch) but if that branch is someone's only copy of unreleased work, it's HIGH. The firebreak should also trigger on any action involving external mutation (anything that calls an external API or performs a filesystem write outside the project directory) regardless of classifier score — this is a defense-in-depth fallback that does not rely on classification accuracy.

---

## 8. Implementation Sequencing

The following order minimizes risk and delivers value incrementally:

1. **`src/task-classifier.ts`** — ship the classifier with aggressive fast-path, no routing changes yet. Run in logging-only mode to observe classification patterns on real traffic for 1-2 weeks.

2. **`delegation_audit` table + `src/db.ts` changes** — backfill existing `inter_agent_tasks` data, establish the audit trail before adding new delegation flows.

3. **`agent_reputation` table + `src/reputation.ts`** — passive data collection initially. Let trust scores accumulate before using them for routing decisions.

4. **`src/firebreak.ts`** — implement the firebreak mechanism against `inter_agent_tasks` flows first (before parallel execution adds complexity).

5. **`src/orchestrator.ts` authority gradient** — add gradient scaffolding to delegation prompts, test that challenged-mode agents actually surface pre-flight reports.

6. **`src/bot.ts` topic auto-creation** — wire classifier output to Telegram Forum Topic creation API. This is the most user-visible change and should come after the backend pieces are stable.

7. **Phase 4C parallel execution cap + resource locks** — add `MAX_PARALLEL_DELEGATIONS` and resource lock table last, once the preceding pieces are running cleanly.
