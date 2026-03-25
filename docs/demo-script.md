# EAC Demo Script: "Your Apps Come Alive"

A showcase of EAC (ClaudeClaw) as a self-hosted autonomous agent platform,
mirroring the Claude Mobile demo workflow but with our own stack.

## Prerequisites

Before recording the demo:
1. Google Calendar MCP is configured and authenticated (done)
2. `feature/image-renderer` branch has been merged (puppeteer + templates)
3. The upstream check task is scheduled (see Trigger Setup below)
4. Telegram chat with Galvatron (Data) is open on the Surface

## Trigger Setup (One-Time)

Create a scheduled task that checks for upstream updates. Run from ProBook:

```bash
cd /home/apexaipc/projects/claudeclaw
node dist/schedule-cli.js create \
  "Check if earlyaidopters/claudeclaw has new commits since our last merge. Run: gh api repos/earlyaidopters/claudeclaw/commits?per_page=5 and compare with our current HEAD. If there are new commits, send me a summary of what changed and ask if I want to review the upgrade path." \
  "0 9 * * *"
```

For the demo, trigger it manually by sending the prompt directly to Galvatron.

---

## Act 1: The Notification (Proactive Trigger)

**Setup**: Either wait for the scheduled task to fire, or manually send
Galvatron the check prompt to simulate the trigger.

**What Galvatron does**:
1. Runs `gh api repos/earlyaidopters/claudeclaw/commits?per_page=5`
2. Compares with local HEAD
3. Sends a proactive Telegram message

**Expected Galvatron message** (organic, not scripted verbatim):
```
Heads up -- upstream ClaudeClaw just pushed 6 new commits. Highlights:

- Security hardening (PIN lock, kill switch, audit log)
- Dashboard agent creation wizard + CLI
- Memory v2 with semantic search overhaul
- README rewrite

7 files would conflict with our fork. Want me to break it down?
```

**Matthew's response**: "Yeah, what changed?"

---

## Act 2: The Investigation (Back-and-forth)

### Beat 2A: Changelog Deep Dive

**Matthew**: "Yeah, what changed?"

**What Galvatron does**:
1. Runs `gh api repos/earlyaidopters/claudeclaw/commits?per_page=10` for full details
2. Runs `git log --oneline upstream/main..main` to show fork divergence
3. Summarizes both sides

**Expected response** (Galvatron summarizes naturally):
```
Upstream (6 commits):
- Security: PIN lock on bot, emergency kill switch, audit logging
- Dashboard: agent creation wizard, model config panel, clickable stats
- Memory: v2 with cross-agent activity, conversation recall, pinned memories
- Cleanup: removed old architecture images, em dashes from README

Our fork (20 commits since diverge):
- Forum Topics with per-topic session isolation
- Mission Control L5 (Planner-Worker-Judge triad)
- Fleet Advisor for agent performance
- Sky-Lynx recommendation handoff
- Preference learning system

Both sides built heavy features on the same core files.
26 files merge cleanly, 7 have conflicts. 3 are severe (bot.ts, db.ts, orchestrator.ts).

Want the conflict-by-conflict breakdown?
```

### Beat 2B: Conflict Details (Optional)

**Matthew**: "How bad are the conflicts?"

**What Galvatron does**:
1. Runs `git diff --stat main..upstream/main`
2. References the merge guide if it exists, or does a live `git merge-tree` analysis

**Expected response**:
```
The conflicts are all additive -- both sides built different features, nothing contradicts.

Severe (need manual work):
- bot.ts: 10 conflict regions. Fork added topics/missions, upstream added security/streaming
- db.ts: Both added ~480 lines of migrations to different tables
- orchestrator.ts: We deleted it, upstream modified it (our mission-control.ts replaces it)

Moderate (straightforward merge):
- config.ts, index.ts, memory.ts, dashboard-html.ts

Resolution order matters: config -> db -> memory -> orchestrator -> index -> bot -> dashboard

Estimated 2-3 hours of focused work. Want me to plan the upgrade?
```

---

## Act 3: The Deliverables

**Matthew**: "Plan the upgrade with a rollback strategy, create an infographic
of what's changing, and schedule it for tonight during my normal downtime."

**What Galvatron does** (three parallel actions):

### 3A: Upgrade Plan with Rollback

Galvatron creates a structured plan (inline or via Notion):

```
UPGRADE PLAN: ClaudeClaw v1.1.0 -> v1.2.0 (upstream)

Pre-upgrade:
1. git stash any local changes
2. Verify pm2 process is healthy
3. Create snapshot: git tag pre-upgrade-backup

Merge (on feature branch):
4. git checkout -b feature/upstream-merge main
5. git merge upstream/main
6. Resolve conflicts in order: config -> db -> memory -> orchestrator -> index -> bot -> dashboard
7. npm run build (verify TypeScript compiles)
8. Test critical paths: bot startup, /mission, /lock, dashboard

Cutover:
9. pm2 stop claudeclaw
10. git checkout main && git merge feature/upstream-merge
11. pm2 start claudeclaw
12. Verify bot responds on Telegram

ROLLBACK (if anything breaks):
1. pm2 stop claudeclaw
2. git checkout main && git reset --hard pre-upgrade-backup
3. pm2 start claudeclaw
4. Verify bot responds
5. Notify via Telegram: rollback complete
```

### 3B: Infographic

Galvatron generates the infographic using the image renderer:

```bash
# What Galvatron runs internally (via Bash tool):
cd /home/apexaipc/projects/claudeclaw
npx tsx -e "
import { renderHtmlToImage } from './src/image-renderer.js';
import { upgradeOverviewTemplate } from './src/infographic-templates.js';

const html = upgradeOverviewTemplate({
  projectName: 'ClaudeClaw',
  currentVersion: 'v1.1.0 (fork)',
  targetVersion: 'v1.2.0 (upstream)',
  commitCount: 6,
  features: [
    'Security hardening (PIN lock, kill switch)',
    'Dashboard agent creation wizard',
    'Memory v2 with semantic search',
    'Clickable pinned memories',
  ],
  conflicts: [
    { file: 'src/bot.ts', severity: 'severe' },
    { file: 'src/db.ts', severity: 'severe' },
    { file: 'src/orchestrator.ts', severity: 'severe' },
    { file: 'src/config.ts', severity: 'moderate' },
    { file: 'src/memory.ts', severity: 'moderate' },
    { file: 'src/index.ts', severity: 'moderate' },
    { file: 'src/dashboard-html.ts', severity: 'moderate' },
  ],
  autoMerged: 26,
  scheduledTime: 'Tonight @ 11:00 PM CT',
  rollbackPlan: [
    'git checkout main && git reset --hard pre-upgrade-backup',
    'pm2 restart claudeclaw',
    'Verify bot responds on Telegram',
    'Notify: rollback complete',
  ],
});

const path = await renderHtmlToImage(html, { prefix: 'upgrade-plan', width: 1100 });
console.log(path);
"
```

Then sends the image via:
```
[SEND_PHOTO:/path/to/upgrade-plan_xxxxx.png|ClaudeClaw Upgrade Plan: v1.1.0 -> v1.2.0]
```

### 3C: Schedule the Upgrade

Galvatron calls Google Calendar MCP to create an event:

The agent uses the `mcp__google-calendar__create_event` tool with:
- Title: "ClaudeClaw Upstream Merge - v1.2.0"
- Time: Tonight at 11:00 PM CT (Matthew's normal downtime)
- Duration: 2 hours
- Description: includes the upgrade plan steps + rollback

### 3D: Confirmation

Galvatron sends a final message:

```
Done. Three things lined up:

1. Upgrade plan ready (7-step merge + 5-step rollback)
2. Infographic attached [photo above]
3. Calendar event created: tonight 11 PM - 1 AM CT
   "ClaudeClaw Upstream Merge - v1.2.0"

When you start tonight, I'll be here. Say "start upgrade" and I'll
walk through each step with you.
```

---

## Technical Notes

### How Galvatron Accesses These Tools

| Tool | Access Method |
|------|---------------|
| GitHub data | `gh` CLI via Bash tool |
| Git operations | `git` via Bash tool |
| Infographic render | `npx tsx` script via Bash tool |
| Google Calendar | `mcp__google-calendar__create_event` (MCP auto-discovered) |
| Telegram photo | `[SEND_PHOTO:path]` marker in response text |

### What Makes This Different from Claude Mobile

| Aspect | Claude Mobile | EAC/Galvatron |
|--------|--------------|---------------|
| Hosting | Anthropic cloud | Self-hosted on ProBook |
| Interface | Mobile app | Telegram |
| Integrations | Managed by Anthropic | User-configured MCP + direct APIs |
| Proactive | Push notifications | Scheduled tasks + Telegram messages |
| Persistence | Conversation history | SQLite memory + semantic search |
| Multi-agent | Single model | Orchestrator + fleet of specialized agents |
| Image gen | Artifacts | Puppeteer HTML-to-PNG |
| Scheduling | Not available | Google Calendar MCP + internal scheduler |

### CLAUDE.md Addition for Image Renderer

Add to Galvatron's CLAUDE.md (`~/.claudeclaw/CLAUDE.md`) so the agent knows
how to use the infographic tools:

```markdown
## Image Generation

You can generate infographics and visual reports using the image renderer.

To create an image:
1. Write a tsx script that imports from `./src/image-renderer.js` and `./src/infographic-templates.js`
2. Run it via `npx tsx <script>` from the project directory
3. It outputs a PNG path to stdout
4. Use `[SEND_PHOTO:<path>|<caption>]` to send it via Telegram

Available templates:
- `upgradeOverviewTemplate(data)` -- version upgrades with features, conflicts, rollback
- `statusReportTemplate(data)` -- metric cards + sectioned content

Or generate custom HTML and call `renderHtmlToImage(html, options)` directly.
```
