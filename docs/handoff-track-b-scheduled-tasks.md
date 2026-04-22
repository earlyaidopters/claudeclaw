# Claude Code Handoff — Track B: Scheduled Task Migration Prep

Three prompts. Paste them into Claude Code on desktop one at a time, in order **A → B → C** (or A → C → B; C is independent of B). Use **Sonnet** for all three.

---

## Prompt A — Add per-task model routing (schema + code)

```
# Task: Add per-task model override to ClaudeClaw scheduled tasks

## Model
Use Sonnet. This touches production code + DB schema, so needs judgment on existing patterns.

## Context
ClaudeClaw runs at `/Users/aditya_office_ai_assistant/claudeclaw`. The scheduled_tasks table currently has no model column — every task runs with the agent's default model. I need per-task model override so pollers can use Haiku while reasoning tasks use Opus (matches the OpenClaw `payload.model` approach).

## What to do

### 1. New migration: `migrations/v1.2.1/add-model-to-scheduled-tasks.ts`
Follow the existing migration pattern in `migrations/v1.2.0/`. The migration should:
- Add column: `ALTER TABLE scheduled_tasks ADD COLUMN model TEXT`
- No default — NULL means "use agent default"
- Update `migrations/version.json` to include `"v1.2.1": ["add-model-to-scheduled-tasks"]`

### 2. Update `src/db.ts`
- Find `createScheduledTask()` — add optional `model?: string` param; include in INSERT
- Find `getDueTasks()` — include `model` in SELECT + return type
- Find the `ScheduledTask` interface/type — add `model: string | null`

### 3. Update `src/scheduler.ts`
- In `runDueTasks()`, when task fires, pass `task.model` into `runAgent(...)` as a new param
- Existing `runAgent` signature has no model override — extend it (see step 4)

### 4. Update `src/agent.ts` (or wherever `runAgent` lives)
- Add optional `modelOverride?: string` param
- When spawning Claude Code CLI, if `modelOverride` present, pass `--model <modelOverride>` flag to the CLI command
- Preserve existing behavior when undefined

### 5. Update `src/schedule-cli.ts`
- Add `--model <name>` flag to the `create` command
- Valid values: `haiku`, `sonnet`, `opus` (validate; error on unknown)
- Pass through to `createScheduledTask()`

## Constraints
- Do NOT modify the existing v1.2.0 migration
- Do NOT break existing scheduled tasks (NULL model = current behavior)
- Do NOT commit unless `npm run typecheck` and `npm run build` pass
- Use existing code patterns — look at how other migrations handled ALTER TABLE

## Validation
```bash
cd /Users/aditya_office_ai_assistant/claudeclaw
npm run migrate           # should show "Applied v1.2.1/add-model-to-scheduled-tasks"
npm run typecheck
npm run build
sqlite3 store/claudeclaw.db ".schema scheduled_tasks"  # should include model TEXT column

# Test roundtrip
node dist/schedule-cli.js create "test prompt" "0 9 * * *" --model haiku
node dist/schedule-cli.js list | grep -i haiku  # should show the new task with model
node dist/schedule-cli.js delete <id>
```

## Commit
One atomic commit: `feat(scheduler): per-task model override (haiku/sonnet/opus)`
Include `Co-Authored-By: Oz <oz-agent@warp.dev>` on the last line.

Report back with: files changed, migration verification output, typecheck result.
```

---

## Prompt B — Import 64 OpenClaw jobs into claudeclaw SQLite

**Run AFTER Prompt A is merged — depends on the new `model` column.**

```
# Task: Import openclaw scheduled jobs into ClaudeClaw

## Model
Use Sonnet.

## Context
ClaudeClaw at `/Users/aditya_office_ai_assistant/claudeclaw`. Migration v1.2.1 (per-task model override) is complete.

I need to import 64 curated scheduled tasks from OpenClaw into ClaudeClaw's `scheduled_tasks` table. The full source data is at `/tmp/migrate-jobs.json` — already extracted. Full job-by-job mapping (which agent, which phase, which cron, which model tier) lives in this plan: `/Users/aditya_office_ai_assistant/claudeclaw/.warp/plans/` (grep for "ClaudeClaw Scheduled Tasks — Ported & Mapped").

## What to write: `scripts/import-openclaw-schedule.ts`

1. **Read** `/tmp/migrate-jobs.json` (array of objects with `{id, name, cron, model, timeout_s, oc_agent, prompt, ...}`)
2. **Map `oc_agent` to ClaudeClaw agent_id:**
   - `main` / `default` / `heartbeat` → `main`
   - `scout` → `research`
   - `content-creator` → `content`
   - `speed-to-lead` → `s2l`
   - `crypto-trader` → `main`
3. **Map openclaw model to Claude tier:**
   - `openai-codex/gpt-5.4` → `opus`
   - `openai/gpt-5.4-mini` → `sonnet`
   - `openai/gpt-4o-mini` → `haiku`
   - Anything else → `sonnet` (default)
4. **Phase assignment** — hardcode from inventory:
   - Phase 1 (active on import): `morning-brief`, `midday-check`, `eod-report`, `daily-reflection`, `daily-summary-check`, `calendar-manager`
   - Phase 2-6 (paused on import): everything else
5. **For each job:**
   - Compute `nextRun` via `computeNextRun(cron)` from `src/scheduler.ts`
   - Generate id via `randomBytes(4).toString('hex')`
   - Call `createScheduledTask(id, prompt, cron, nextRun, agentId, model)` (new signature from v1.2.1)
   - Then if not Phase 1: `UPDATE scheduled_tasks SET status='paused' WHERE id=?`
6. **Skip any tasks where enabled=false** in source json (those were disabled in openclaw for a reason)
7. **Before inserting:** check if a task with the same name already exists (by prompt fingerprint) — skip dupes so script is resumable

## Validation
```bash
cd /Users/aditya_office_ai_assistant/claudeclaw
npx tsx scripts/import-openclaw-schedule.ts --dry-run
# Review output: N tasks will be created, breakdown by agent + phase + model

npx tsx scripts/import-openclaw-schedule.ts
# Live run

sqlite3 store/claudeclaw.db "SELECT status, COUNT(*) FROM scheduled_tasks GROUP BY status;"
# Expect: active 6, paused 50+

sqlite3 store/claudeclaw.db "SELECT agent_id, model, COUNT(*) FROM scheduled_tasks GROUP BY agent_id, model ORDER BY agent_id;"
# Should show distribution across main/research/content/ops/s2l with haiku/sonnet/opus mix
```

## Constraints
- Do NOT enable Phase 2-6 tasks (keep paused for verification gating)
- Preserve full prompt text verbatim — the nuances matter
- Fail loudly if migration v1.2.1 hasn't been applied (check for `model` column)

## Commit
`feat(scheduler): import 64 OpenClaw scheduled tasks (Phase 1 active, 2-6 paused)`
With `Co-Authored-By: Oz <oz-agent@warp.dev>`.

Report back: counts by phase + agent + model, any skipped tasks, anything unexpected.
```

---

## Prompt C — DION slide QC cache

**Independent of B — can run any time after A.**

```
# Task: Add DION slide QC cache table to avoid re-generating passed slides

## Model
Use Sonnet.

## Context
ClaudeClaw at `/Users/aditya_office_ai_assistant/claudeclaw`. Currently the DION content pipeline regenerates slides per run even if the same fragrance was just done. Need a local cache so once a slide passes QC, it's reused until invalidated.

## What to do

### 1. New migration: `migrations/v1.3.0/add-dion-slide-cache.ts`
Create table:
```sql
CREATE TABLE IF NOT EXISTS dion_slide_cache (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fragrance_id   TEXT NOT NULL,
  slide_type     TEXT NOT NULL,         -- bottle, hook, cta, etc.
  content_hash   TEXT NOT NULL,         -- hash of inputs (fragrance data + prompt template version)
  asset_path     TEXT NOT NULL,         -- absolute path to generated image/video
  metadata       TEXT,                  -- JSON blob: dimensions, model used, tokens, etc.
  passed_qc_at   INTEGER NOT NULL,      -- unix seconds when it passed QC
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER,               -- optional TTL (NULL = never expires)
  invalidated    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_dion_cache_lookup ON dion_slide_cache(fragrance_id, slide_type, invalidated);
CREATE INDEX idx_dion_cache_hash ON dion_slide_cache(content_hash);
```

Update `migrations/version.json` to include `"v1.3.0": ["add-dion-slide-cache"]`.

### 2. Add DB helpers to `src/db.ts`
- `getCachedSlide(fragranceId, slideType, contentHash): CachedSlide | null` — returns most recent non-invalidated match
- `cacheSlide(fragranceId, slideType, contentHash, assetPath, metadata?, expiresAt?): number` — inserts row
- `invalidateSlide(fragranceId, slideType?)` — sets invalidated=1 (optional slideType, else all)
- Interface `CachedSlide` matching row shape

### 3. Skip wiring into DION pipeline for now
The content pipeline code isn't in this repo yet — scripts still live in `~/clawd/scripts/`. Just build the cache table + helpers now; wire into pipeline in a later step when we port DION scripts.

## Validation
```bash
cd /Users/aditya_office_ai_assistant/claudeclaw
npm run migrate
npm run typecheck
npm run build
sqlite3 store/claudeclaw.db ".schema dion_slide_cache"

# Test the helpers via a quick REPL-ish check:
node -e "
const db = require('./dist/db.js');
db.initDatabase();
const id = db.cacheSlide('bleu-de-chanel', 'bottle', 'abc123', '/tmp/test.png');
console.log('cached id=', id);
const hit = db.getCachedSlide('bleu-de-chanel', 'bottle', 'abc123');
console.log('hit=', hit);
"
```

## Commit
`feat(dion): SQLite cache for QC-passed slides`
With `Co-Authored-By: Oz <oz-agent@warp.dev>`.

Report back: migration applied, helpers working, schema output.
```

---

## Summary for the human driver

- **Order:** A → B → C (or A → C → B)
- **Model:** Sonnet for all three
- **Expected duration:** A ~15-30 min, B ~20-40 min, C ~10-20 min
- **When all three done, reply here** with commit SHAs + any surprises, and I'll run verification.
