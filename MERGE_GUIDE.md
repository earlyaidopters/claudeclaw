# Upstream Merge Guide: earlyaidopters/claudeclaw -> MatthewSnow2/claudeclaw

Generated: 2026-03-25

## Summary

- **Merge base**: `7370393` (the last common commit)
- **Upstream commits**: 8 (features: dashboard wizard, agent creation, security hardening, Mission Control, Memory v2, README overhaul)
- **Fork commits**: ~20 (features: Forum Topics, Mission Control L5, fleet advisor, preference learning, Sky-Lynx integration, auto-snapshots)
- **Auto-merged cleanly**: 26 files
- **Conflicts**: 7 files (detailed below)
- **Delete/modify conflict**: 1 file (`src/orchestrator.ts`)
- **Branch for attempt**: `feature/upstream-merge-attempt` (merge left in conflicted state for inspection)
- **Stashed changes**: Local uncommitted changes to `.gitignore`, `CLAUDE.md`, `src/bot.ts`, `src/db.ts` were stashed before merge attempt

## Conflict-by-Conflict Breakdown

### 1. `src/orchestrator.ts` -- SEVERE (delete/modify)

**Fork**: Deleted this file entirely. Replaced with `src/mission-control.ts` (Planner-Worker-Judge triad, L5 multi-agent orchestration).
**Upstream**: Modified the file (14 insertions, 4 deletions) -- added improvements to the existing delegation/orchestrator pattern.

**Resolution strategy**: Keep the fork's deletion. The fork's `mission-control.ts` is a ground-up replacement with far more functionality (mission planning, approval flow, subtask decomposition). However, review upstream's changes to `orchestrator.ts` to ensure no new delegation logic was added that `mission-control.ts` doesn't cover. Key concern: upstream's `bot.ts` imports from `./orchestrator.js` -- those imports need to be redirected to `./mission-control.js`.

**Risk**: Medium. Must verify all upstream code that imports from `orchestrator.ts` is updated to use `mission-control.ts` equivalents.

### 2. `src/bot.ts` -- SEVERE (10 conflict regions, both sides heavily modified)

**Fork** (+400/-79): Added Forum Topics support (topic_id threading), Mission Control commands (/mission, /cancel, /topics, /close, /reopen), smart timeout per message complexity, mission approval flow (pendingMissions map).
**Upstream** (+268/-32): Added security features (PIN lock, kill switch, audit), streaming rate limiter, memory pinning (/pin, /unpin), evaluateMemoryRelevance, agent creation commands.

**Conflict regions**:
1. **Imports** (line 22-75): Fork imports mission-control + topic modules; upstream imports security + orchestrator + streaming. Resolution: merge both import blocks, redirect orchestrator imports to mission-control.
2. **saveConversationTurn call** (line 515-521): Fork passes topicId; upstream passes delegation.agentId. Resolution: pass both.
3. **sessionId extraction** (line 561-565): Fork extracts sessionId before typing; upstream removed it. Resolution: keep fork's version (needed for topic isolation).
4. **tool_active event handler** (line 601-616): Fork emits to dashboard only; upstream adds streaming-aware tool notifications. Resolution: take upstream's streaming logic, add fork's topicId to emitChatEvent.
5. **Response logging** (line 705-714): Fork uses logConversationTurn + triggerMemoryIngestion separately; upstream uses saveConversationTurn + evaluateMemoryRelevance. Resolution: use upstream's approach but preserve fork's triggerMemoryIngestion call and topicId.
6. **Command registration** (line 919-928): Fork adds mission/cancel/topics/close/reopen; upstream adds lock/status. Resolution: include all commands from both sides.
7. **Help text** (line 953-963): Same as above -- combine both command lists.
8. **Respin handler** (line 1069-1073): Fork passes topicId; upstream uses messageQueue. Resolution: use messageQueue AND pass topicId.
9. **Forget handler** (line 1174-1181): Fork uses isAuthorised + topicId; upstream uses replyIfLocked. Resolution: use replyIfLocked (upstream security) AND pass topicId.
10. **Delegate + mission commands** (line 1340-1482): Fork has full /mission, /cancel, /topics, /close, /reopen command blocks; upstream has simpler delegate with messageQueue. Resolution: keep fork's commands, adopt upstream's messageQueue pattern for delegate routing.

### 3. `src/config.ts` -- MODERATE (3 conflict regions)

**Fork**: Added ALLOWED_CHAT_IDS, BACKGROUND_MAX_CONCURRENT, AUTO_ARCHIVE_DAYS, TOPIC_CLASSIFY_ENABLED, FORUM_CHAT_ID, smart timeout system (getTimeoutForMessage), mission timeouts (SUBTASK_TIMEOUT_MS, MISSION_TIMEOUT_MS, MISSION_MAX_RETRIES), contextKey helper.
**Upstream**: Added SECURITY_PIN_HASH, IDLE_LOCK_MINUTES, EMERGENCY_KILL_PHRASE, STREAM_STRATEGY, StreamStrategy type.

**Resolution strategy**: Include ALL config values from both sides. No semantic overlap -- fork added forum/mission configs, upstream added security/streaming configs. The AGENT_TIMEOUT_MS definition is nearly identical (both set 15min default with similar comments) -- take fork's version which includes the smart timeout enhancement.

### 4. `src/db.ts` -- SEVERE (2 large conflict regions, both sides added ~480+ lines)

**Fork** (+491/-24): Added Forum Topics table + migrations (topic_id columns on sessions, conversation_log, token_usage, hive_mind, inter_agent_tasks), forum topic CRUD functions, preference learning tables + functions.
**Upstream** (+472/-15): Added Hive Mind V2 migrations (agent_id on memories, embeddings on consolidations, FTS5 trigger fix, superseded_by, pinned flag), Mission Control migration (nullable assigned_agent), audit_log table, agent_activity_log, dashboard-related queries.

**Resolution strategy**: Include ALL migrations from both sides. They modify different columns/tables with one exception: both add to the `initDatabase()` migration sequence. Interleave migrations carefully -- order matters for SQLite (can't ALTER a column that already exists). Test with a fresh DB after merge.

**Risk**: High. Both sides added substantial DB schema changes. Must verify no migration conflicts at SQLite level. The fork's `sessions` table rebuild (adding topic_id via CREATE-INSERT-DROP-RENAME pattern) must run before any upstream changes that reference `sessions`.

### 5. `src/index.ts` -- MODERATE (1 conflict region)

**Fork**: Calls `initMissionControl()` after database init.
**Upstream**: Calls `initSecurity()` + `setAuditCallback()` + `initOrchestrator()` after database init.

**Resolution strategy**: Call initSecurity() + setAuditCallback() (from upstream), then initMissionControl() (from fork). Drop initOrchestrator() since orchestrator.ts is deleted and mission-control.ts replaces it.

### 6. `src/memory.ts` -- MODERATE (3 conflict regions)

**Fork**: Added preference profile imports/injection (getPreferenceProfile), triggerMemoryIngestion export.
**Upstream**: Added cross-agent activity awareness (getOtherAgentActivity), conversation history recall (searchConversationHistory), consolidation embeddings, agent_id parameter to ingestConversationTurn.

**Resolution strategy**:
- Imports: include both fork's `getPreferenceProfile` and upstream's `getConsolidationsWithEmbeddings` + `getOtherAgentActivity`
- Memory context building: include BOTH preference profile injection (fork) AND cross-agent activity + conversation recall (upstream) -- they are additive layers
- triggerMemoryIngestion: keep fork's separated function but add upstream's agentId parameter

### 7. `src/dashboard-html.ts` -- MODERATE (1 large conflict region)

**Fork** (+129/-1): Added Projects & Issues section to dashboard.
**Upstream** (+1096/-77): Major dashboard overhaul -- agent creation wizard, model config, clickable stats, token display, security status, pinned memories card.

**Resolution strategy**: Take upstream's large dashboard overhaul as the base, then splice in fork's Projects & Issues section. The fork's addition is self-contained (PROJECT_STATUS_COLORS constant + loadProjects function) and can be appended to upstream's code.

## Files That Auto-Merged Successfully (26 files)

These required no manual intervention:
- `.env.example`, `CLAUDE.md`, `CLAUDE.md.example`, `README.md`
- `agents/comms/CLAUDE.md`, `agents/comms/agent.yaml.example`
- `assets/dashboard-preview.png`, `assets/multi-agent-architecture.png`
- `scripts/agent-create.sh`, `scripts/battle-10-turns.ts`, `scripts/battle-test-all-agents.ts`, `scripts/setup.ts`, `scripts/test-memory-v2.ts`, `scripts/test-semantic-search.ts`
- `src/agent-config.ts`, `src/agent.ts`, `src/dashboard.ts`, `src/gemini.ts`, `src/media.ts`
- `src/memory-consolidate.ts`, `src/memory-consolidate.test.ts`, `src/memory-ingest.ts`, `src/memory-ingest.test.ts`, `src/memory.test.ts`
- `src/obsidian.ts`, `src/scheduler.ts`

## New Files From Upstream (no conflicts)

- `assets/architecture.png`, `assets/memory-diagram.png` -- replaced JPEG versions
- `scripts/pre-commit-check.sh` -- pre-commit hook
- `src/agent-create-cli.ts`, `src/agent-create.ts` -- dashboard agent creation wizard + CLI
- `src/mission-cli.ts` -- mission task CLI (complementary to fork's mission-control.ts)
- `src/security.ts` -- PIN lock, kill switch, audit logging

## New Files From Fork (no conflicts)

- `src/mission-control.ts`, `src/mission-planner.ts` -- L5 multi-agent orchestration (replaces orchestrator.ts)
- `src/topic-manager.ts`, `src/topic-classifier.ts`, `src/auto-archive.ts` -- Forum Topics system
- `src/fleet-advisor.ts`, `src/ecosystem-awareness.ts` -- agent performance monitoring
- `src/background-runner.ts`, `src/daily-loop.ts` -- background task infrastructure
- `src/agent-card.ts` -- agent capability cards
- `ecosystem.config.cjs`, `project.json` -- process management configs
- `docs/`, `outputs/`, `.firecrawl/` -- documentation and research artifacts

## Step-by-Step Merge Playbook

### Prerequisites
1. Ensure `upstream/main` is fetched: `git fetch upstream`
2. Stash any local changes: `git stash`
3. Verify the running instance is on `main` (never merge directly on `main`)

### Execution

```bash
# 1. Create a clean merge branch
git checkout -b feature/upstream-merge main

# 2. Attempt the merge
git merge upstream/main

# 3. Resolve conflicts in this order (dependencies matter):

# 3a. config.ts (no deps, other files import from here)
#     - Keep ALL fork config values
#     - ADD all upstream config values (security, streaming)
#     - Keep fork's smart timeout system
#     - Keep fork's contextKey helper

# 3b. db.ts (must be done before bot.ts or index.ts)
#     - Include ALL fork migrations (Forum Topics)
#     - Include ALL upstream migrations (Hive Mind V2, audit_log)
#     - Order: fork topic_id migrations first, then upstream memory/consolidation migrations
#     - Include ALL query functions from both sides

# 3c. memory.ts (imported by bot.ts)
#     - Merge imports from both sides
#     - Keep fork's preference profile layer + upstream's cross-agent + recall layers
#     - Keep fork's triggerMemoryIngestion, add upstream's agentId param

# 3d. orchestrator.ts (delete/modify)
#     - Delete the file (fork's decision stands)
#     - Verify mission-control.ts exports: parseDelegation, delegateToAgent, getAvailableAgents

# 3e. index.ts
#     - Call initSecurity() + setAuditCallback() from upstream
#     - Call initMissionControl() from fork
#     - Remove initOrchestrator() call

# 3f. bot.ts (depends on all above)
#     - Merge imports: mission-control + topic modules (fork) + security (upstream)
#     - Remove orchestrator imports
#     - Combine command registrations from both sides
#     - Apply upstream's messageQueue pattern to fork's delegate routing
#     - Keep forum topic support (topicId throughout)
#     - Add security checks (replyIfLocked) to fork's new commands

# 3g. dashboard-html.ts
#     - Take upstream's overhaul as base
#     - Append fork's Projects & Issues section

# 4. Verify
npm run build        # TypeScript compilation
npm run test         # If tests exist
git diff --check     # No conflict markers remaining

# 5. Commit
git add -A
git commit -m "feat: merge upstream (dashboard wizard, security, Memory v2)"

# 6. Pop stashed changes
git stash pop
# Resolve any stash conflicts

# 7. Test the running instance
# Switch main to the merge branch only after testing:
# git checkout main && git merge feature/upstream-merge
```

### Post-Merge Verification Checklist

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] All imports resolve (no references to deleted `orchestrator.ts`)
- [ ] Database migrations run cleanly on a fresh DB
- [ ] Database migrations run cleanly on the existing production DB
- [ ] Bot starts without crash
- [ ] /mission command still works (fork feature)
- [ ] /lock and /status commands work (upstream feature)
- [ ] Forum topic isolation still works (fork feature)
- [ ] Dashboard loads with both Projects section (fork) and agent creation wizard (upstream)
- [ ] Memory ingestion still works (both preference profile and cross-agent activity)
- [ ] Delegation to agents works (mission-control.ts path, not orchestrator.ts)

## Automation Opportunities

### For Next Upstream Sync

1. **Pre-merge conflict prediction script**: Run `git merge-tree $(git merge-base main upstream/main) main upstream/main` to predict conflicts before attempting the merge. This avoids creating a conflicted working tree.

2. **Migration ordering tool**: Write a script that extracts all `ALTER TABLE` / `CREATE TABLE` statements from both sides and checks for ordering conflicts (e.g., both adding the same column, or one side rebuilding a table the other expects).

3. **Import redirect automation**: When a file is deleted on one side and its exports are moved to a new file, a script could scan all `.ts` files for imports from the deleted module and suggest replacements.

4. **Periodic sync cadence**: Sync upstream weekly or biweekly rather than letting 8+ commits accumulate. Smaller merges are dramatically easier.

5. **Dashboard HTML conflict avoidance**: The `dashboard-html.ts` file is a single massive template string. Consider splitting it into sections (header, agents, memory, projects) as separate template functions, so both sides can add sections without conflicting.

6. **Feature flag pattern**: For divergent features (fork has Forum Topics, upstream has Security), consider feature flags in config.ts so both codebases can carry both features without runtime conflicts.

## Agent Coordination Approach Used

This merge analysis was performed in three sequential phases:

1. **Phase 1 - Conflict Analysis**: Identified the merge base, enumerated all files changed by each side, categorized overlaps by severity (delete/modify, both-modified, one-side-only). Used `git diff --name-status` from the merge base to each HEAD.

2. **Phase 2 - Merge Attempt**: Created `feature/upstream-merge-attempt` branch, ran `git merge upstream/main`, documented all 7 conflicts with their exact line ranges and both sides' intent.

3. **Phase 3 - Documentation**: Synthesized findings into this guide with per-conflict resolution strategies, a step-by-step playbook, and automation recommendations.

The merge branch (`feature/upstream-merge-attempt`) is left in its conflicted state for manual inspection. To clean up: `git checkout main && git branch -D feature/upstream-merge-attempt && git stash pop`.
