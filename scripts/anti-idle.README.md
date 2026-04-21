# Anti-Idle Kanban Dispatch

Two-layer auto-dispatcher that turns unblocked Kanban TODOs into queued
mission tasks on the right claudeclaw agent. Ported from `/clawd`
(2026-04-05 spec) on 2026-04-19.

## Why two scripts

The original /clawd spec (`memory/anti-idle-orchestrator-spec-2026-04-05.md`)
intentionally separates the decision engine from the side-effect layer:

| Layer | Script | Role | Side effects |
|-------|--------|------|---------------|
| 1. Dispatcher | `anti-idle-check.mjs` | Pure logic. Scan Kanban, rank candidates, emit JSON decision. | None on Kanban. Only touches `store/anti-idle/state.json` + audit log. |
| 2. Orchestrator | `anti-idle-orchestrator.mjs` | Consume JSON, claim Kanban rows, create mission tasks, reconcile. | Writes to `kanban_tasks`, `mission_tasks`, `anti_idle_sessions`. Posts to Telegram via `sendAlert()` (ops bot, category `anti_idle_summary`). |

Do not collapse them. Keeping the dispatcher deterministic + idempotent
means you can re-run it, pipe it into another tool, or dry-run it without
touching state. The orchestrator is the only thing that makes the system
act on the world.

## What each layer does

### Dispatcher (`anti-idle-check.mjs`)

1. Acquires a file-lock (prevents double-runs within 8 min).
2. Reads the Kanban source (SQLite `kanban_tasks` by default; opt into
   Supabase with `ANTI_IDLE_KANBAN_SOURCE=supabase`).
3. Builds a `TaskRecord` per TODO: SOP completeness, blocker status,
   priority bucket, staleness, high-risk signal, route target
   (`builder | content | research | ops | coordinator_review`).
4. Updates bounce state (tasks that moved `inprogress → todo` more than
   twice in 24h are quarantined).
5. Computes `availableSlots = WIP_CAP(3) - inprogressCount`.
6. Picks candidates deterministically — highest priority, then stale,
   then best SOP, then oldest. Multi-select only when every pick is
   explicitly tagged `independent`.
7. Prints the decision JSON (schema_version=2) to stdout.

No LLM calls. No Kanban writes.

### Orchestrator (`anti-idle-orchestrator.mjs`)

1. Acquires its own lock.
2. **Reconciles first.** For every `running` session in
   `anti_idle_sessions`, re-reads the current Kanban row and applies the
   conservative-completion rule: a session moves to `completed` only if
   `column_id='done'` AND `notes` carries the original `dispatch_run_id`
   correlation. Anything else → `quarantined`, `blocked`, `failed`, or
   `orphaned` (lease-expired).
3. Spawns the dispatcher as a child process and parses its JSON.
4. Validates schema, decision, WIP, route targets, and that no active
   session already owns the `dispatch_run_id`.
5. For each selected task, in a single SQL transaction:
   - Atomically claim the Kanban row (`todo → inprogress`, append
     `AUTO_DISPATCH: {dispatch_run_id,...}` to notes).
   - Insert a row in `mission_tasks` assigned to the target agent.
   - Insert a row in `anti_idle_sessions` tying the kanban task ↔
     mission task ↔ dispatch run.
6. Posts a one-line summary to Telegram via the alert router — `sendAlert({ agentId: 'ops', category: 'anti_idle_summary', meta: { kanbanTasksReconciled, missionsDispatched, ... } })`. Discord was deprecated 2026-04-20.

The orchestrator **never** marks a session complete based on a
mission-task claim alone. Durable Kanban state is authoritative.

## Storage

| What | Where |
|------|-------|
| Kanban source (default) | `store/claudeclaw.db` → `kanban_tasks` |
| Mission queue (handoff) | `store/claudeclaw.db` → `mission_tasks` |
| Ownership registry | `store/claudeclaw.db` → `anti_idle_sessions` (auto-created) |
| Dispatcher state | `store/anti-idle/state.json` |
| Dispatcher lock | `store/anti-idle/dispatcher.lock` |
| Orchestrator lock | `store/anti-idle/orchestrator.lock` |
| Audit log | `store/anti-idle/dispatcher-events.jsonl`, `orchestrator-events.jsonl` |

No `bot_kv` / Supabase / 1Password writes. Telegram bot token loads from
the ops-agent config (`OPS_BOT_TOKEN` env) via `dist/alert-router.js`
(`resolveBotToken('ops')`). Discord path (legacy `DISCORD_BOT_TOKEN`) was
removed 2026-04-20.

## Routing map

Clawd sub-agents map to claudeclaw agent IDs as follows:

| clawd (spec) | claudeclaw |
|--------------|------------|
| builder | builder |
| scribe | content |
| scout | research |
| ops | ops |

Tasks whose route resolves to `coordinator_review` are not dispatched
automatically — they're shown in `display_tasks` for manual review.

## Conservative-completion principle

From the /clawd spec:

> A task is NOT complete because a sub-agent says it is complete.
> A task is only complete when durable state reflects completion in a
> verifiable, correlated way.

Concretely:
- `mission_tasks.status='completed'` does NOT move the session to
  `completed` on its own.
- `kanban_tasks.column_id='done'` alone does NOT either — we also need
  `dispatch_run_id` in the kanban `notes` field.
- If the two disagree (mission says done, kanban still inprogress OR
  kanban went to done without our dispatch marker), the session is
  `quarantined` for human review.

## Running

Dry-run (recommended first):

```bash
ANTI_IDLE_DRY_RUN=1 ANTI_IDLE_NOTIFY_DISABLED=1 node scripts/anti-idle-orchestrator.mjs
```

Live:

```bash
node scripts/anti-idle-orchestrator.mjs
```

The orchestrator always runs the dispatcher itself. You can run the
dispatcher alone to inspect its output:

```bash
ANTI_IDLE_DRY_RUN=1 node scripts/anti-idle-check.mjs | jq
```

## Env

| Var | Meaning |
|-----|---------|
| `ANTI_IDLE_DRY_RUN=1` | Dispatcher: no state writes. Orchestrator: no Kanban claim, no mission creation, no Telegram post. |
| `ANTI_IDLE_NOTIFY_DISABLED=1` | Skip Telegram posting even in live mode. (Legacy `ANTI_IDLE_DISCORD_DISABLED=1` is still honored as an alias.) |
| `ANTI_IDLE_KANBAN_SOURCE=sqlite` | Default. Read Kanban from local `claudeclaw.db`. |
| `ANTI_IDLE_KANBAN_SOURCE=supabase` | Opt in to Supabase REST read. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`. Reconciliation in Supabase mode is not implemented in v1 — only scanning. |
| `ANTI_IDLE_MOCK_DATA_FILE=path` | Dispatcher: load `{todo:[],inprogress:[]}` from JSON instead of a live source. |
| `ANTI_IDLE_ORCH_MOCK_DISPATCH_FILE=path` | Orchestrator: skip dispatcher subprocess and read dispatch JSON from file. |

## Cron

Registered via `schedule-cli`: fires at the top of the hour at 9, 11,
13, 15, 17, 19 local (cron expression `0 9-19/2 * * *`), agent=`ops`,
model=`haiku`. To list: `node dist/schedule-cli.js list --agent ops`.

## Known limitations vs /clawd original

- No OpenAI selector. The original had a GPT pass for multi-factor
  candidate selection; user spec for this port required pure logic.
  Deterministic ranking only (priority → stale → SOP → age).
- No automatic troubleshoot-task creation on dispatcher failure. Errors
  are logged to the jsonl audit + posted to Telegram (via `sendAlert`
  with `category: 'error'`) only.
- Supabase-mode reconciliation is unimplemented (SQLite-only in v1).
- Stale-inprogress auto-reclaim isn't wired — stale IDs are surfaced in
  the dispatcher output but the orchestrator doesn't force-move them.
