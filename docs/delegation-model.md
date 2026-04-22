# Delegation Model — Opus Brain, Sonnet Muscle

Adapted from War Room's `delegate_to_agent` pattern in `earlyaidopters/claudeclaw-os`. This is how the 8-agent roster actually works day to day.

## Principle

**Rudy (main) = Opus. The brain.**
- Reasons, plans, coordinates, answers conversational questions directly
- Does NOT execute long tasks himself (writing 50-line scripts, deep research, triaging 100 emails)
- Delegates execution to the right specialist via Mission Control

**Specialists = Sonnet. The muscle.**
- research / builder / content / ops / s2l / rainmaker / trader
- Each has its own Telegram bot, own CLAUDE.md persona, own Obsidian folders, own skills
- Runs the actual work asynchronously and pings Aditya back when done

Cost shape: Opus tokens only on reasoning + coordination (small). Sonnet tokens for the bulk of execution work. Haiku for polling tasks (bot fleet, purchase detector, email poll).

## The Roster (8 agents)

| Agent | Telegram | Model | Specialty |
|---|---|---|---|
| **main (Rudy)** | @jsmn_rudy_bot | Opus | Chief of Staff. Reasons, plans, triages, delegates. |
| **research** | @jsmn_researcher_bot | Sonnet | Web research, SEO/AEO, DION scout, competitive intel |
| **builder** | @jsmn_builder_bot | Sonnet | Code, migrations, scripts, infra |
| **content** | @jsmn_content_bot | Sonnet | DION pipeline, YouTube/LinkedIn/blog copy |
| **ops** | @jsmn_operations_bot | Sonnet (Haiku for polling) | Calendar, email triage, fragrance budget, system health |
| **s2l** | @JSMN_S2L_bot | Sonnet (Haiku for poll) | Lead pipeline, call transcripts, Loan Atlas, C21 drafts |
| **rainmaker** | @jsmn_rainmaker_bot | Sonnet | Realtor outreach, TPT/Weekend Pick, rate updates |
| **trader** | @jsmn_trader_bot | Sonnet | Bot strategy, backtests, risk controls |

## Rudy's Decision Tree

When Aditya sends Rudy a message:

```
Is it conversational, opinion, quick fact?
    → Answer directly. No delegation.

Does it require real execution?
  - Writing >10 lines of code? → delegate to builder
  - Research >5 min of searching? → delegate to research
  - Send an email / triage inbox? → delegate to ops (or s2l if lead-related)
  - Draft content / script / blog? → delegate to content
  - Realtor outreach / rate update? → delegate to rainmaker
  - Backtest / strategy / bot ops? → delegate to trader
  - New lead / C21 draft / call transcript? → delegate to s2l

Not sure which specialist?
  → Ask Aditya which one. Don't guess.
```

## Mission Control — the delegation plumbing

Already built in the repo at `src/mission-cli.ts`. Rudy (or any agent) can queue a task for another agent:

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
node "$PROJECT_ROOT/dist/mission-cli.js" create \
  --agent research \
  --title "Short label" \
  "Full detailed prompt with context and desired outcome"
```

- The target agent's scheduler picks up the task within 60s
- Runs it in the target agent's full Claude Code environment (its own CLAUDE.md, skills, MCP, Obsidian folders)
- On completion, sends the result to Aditya's Telegram
- Logs to `hive_mind` table so other agents can see what's been done

## Delegation etiquette (from War Room's personas)

When Rudy decides to delegate:

1. **Offer first, don't silently delegate.** "Want me to kick this to research?" not "On it" followed by a 5-minute silence.
2. **One short verbal confirmation AFTER the delegation, not before.** "Kicked it over to builder." Don't narrate: "I'm now going to call the delegate_to_agent tool..."
3. **Don't repeat yourself.** Rudy says it once, the sub-agent pings back when done.
4. **If the task is small and conversational, Rudy handles it directly.** Don't delegate "what's my schedule today" to ops — answer from memory + check calendar.

## Verbal confirmations Rudy can use

- "On it."
- "Kicked it to research."
- "Builder's got it."
- "Ops is handling."
- "S2L is drafting the C21 email."

## Hive Mind — cross-agent awareness

Every agent logs completed work to the `hive_mind` table. Rudy reads recent entries (via Layer 4 cross-agent activity in memory context) so he knows what other agents are up to before delegating.

Example: if builder just finished a migration, Rudy doesn't re-ask. If research already scanned DSCR rates today, Rudy pulls from that instead of delegating again.

## Anti-patterns to avoid

- ❌ Rudy silently delegating without telling Aditya
- ❌ Rudy writing code himself (>10 lines) instead of delegating to builder
- ❌ Builder doing research (delegate to research)
- ❌ Research sending emails (delegate to ops or s2l)
- ❌ Two agents doing the same thing (check hive_mind first)
- ❌ Delegating trivial tasks ("what time is it") — Rudy answers directly

## Future — `delegate_to_agent` as a first-class tool

Right now Rudy delegates by calling `mission-cli` via Bash. Next upgrade: wrap mission-cli as a typed `delegate_to_agent` tool exposed to Rudy's agent SDK, matching the War Room pattern. That way Rudy doesn't need to remember the exact command — just calls the tool with `agent_id` + `prompt`.

Status: planned, not built yet. Tracked in TODO.
