# ClaudeClaw

```
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚══════╝

 ██████╗██╗      █████╗ ██╗    ██╗
██╔════╝██║     ██╔══██╗██║    ██║
██║     ██║     ███████║██║ █╗ ██║
██║     ██║     ██╔══██║██║███╗██║
╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
```

> Your Claude Code CLI, delivered to your phone via Telegram.

ClaudeClaw is not a chatbot wrapper. It spawns the actual `claude` CLI on your Mac or Linux machine and pipes the result back to your Telegram chat. Everything that works in your terminal (your skills, your tools, your context) works from your phone.

---

## Get started

![ClaudeClaw setup flow](assets/setup-flow.jpeg)

Follow these steps in order. The whole thing takes about 5 minutes.

---

### Step 1: What you need before anything else

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | Check: `node --version`. Download at [nodejs.org](https://nodejs.org) |
| **Git** | Check: `git --version`. If you've never used git, also run the two commands below |
| **Claude Code CLI** | Install: `npm i -g @anthropic-ai/claude-code` |
| **Claude account** | Log in: `claude login` (free, Pro, or Max plan) |
| **Telegram account** | Any existing account works |

**First time using git?** Run these two commands first (use your own name and email):
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
Without this, git operations will fail with a confusing error about missing identity.

**macOS users:** After starting ClaudeClaw for the first time, your Mac may show "Node wants to access..." permission dialogs. You need to click Allow on each one or the bot will silently hang. Keep an eye on your Mac screen during the first run.

**Which Claude plan works best?** ClaudeClaw runs the `claude` CLI, so any plan works (Free, Pro, Max). However, complex multi-step tasks (building skills, debugging code, multi-agent work) perform significantly better on **Opus**: If you're on the Free or Pro plan and Claude struggles with a task, the model matters. Sonnet is fast but often can't handle the kind of agentic work ClaudeClaw enables. Max ($100 or $200) with Opus is the recommended experience.

**New to the terminal?** Download [Warp](https://www.warp.dev), it's a modern terminal with AI built in. If you hit any OS-level issues during setup (permissions, missing tools, PATH problems), type `/agent` in Warp and describe what went wrong. It will walk you through fixing it. This alone will save you hours of Googling.

That's it for hard requirements. Everything else (voice, video, WhatsApp) is optional and the setup wizard will ask about them.

---

### Step 2: Create a Telegram bot

You need a bot token from Telegram. This is what ClaudeClaw uses to send and receive messages.

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts, give it a name and a username (e.g. `MyAssistantBot`)
4. Copy the token BotFather gives you, it looks like `1234567890:AAFxxxxxxx`

Keep this token handy for the next step.

---

### Step 3: Clone and install

```bash
git clone https://github.com/earlyaidopters/claudeclaw.git
cd claudeclaw
npm install
```

---

### Step 4: Run the setup wizard

```bash
npm run setup
```

The wizard walks you through everything interactively:

- Checks your environment (Node, Claude CLI, builds if needed)
- Asks which features you want (voice input, voice output, video analysis, WhatsApp)
- Sets up your Telegram bot token and chat ID
- **Configures security**: PIN lock, emergency kill phrase, idle auto-lock
- Opens your editor to personalize `CLAUDE.md`
- Lists the skills you'll want to install and where to get them
- Prompts for API keys **only for the features you selected**
- Installs a background service (launchd on macOS, systemd on Linux, PM2 on Windows)

> **Prefer to let Claude handle it?** After cloning, `cd` into the repo, run `claude`, and paste:
> ```
> I just cloned ClaudeClaw. Please read README.md and set me up completely.
> install deps, configure .env, help me get any API keys I need, and set up
> the background service for my OS.
> ```

---

### Step 5: Get your Telegram chat ID

Your chat ID locks the bot to you, no one else can use it.

1. Start the bot: `npm start`
2. Open Telegram and message your bot
3. Send `/chatid`
4. The bot replies with a number. that's your chat ID
5. Add it to `.env`:
   ```
   ALLOWED_CHAT_ID=your_number_here
   ```
6. Restart: stop the bot (Ctrl+C) and run `npm start` again

> The setup wizard does this step automatically if you run `npm run setup` before starting.

---

### Step 6: Send your first message

With the bot running, send any message. Try:

```
What can you do?
```

or

```
Check my calendar for today
```

or just start talking. Claude Code is running on your machine, it has access to your files, the web, and every skill you've installed.

---

### Step 7: Run as a background service

You probably want ClaudeClaw running automatically, not manually in a terminal.

**macOS**: the setup wizard installs a launchd agent. Or manually:
```bash
# After running npm run setup, it's already installed.
# Logs:
tail -f /tmp/claudeclaw.log
```

**Linux**: the setup wizard installs a systemd user service:
```bash
systemctl --user status claudeclaw
journalctl --user -u claudeclaw -f
```

**Windows**: use WSL2 (recommended) and follow the Linux steps, or:
```bash
npm install -g pm2
pm2 start dist/index.js --name claudeclaw
pm2 save && pm2 startup
```

---

### Step 8: Check everything is healthy

```bash
npm run status
```

Output looks like:
```
  ✓  Node v22.3.0
  ✓  Claude CLI 1.0.12
  ✓  Bot token: @YourBotName
  ✓  Chat ID: 1234567890
  ✓  Voice STT: Groq (configured)
  ⚠  Voice TTS: not configured
  ✓  Service: running (PID 12345)
  ✓  Memory DB: 47 memories stored
  ─────────────────
  All systems go.
```

---

## Updating ClaudeClaw

When a new version is released, update in 5 commands:

```bash
cd claudeclaw          # go to your ClaudeClaw directory
git pull               # pull the latest code
npm install            # install any new dependencies
npm run migrate        # apply any pending migrations
npm run build          # recompile TypeScript
```

Then restart the bot (Ctrl+C and `npm start`, or restart the background service).

**Do not** point Claude at the GitHub URL to read updates. Claude works with local files, so you need the repo cloned on your machine. `git pull` is how you stay current.

**Upgrading from V1?** If you heavily customized V1, start fresh with V2 and copy over your `.env` and any CLAUDE.md customizations. If you kept V1 mostly stock, `git pull` will work.

---

## How it works

![ClaudeClaw architecture](assets/architecture.png)

## What's included

### Zero extra API keys needed

With just `TELEGRAM_BOT_TOKEN` and `ALLOWED_CHAT_ID`:

| Feature | Works? | Notes |
|---------|--------|-------|
| Text messaging | ✅ | Full Claude Code, all tools |
| Photos | ✅ | Claude reads and analyzes them |
| Documents | ✅ | PDF, code, text. anything Claude Code can open |
| SQLite memory | ✅ | Auto-initialized on first run, nothing to configure |
| Session persistence | ✅ | Context carries across every message |
| Scheduled tasks | ✅ | Ask Claude to run anything on a cron schedule |
| Mission Control | ✅ | Dashboard task board with auto-assign. Needs `GOOGLE_API_KEY` for auto-assign |
| Web dashboard | ✅ | Live monitoring via Cloudflare tunnel. Needs `DASHBOARD_TOKEN` |
| Multi-agent | ✅ | Run multiple specialized agents in parallel |
| All your skills | ✅ | Every skill in `~/.claude/skills/` auto-loads |
| WhatsApp (`/wa`) | ✅ | No API key, but needs the wa-daemon running |
| Voice input | ❌ | Needs `GROQ_API_KEY` |
| Voice output (macOS) | ✅ | Uses `say` + ffmpeg locally, no API key needed |
| Voice output (cloud) | ❌ | ElevenLabs or Gradium API key for higher quality |
| Video analysis | ❌ | Needs `GOOGLE_API_KEY` + `gemini-api-dev` skill |
| Memory consolidation | ❌ | Needs `GOOGLE_API_KEY` for Gemini-powered pattern detection |

---

## API keys: what each does and alternatives

### Telegram Bot Token (required)

**Get it:** [@BotFather](https://t.me/botfather) → `/newbot`. free, instant.

---

### Groq: voice input (optional)

**What it does:** Transcribes your voice notes using Whisper before passing them to Claude.

**Get it:** [console.groq.com](https://console.groq.com). free tier, no card needed.

**Model:** `whisper-large-v3`

| Alternative | Cost | Notes |
|-------------|------|-------|
| **Groq** (default) | Free | Fastest to set up |
| OpenAI Whisper | ~$0.006/min | Swap `transcribeAudio()` in `src/voice.ts` |
| AssemblyAI | Free tier | More features |
| Local Whisper.cpp | Free | No API, runs on your Mac. needs code change |

---

### ElevenLabs: voice output (optional)

**What it does:** Converts Claude's responses to audio in your cloned voice.

**Get it:** [elevenlabs.io](https://elevenlabs.io) → clone your voice under "Voice Lab" → copy the Voice ID string.

**Model:** `eleven_turbo_v2_5`

**Tuning:** Edit `src/voice.ts` if the cloned voice sounds off:
```
stability: 0.5        (higher = more consistent but robotic)
similarity_boost: 0.75  (higher = closer to you but can distort)
```

| Provider | Cost | Notes |
|----------|------|-------|
| **ElevenLabs** (primary) | Free tier + paid | Best cloning quality |
| **Gradium AI** (built-in alternative) | Free tier (45k credits/mo) | Add `GRADIUM_API_KEY` + `GRADIUM_VOICE_ID` to `.env` |
| **macOS say + ffmpeg** (built-in fallback) | Free | No API key. works offline. Set `TTS_VOICE` in `.env` to change voice |
| OpenAI TTS | ~$0.015/1k chars | Good quality, no cloning. needs code change |
| Google Cloud TTS | Free tier | More robotic. needs code change |

The TTS cascade tries ElevenLabs first, falls back to Gradium, then to macOS `say`. Configure whichever providers you want. even just the local fallback works fine.

---

### Google: video analysis (optional)

**What it does:** Analyzes videos you send using Gemini. Also handles images, audio, function calling, structured output, and code execution via the `gemini-api-dev` skill.

**Get it:** [aistudio.google.com](https://aistudio.google.com) → "Get API key". free tier.

**Skill to install:** The `gemini-api-dev` skill is published by Google at:
- Skill docs: [github.com/google-gemini/gemini-skills/.../gemini-api-dev/SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-api-dev/SKILL.md)
- Repo: [github.com/google-gemini/gemini-skills](https://github.com/google-gemini/gemini-skills)
- Install: copy the `gemini-api-dev` folder into `~/.claude/skills/`

The skill reads `GOOGLE_API_KEY` from the environment automatically.

---

### Anthropic API key (optional)

**What it does:** Bypasses your Max subscription and uses pay-per-token billing instead.

**When to use it:** Server deployments, or if you want zero ambiguity about billing. The Max plan assumes "ordinary individual usage". an always-on bot can hit limits faster than expected.

**Get it:** [console.anthropic.com](https://console.anthropic.com)

---

### Google Workspace CLI (optional)

> ClaudeClaw ships with bundled Gmail and Google Calendar skills that work great out of the box. This is an **optional alternative** if you want broader Google Workspace access from a single tool.

[![Google Workspace CLI announcement](assets/workspace-cli-tweet.png)](https://x.com/addyosmani/status/2029372736267805081)

Google released an official CLI that covers Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, and every other Workspace API in one tool. It's dynamically built from Google Discovery Service and includes 40+ agent skills out of the box.

**Repo:** [github.com/googleworkspace/cli](https://github.com/googleworkspace/cli)

<details>
<summary><strong>What's a CLI, and how is it different from a skill or MCP?</strong></summary>

There are three ways Claude can interact with external services. They all achieve similar things, but work differently under the hood:

| | What it is | How Claude uses it |
|---|---|---|
| **CLI** (Command Line Interface) | A program you install on your machine that runs commands in the terminal. Think of it like a text-based app. | Claude runs terminal commands like `workspace drive list` or `workspace gmail send` through the Bash tool. It's the same as if you typed those commands yourself. |
| **Skill** | A markdown file (`.md`) that teaches Claude how to do something specific, usually by combining CLI commands, API calls, or code into a workflow. | Claude reads the skill file and follows its instructions. ClaudeClaw's bundled Gmail skill, for example, tells Claude which Python scripts to run and how to format the output. |
| **MCP** (Model Context Protocol) | A server that runs in the background and gives Claude access to tools directly, without going through the terminal. | Claude calls MCP tools natively, like calling a function. No terminal commands needed. It's the most seamless option but requires a running MCP server. |

In short: a CLI is a tool you run in the terminal, a skill is a set of instructions that tells Claude how to use tools, and an MCP is a live server that gives Claude direct access to tools. They can all do similar things, just with different tradeoffs in setup and flexibility.

</details>

**What it gives you beyond the bundled skills:**
- Google Drive (upload, download, search, share)
- Sheets and Docs (read, write, create)
- Chat (send messages, manage spaces)
- Admin (user management, org units)
- Every other Workspace API, auto-discovered

**When to use it:** If you want your assistant to interact with Google Workspace services beyond email and calendar, or if you prefer a single unified CLI over individual skills.

**Setup:** Follow the install instructions in the repo, then reference it in your `CLAUDE.md` so your assistant knows it's available.

---

## Default behaviors

### Voice notes → text reply (default)

![Voice pipeline](assets/voice-pipeline.jpeg)

Sending a voice note transcribes it and executes it as a command. **The reply comes back as text by default**: not audio.

To get a voice reply back from a specific voice note, say one of these anywhere in your message:
```
"respond with voice"    "respond via voice"    "respond in voice"
"send me a voice note"  "send a voice back"    "voice reply"
"reply with voice"      "reply via voice"
```

To toggle voice replies on permanently for all messages, send `/voice`. Send it again to turn it off. Resets on restart.

Voice output uses a cascade of TTS providers. If the first one fails, it tries the next:

1. **ElevenLabs** (primary). best quality, voice cloning
2. **Gradium AI** (alternative). free tier with 45k credits/month
3. **macOS `say` + ffmpeg** (local fallback), no API key needed, works offline on Mac

If all TTS providers fail, it falls back to text automatically.

### Voice pipeline

```
Voice note sent
  ↓
.oga file downloaded → renamed .ogg (Groq requires this)
  ↓
Groq Whisper → transcribed text
  ↓
Check for voice-back trigger phrases
  ├── found → Claude runs → TTS cascade → audio reply
  │                         (ElevenLabs → Gradium → macOS say)
  └── not found → Claude runs → text reply
```

### Photos → analyzed immediately

Send a photo with or without a caption. Caption becomes the instruction. No caption. Claude describes what it sees.

### Documents → read and processed

Any file Claude Code can open: PDFs, code, markdown, CSV, plain text. Caption is the instruction.

### Videos → Gemini analysis

ClaudeClaw downloads the video to `workspace/uploads/` and tells Claude to analyze it with the `gemini-api-dev` skill. Without `GOOGLE_API_KEY`, Claude receives the file path but can't understand the content. Telegram caps downloads at 20MB.

### File sending → Claude sends you files

Ask Claude to create a file (PDF, spreadsheet, image, text) and send it to you. Claude creates the file on your machine, includes a `[SEND_FILE:/path]` marker in its response, and the bot sends it as a Telegram attachment. Works with any file type up to 50MB.

```
"Write a haiku about AI and send it to me as a text file"
"Create a PDF summary of my meeting notes and send it"
"Generate a chart of monthly revenue and send the image"
```

Claude can also send photos inline using `[SEND_PHOTO:/path]`, and attach captions via `[SEND_FILE:/path|caption text]`. Multiple files in a single response are sent in order. If a file doesn't exist, you get an error message instead of a crash.

### Sessions persist

Claude Code sessions carry full context across messages. Reference something from earlier. Claude knows. Send `/newchat` to start fresh.

### Skills load automatically

Every skill in `~/.claude/skills/` loads on every session. Call them directly (`/gmail check inbox`) or describe what you want. Claude routes automatically if you've listed the skill in `CLAUDE.md`.

---

## Bot commands

**Everyday commands:**

| Command | What it does |
|---------|-------------|
| `/help` | List all available commands |
| `/stop` | Cancel the current agent query mid-execution. works from Telegram and the dashboard |
| `/model` | Switch Claude model for this chat. `/model haiku` for speed, `/model sonnet` for balance, `/model opus` (default) for full power. Resets on restart |
| `/voice` | Toggle voice replies on/off for all messages. When off, voice notes still get transcribed and executed. replies just come back as text |
| `/newchat` | Wipe the Claude Code session and start fresh. Use when context gets stale or the conversation window is filling up |
| `/respin` | Pull the last 20 conversation turns back into a fresh session. Run this right after `/newchat` to keep recent context without the full token weight |
| `/memory` | Show what the bot remembers about you (recent memories from SQLite) |
| `/forget` | Clear the session ID only. Memories stay and decay naturally over time |

**Integrations:**

| Command | What it does |
|---------|-------------|
| `/wa` | Open the WhatsApp interface. shows recent chats, pick one to read and reply |
| `/slack` | Open the Slack interface, same flow as WhatsApp |
| `/dashboard` | Get a clickable link to the live web dashboard |

**Security:**

| Command | What it does |
|---------|-------------|
| `/lock` | Lock the session immediately. Requires PIN to unlock. Only works when PIN is configured. |
| `/status` | Show current security status: PIN enabled, locked/unlocked, idle timeout, kill phrase |

**Setup (one-time):**

| Command | What it does |
|---------|-------------|
| `/start` | First message to the bot, confirms it's running |
| `/chatid` | Shows your Telegram chat ID for the `ALLOWED_CHAT_ID` setting in `.env` |

All built-in commands are registered in Telegram's command menu, so you get autocomplete when you type `/`.

### Skill commands auto-register in Telegram

Any skill in `~/.claude/skills/` that has `user_invocable: true` in its `SKILL.md` frontmatter automatically shows up in Telegram's `/` command menu. No code changes needed -- just drop a skill folder in and restart the bot.

For example, if you install the bundled `tldr` skill:

```bash
cp -r skills/tldr ~/.claude/skills/tldr
```

The next time the bot starts, `/tldr` appears in Telegram's autocomplete alongside the built-in commands. The description shown in the menu comes from the skill's `description` field in its frontmatter.

**How it works:** On startup, ClaudeClaw scans `~/.claude/skills/` for folders containing a `SKILL.md` with valid YAML frontmatter. If `user_invocable: true` is set, the skill's `name` and `description` are registered with Telegram's `setMyCommands` API alongside the built-in commands. Telegram allows up to 100 commands total.

**Important:** Telegram aggressively caches the command menu on mobile. After installing a new skill and restarting the bot, you may need to fully close Telegram (swipe it away from your app switcher, not just minimize) and reopen it before the new `/` commands appear.

Any `/command` not in the built-in list (like `/todo`, `/gmail`, `/tldr`) passes through to Claude and routes to whatever matching skill you have installed.

### /newchat + /respin workflow

Context windows fill up over long conversations. When things start feeling off or Claude starts missing context:

1. Send `/newchat` to start a completely fresh session
2. Send `/respin` immediately after

`/respin` pulls the last 20 conversation turns from the database and feeds them back into the new session as context. Claude sees what you discussed recently without carrying the full token weight of the old session. It's like a soft restart.

The pulled-in turns are marked as historical context (not new messages), so Claude treats them as background rather than active conversation.

### /slack interface

Send `/slack` to enter Slack mode. It works like the WhatsApp interface:

```
/slack           list recent conversations (unread first)
1                open conversation #1, show last 15 messages
r <text>         reply to the open conversation
r 2 <text>       quick-reply to conversation #2 without opening it
```

Type anything that isn't a number or `r <text>` to exit Slack mode and return to normal Claude.

---

## Dashboard (optional)

![Dashboard preview](assets/dashboard-preview.png)

A live web page that shows you everything happening inside your assistant: what tasks are scheduled, what it remembers, how much you're spending, and whether it's healthy. You open it from Telegram with one tap.

### How the dashboard works

![Dashboard architecture](assets/dashboard-architecture.png)

When you start ClaudeClaw, a small web page starts running alongside the bot. It reads directly from the same database the bot uses and shows you the data in real time.

Here's what happens when you use it:

1. **You send `/dashboard` in Telegram**: the bot replies with a clickable link
2. **You tap the link**: a web page opens in your browser with four live panels
3. **The page updates itself every 60 seconds**: no need to refresh manually

By default, this web page only works on the same computer running the bot. If you want to open it from your phone while you're out, you can add a free tunnel (explained below).

**Nothing leaves your machine.** The dashboard reads your local database and shows it to you. No data is sent to any cloud service.

### What you'll see

At the top of the dashboard, a **summary stats bar** gives you an at-a-glance overview:

| Stat | What it shows |
|------|---------------|
| **Messages** | Total conversation turns today across all agents |
| **Agents** | How many agents are currently running vs. configured |
| **Cost Today** | Total API spend for the day |
| **Memories** | Total memories stored in the system |

Below that, the dashboard is organized into panels:

| Panel | What it shows you |
|-------|-------------------|
| **Agents** | Status cards for every configured agent. Shows live/off status, model, today's turns and cost. Click a card to see recent conversation, hive mind activity, and Start/Stop/Delete controls. **+ New Agent** button opens a 3-step wizard to create and activate a new agent directly from the dashboard. |
| **Hive Mind** | A real-time activity feed showing what each agent has been doing, with timestamps and color-coded agent names. Includes a privacy blur toggle. |
| **Tasks** | Unassigned mission tasks waiting to be routed. Create tasks with a title and prompt, then either drag them to an agent column or click **Auto-assign** to let Gemini classify and route them automatically. |
| **Mission Control** | A kanban board with one column per agent. Shows running and recently completed tasks per agent. Click **History** to open a paginated drawer of all completed tasks with full results. Completed tasks stay visible for 30 minutes, then move to history. |
| **Scheduled Tasks** | Recurring cron tasks. Shows status, next run countdown, last result. Pause, resume, or delete directly. |
| **Memory Landscape** | Total memories, consolidation insights, importance distribution chart. Sections for fading memories (salience < 0.5) and recently retrieved. Tap to browse all memories in a drill-down drawer. Includes a 30-day memory creation timeline. |
| **System Health** | Context window gauge (green/yellow/red), session age, compaction count, connection status for Telegram, WhatsApp, and Slack. |
| **Tokens & Cost** | Today's spend, all-time cost, 30-day cost timeline chart, cache hit rate chart. |

The dashboard also has a **live chat overlay**: a floating chat button that opens a real-time conversation panel. You can send messages to Claude directly from the dashboard and see responses stream in via SSE (Server-Sent Events). It shows tool progress in real time and has a stop button to abort queries mid-execution. Messages sent from the dashboard are also relayed to your Telegram chat.

On your phone it's a single scrollable page. On a computer it splits into two columns automatically.

### How to turn it on

#### Step 1: Generate a password for the dashboard

Open your terminal and paste this command:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

It prints a long random string like `a3f8c2d1e5b794...`. this is your dashboard password. **Copy it.** You'll need it in the next step.

#### Step 2: Add the password to your settings

Open the `.env` file in your ClaudeClaw folder. (This is the same file where your Telegram token and other keys live. Open it with any text editor. TextEdit on Mac, Notepad on Windows, or whatever your terminal editor is.)

Add this line:

```
DASHBOARD_TOKEN=paste_the_long_string_here
```

That's the only setting you need. There are two optional ones you can ignore for now:

```
DASHBOARD_PORT=3141          # the dashboard uses port 3141 by default. only change this if something else on your computer already uses that port
DASHBOARD_URL=               # leave this blank for now. you only fill this in if you set up phone access (Step 5 below)
```

Save the file.

#### Step 3: Rebuild and restart

```bash
npm run build
npm start
```

You should see a log line that says `Dashboard server running`. If you don't, double-check that `DASHBOARD_TOKEN` is in your `.env`.

#### Step 4: Open the dashboard

The easiest way: **send `/dashboard` to your bot in Telegram.** It replies with a clickable link. Tap it. Done.

Or open your browser and go to:
```
http://localhost:3141/?token=YOUR_TOKEN&chatId=YOUR_CHAT_ID
```
Replace `YOUR_TOKEN` with the password from Step 1, and `YOUR_CHAT_ID` with the `ALLOWED_CHAT_ID` from your `.env`.

**You're done.** The dashboard now works on the machine running the bot.

If that's all you need, stop here. The next step is only if you want to access the dashboard from your phone while away from home.

#### Step 5 (optional). Access from your phone anywhere

Right now the dashboard only works when you're on the same computer. To open it from your phone (or anywhere), you need a "tunnel". a free service that securely connects your computer to the internet without opening any ports.

**Option A: Quick tunnel** (free, takes 2 minutes, but the link changes every time you restart)

Best for trying it out:

```bash
# Install the tunnel tool (Mac)
brew install cloudflare/cloudflare/cloudflared

# On Linux, use: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
```

Start the tunnel:
```bash
cloudflared tunnel --url http://localhost:3141
```

It prints a URL like `https://something-random.trycloudflare.com`. Copy that URL, open your `.env` file, and set:
```
DASHBOARD_URL=https://something-random.trycloudflare.com
```

Restart the bot (`npm run build && npm start`). Now when you send `/dashboard` in Telegram, the link works from your phone.

**Downside:** The URL changes every time you restart the tunnel. You'll need to update `.env` each time.

**Option B: Permanent URL** (free, but you need to buy a cheap domain for $5-12/year)

This gives you a URL that never changes. like `https://dash.mysite.com`. You need a domain registered through Cloudflare. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Domain Registration → Register Domain. Cheapest options: `.work`, `.xyz`, `.site` (around $5-12/year).

Once you have a domain, run these commands one at a time:

```bash
# 1. Install the tunnel tool (skip if you already did this)
brew install cloudflare/cloudflare/cloudflared

# 2. Log in to Cloudflare (this opens your browser: pick your domain when asked)
cloudflared tunnel login

# 3. Create a tunnel (remember the ID it prints: you'll need it)
cloudflared tunnel create claudeclaw

# 4. Connect your domain to the tunnel (replace with your actual domain)
cloudflared tunnel route dns claudeclaw dash.yourdomain.com
```

Now you need to create a config file. Open your terminal and paste:

```bash
nano ~/.cloudflared/config.yml
```

This opens a text editor in the terminal. Paste the following (replace the two placeholder values with what the `tunnel create` command printed):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/yourname/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: dash.yourdomain.com
    service: http://localhost:3141
  - service: http_status:404
```

Save and exit (in nano: press `Ctrl+X`, then `Y`, then `Enter`).

Start the tunnel:
```bash
cloudflared tunnel run claudeclaw
```

Update your `.env`:
```
DASHBOARD_URL=https://dash.yourdomain.com
```

Restart the bot. Your permanent dashboard URL is now live.

**First time?** The secure certificate can take 1-5 minutes to activate on a brand new domain. If your browser shows an error page, wait a couple minutes and refresh.

To make the tunnel start automatically when your computer boots:
```bash
brew services start cloudflared
```

**Moving to a new machine later?** Copy two files from the old machine: `~/.cloudflared/config.yml` and the `.json` credentials file next to it. Run `cloudflared tunnel run claudeclaw` on the new machine. Same URL, no changes needed.

### Things to know

- **The dashboard link contains your password.** Treat it like you'd treat a password. Don't screenshot the address bar and post it somewhere. The dashboard can only show data (nobody can change or delete anything through it), but your task details and memory content would be visible.
- **If the bot stops, the dashboard stops.** They run together. Restart the bot and the dashboard comes back automatically.
- **Quick tunnel links are temporary.** If you used Option A and restart the tunnel tool, you get a new URL and the old one stops working. Option B (permanent URL) doesn't have this problem.
- **For extra security:** Cloudflare Access (free for up to 50 users) can add a login page in front of the dashboard, so even if someone finds the URL they'd need to authenticate. This is optional. the token alone is fine for personal use.

<details>
<summary><strong>Dashboard API reference (for developers)</strong></summary>

All endpoints require `?token=YOUR_TOKEN`. Per-user endpoints also need `&chatId=YOUR_CHAT_ID`.

| Endpoint | Returns |
|----------|---------|
| `GET /` | Dashboard HTML page |
| `GET /api/tasks` | All scheduled tasks |
| `GET /api/memories?chatId=` | Memory stats, fading list, top accessed, timeline |
| `GET /api/memories/list?chatId=&sector=&limit=&offset=` | Paginated memory drill-down |
| `GET /api/health?chatId=` | Context gauge, session stats, connections |
| `GET /api/tokens?chatId=` | Cost stats, 30-day timeline, cache rate |
| `GET /api/info` | Bot name, username, PID |
| `GET /api/chat/stream` | SSE stream for real-time chat events (user messages, assistant responses, tool progress) |
| `GET /api/chat/history?chatId=&limit=&beforeId=` | Paginated conversation history |
| `POST /api/chat/send` | Send a message from the dashboard (`{"message": "..."}`) |
| `POST /api/chat/abort` | Abort the current agent query |

</details>

---

## Slack (optional)

Requires a Slack User OAuth Token. This connects to your workspace so ClaudeClaw can read and send messages on your behalf.

### Step 1: Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click the green **Create New App** button (top right)
3. In the popup, choose **From scratch** (not "From an app manifest")
4. Fill in:
   - **App Name**: anything you want (e.g. `ClaudeClaw`)
   - **Pick a workspace**: select the Slack workspace you want to connect
5. Click **Create App**

You'll land on the **Basic Information** page for your new app.

### Step 2: Add User Token Scopes

This is the critical step. You need to add permissions so the app can read and send messages as you.

1. In the **left sidebar**, click **OAuth & Permissions**
2. Scroll down past "OAuth Tokens for Your Workspace" until you see the **Scopes** section
3. You'll see two subsections: **Bot Token Scopes** and **User Token Scopes**
4. **Ignore Bot Token Scopes entirely.** Click **Add an OAuth Scope** under **User Token Scopes**
5. Add each of these scopes one at a time (click **Add an OAuth Scope**, type the name, select it):

   | Scope | Description |
   |-------|-------------|
   | `channels:history` | View messages and other content in public channels |
   | `channels:read` | View basic information about public channels in a workspace |
   | `chat:write` | Send messages on a user's behalf |
   | `groups:history` | View messages and other content in private channels |
   | `groups:read` | View basic information about private channels |
   | `im:history` | View messages and other content in direct messages |
   | `im:read` | View basic information about direct messages |
   | `mpim:history` | View messages and other content in group direct messages |
   | `mpim:read` | View basic information about group direct messages |
   | `search:read` | Search a workspace's content |
   | `users:read` | View people in a workspace |

   After adding all 11, your User Token Scopes section should show all of them listed.

### Step 3: Install the app to your workspace

1. Scroll back up to the top of the **OAuth & Permissions** page
2. Under **OAuth Tokens for Your Workspace**, click **Install to Workspace**
3. Slack will show a permissions screen listing everything the app can do
4. Click **Allow**
5. You'll be redirected back to the OAuth & Permissions page
6. You'll now see a **User OAuth Token** field with a token that starts with `xoxp-`
7. Click **Copy** to copy the token

### Step 4: Add the token to ClaudeClaw

1. Open your `.env` file in the ClaudeClaw project directory
2. Add the token:
   ```
   SLACK_USER_TOKEN=xoxp-your-token-here
   ```
3. Restart ClaudeClaw

### Step 5: Verify it works

Send `/slack` in your Telegram chat. You should see a numbered list of your recent Slack conversations with unread counts.

If you get "Slack not connected", double-check:
- The token starts with `xoxp-` (not `xoxb-` which is a bot token)
- The `.env` file has no extra spaces around the `=` sign
- You restarted ClaudeClaw after adding the token

### Using Slack from Claude Code (skill)

ClaudeClaw ships with a Slack CLI at `dist/slack-cli.js` and a matching skill in `skills/slack/`. To use Slack via natural language from any Claude Code session:

```bash
cp -r skills/slack ~/.claude/skills/slack
```

Then just say "check my slack" or "message Jane on slack saying hey" and Claude handles the rest.

### Slack CLI reference

```bash
cd /path/to/claudeclaw

node dist/slack-cli.js list              # List conversations with unread counts
node dist/slack-cli.js list --limit 10   # Limit results
node dist/slack-cli.js read <channel_id> # Read messages from a conversation
node dist/slack-cli.js send <channel_id> "message"  # Send a message
node dist/slack-cli.js send <channel_id> "reply" --thread-ts 1234.5678  # Thread reply
node dist/slack-cli.js search "jane"     # Find conversations by name
```

---

## WhatsApp (optional)

![WhatsApp bridge](assets/whatsapp-bridge.jpeg)

No API key needed. Uses your existing WhatsApp account via Linked Devices.

### Start the daemon

```bash
npx tsx scripts/wa-daemon.ts
```

A QR code prints. Open WhatsApp → Settings → Linked Devices → scan within 30 seconds. Session saves to `store/waweb/`. you only scan once.

### Use it from Telegram

```
/wa              list 5 most recent chats (unread first)
1                open chat #1, show last 10 messages
r <text>         reply to the open chat
r 2 <text>       quick-reply to chat #2 without opening it
```

### Incoming message notifications

When someone messages you on WhatsApp:
```
📱 John Smith. new message
/wa to view & reply
```

No content is forwarded automatically. You pull it on demand.

### How the outbox works

Messages you send via the bot go into a `wa_outbox` SQLite table. The daemon's outbox poller (every 3 seconds) picks them up and delivers them. If the daemon is temporarily down, messages queue and deliver when it comes back.

### Message security

All WhatsApp message bodies are **encrypted at rest** using AES-256-GCM before being written to the database. Even if someone accesses `store/claudeclaw.db` directly, message content is unreadable without the encryption key in your `.env`.

Messages are also **automatically deleted after 3 days**: The retention sweep runs on startup and every 24 hours, covering `wa_messages`, `wa_outbox`, and `wa_message_map`. This is enforced in code and cannot be bypassed without modifying `runDecaySweep()` in `src/memory.ts`.

The `store/` directory (database, WhatsApp session, logs) is gitignored with multiple layers of protection. It will never be committed to the repo.

---

## Memory

![ClaudeClaw memory system diagram](assets/memory-diagram.png)

ClaudeClaw has a structured memory system that extracts, consolidates, and recalls knowledge across all sessions. Everything is automatic.

### Layer 1. Session resumption

Every time you send a message, Claude Code resumes the same session using a stored session ID. This means Claude carries your full conversation history across messages without you re-sending anything. It's the same as if you never left the terminal.

Use `/newchat` to start a completely fresh session when you want a clean slate.

### Layer 2. Structured memory extraction (Gemini-powered)

After each conversation turn, Gemini Flash evaluates whether the exchange contains anything worth remembering long-term. If it does, it extracts structured data: a summary, entities, topics, connections to other memories, and an importance score (0.0 to 1.0). Only memories scoring 0.5+ are saved. This filters out noise like "ok thanks" or command acknowledgments.

Each memory also gets a vector embedding for semantic search.

**Importance tiers and decay:**

| Importance | What gets this score | Daily decay | Approximate lifespan |
|-----------|---------------------|------------|---------------------|
| 0.8 - 1.0 | Core identity, critical rules, strong preferences | 1% per day | ~460 days |
| 0.5 - 0.7 | Useful context, standing decisions, workflows | 2% per day | ~230 days |
| Below 0.5 | Not saved (filtered at extraction) | n/a | n/a |
| Pinned | Anything you mark as permanent | No decay | Forever |

Memories that are actually useful in conversations get a salience boost (+0.1 per use). Memories that surface but aren't relevant get penalized (-0.05). This feedback loop means the system learns what matters over time.

### Layer 3. Five-layer context injection

Before every message, five parallel searches build your memory context:

1. **Semantic vector search**: finds memories similar in meaning to your message (cosine similarity > 0.3)
2. **High-importance recall**: recent memories with importance >= 0.5
3. **Consolidation insights**: patterns detected across multiple memories (e.g., "User consistently prefers X over Y")
4. **Team activity**: what other agents have done in the last 24 hours (from the Hive Mind)
5. **Conversation history recall**: triggered when you say things like "remember when" or "what did we discuss"

The results are deduplicated and prepended to your message as a block Claude sees:

```
[Memory context]
Relevant memories:
- [0.8] User prefers short bullet replies over long paragraphs
- [0.6] Working on YouTube channel rebrand this week

Insights:
- User has strong communication preferences: concise, no fluff

[Team activity]
- [comms] 2h ago: Processed weekly email digest
[End memory context]
```

### Consolidation (every 30 minutes)

A background process finds patterns across unconsolidated memories: themes, contradictions, and connections. When a newer memory contradicts an older one, the older memory is superseded (importance reduced, marked as outdated). Consolidation insights surface in the memory context block.

Requires `GOOGLE_API_KEY` in your `.env` (Gemini Flash, costs ~$0.03/day).

### Commands

```
/memory    show the most recent memories stored for this chat
/forget    clear the current session (memories keep decaying naturally)
```

### Pinning memories

High-importance memories (0.8+) trigger a Telegram notification when saved, giving you a chance to pin them. Pinned memories never decay.

### Changing how memory works

**`src/memory-ingest.ts`**: controls what gets extracted and the importance threshold:
```typescript
// The Gemini extraction prompt defines what's worth remembering
// Importance threshold (default: 0.5) filters low-value memories
```

**`src/db.ts`**: controls decay constants:
```typescript
// importance >= 0.8: 0.99 multiplier (1% daily decay)
// importance >= 0.5: 0.98 multiplier (2% daily decay)
// pinned = 1: no decay
// Deleted when salience < 0.05
```

---

## Scheduled tasks

Tell Claude what you want, in plain language:

```
Every Monday at 9am, summarize AI news from the past week and send it to me
Every weekday at 8am, check my calendar and inbox and give me a briefing
Every 4 hours, check for new emails from clients and flag anything urgent
```

Claude creates and manages tasks via the built-in CLI. Manage them directly too:

```bash
node dist/schedule-cli.js list
node dist/schedule-cli.js create "summarize AI news" "0 9 * * 1"
node dist/schedule-cli.js pause <id>
node dist/schedule-cli.js delete <id>
```

| Cron pattern | Meaning |
|-------------|---------|
| `0 9 * * 1` | Every Monday at 9am |
| `0 8 * * 1-5` | Every weekday at 8am |
| `0 9 1 * *` | First of the month at 9am |
| `0 */4 * * *` | Every 4 hours |
| `0 7 * * *` | Every day at 7am |

---

## Mission Control

Mission Control lets you create one-shot tasks and assign them to any agent from the dashboard or via Telegram.

### How it works

1. **Create a task** from the dashboard (click "+ New") or tell your main agent: "have research look into X"
2. The task appears in the **Tasks inbox** on the dashboard, unassigned
3. **Assign it** by dragging it to an agent column, or click **Auto-assign** to let Gemini classify and route it to the best agent automatically
4. The target agent picks it up within 60 seconds, executes it, and sends the result to your Telegram chat
5. Completed tasks appear in the agent's column for 30 minutes, then move to the **History** drawer

### Auto-assign

When you click Auto-assign, Gemini Flash reads the task prompt and matches it against your agent descriptions (from their `agent.yaml` files). A task about "draft a reply to John's email" routes to the comms agent. A task about "research competitors" routes to the research agent. Costs about $0.0001 per classification.

### From Telegram

Your main agent can create mission tasks for other agents. Just say things like:
- "have research look into the top competitors in AI coding"
- "get ops to update the Stripe pricing"
- "ask comms to draft a reply to that partnership email"

The main agent creates the task via CLI and responds immediately. The target agent picks it up asynchronously.

### CLI

```bash
node dist/mission-cli.js create --agent research --title "Competitor analysis" "Full prompt here"
node dist/mission-cli.js list
node dist/mission-cli.js result <id>
node dist/mission-cli.js cancel <id>
```

Omit `--agent` to create an unassigned task (assign from dashboard).

### Safety

Mission tasks go through the same FIFO message queue as user messages and scheduled tasks. They can never collide with an active conversation. Each task runs in a fresh session and has a 10-minute timeout.

---

## Database

ClaudeClaw ships with SQLite and **creates everything automatically on first run**: No migrations, no setup, no external database server. File lives at `store/claudeclaw.db`.

**Schema:**

```sql
sessions          -- Claude Code session IDs, one per chat per agent
memories          -- Structured memories with importance, salience, embeddings
memories_fts      -- Virtual FTS5 table, auto-synced via triggers
consolidations    -- Insights synthesized across memories (patterns, contradictions)
scheduled_tasks   -- Cron-scheduled recurring tasks (per agent)
mission_tasks     -- One-shot async tasks for Mission Control
conversation_log  -- Full conversation turns (per agent, used by /respin)
token_usage       -- Per-turn token counts and cost tracking
hive_mind         -- Cross-agent activity log
inter_agent_tasks -- Real-time delegation tracking (@agent: syntax)
wa_message_map    -- Maps Telegram message IDs to WhatsApp chats
wa_outbox         -- Queued outgoing WhatsApp messages
wa_messages       -- Incoming WhatsApp message history (encrypted, 3-day retention)
slack_messages    -- Slack message history (encrypted, 3-day retention)
```

**Encryption:** WhatsApp and Slack message bodies are encrypted with AES-256-GCM before storage. The key lives in your `.env` as `DB_ENCRYPTION_KEY`. Raw `SELECT` queries on the `body` column will return ciphertext. Use the app's read functions to get decrypted content.

**Retention:** Messages in `wa_messages`, `wa_outbox`, `wa_message_map`, and `slack_messages` are auto-deleted after 3 days by `runDecaySweep()`.

Inspect it directly:

```bash
sqlite3 store/claudeclaw.db

SELECT summary, importance, salience FROM memories ORDER BY created_at DESC LIMIT 10;
SELECT * FROM scheduled_tasks;
SELECT title, status, assigned_agent FROM mission_tasks ORDER BY created_at DESC;
SELECT agent_id, action, summary FROM hive_mind ORDER BY created_at DESC LIMIT 10;
SELECT * FROM sessions;
```

---

## Customizing your assistant (CLAUDE.md)

`CLAUDE.md` is loaded into every Claude Code session. It's the personality and context file. the main thing to edit to make ClaudeClaw yours.

The sections that matter most:

**Personality rules**: Be specific. "No em dashes, ever" and "don't narrate what you're about to do, just do it" change behavior on every single message.

**Who you are**: What you do, your projects, your context. The more specific, the less you have to explain per message.

**Your environment**: File paths Claude should be able to reach without being told: your Obsidian vault, project directories, anything you reference regularly.

**Skills table**: Maps skill names to trigger phrases. This teaches Claude to invoke them automatically when you describe a task.

**Message format**: How responses should look in Telegram: tight and scannable, summary-first for long outputs, how to handle task lists.

---

## Customizing the ASCII art

The startup banner is in `banner.txt` at the project root. Replace it with anything or leave it empty. It's read fresh on every start.

---

## Skills to install

ClaudeClaw auto-loads every skill in `~/.claude/skills/`. Install a skill by copying its folder there.

### Bundled skills

ClaudeClaw ships with ready-to-use skills in the `skills/` directory. Copy any of these to activate them:

```bash
# Gmail: read, triage, reply, send, create filters
cp -r skills/gmail ~/.claude/skills/gmail

# Google Calendar: schedule meetings, check availability, send invites
cp -r skills/google-calendar ~/.claude/skills/google-calendar

# Slack: list conversations, read messages, send replies
cp -r skills/slack ~/.claude/skills/slack

# TLDR: summarize conversations and save as notes
cp -r skills/tldr ~/.claude/skills/tldr
```

**Gmail + Calendar require Google OAuth credentials.** See `.env.example` for the variables and each skill's `SKILL.md` for one-time setup instructions (create a Google Cloud project, enable the API, download credentials, run auth once).

**Slack requires a User OAuth Token.** See the [Slack setup section](#slack-optional) above for step-by-step instructions.

### Other recommended skills

- `todo`. read tasks from Obsidian or text files
- `agent-browser`. browse the web, fill forms, scrape data
- `maestro`. run multiple tasks in parallel with sub-agents

**For video analysis:**
- `gemini-api-dev`. published by Google, handles video/image/audio/text
  - Docs: [github.com/google-gemini/gemini-skills/.../gemini-api-dev/SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-api-dev/SKILL.md)
  - Install: copy the `gemini-api-dev` folder to `~/.claude/skills/`

Browse more: [github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)

---

## Configuration reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | From [@BotFather](https://t.me/botfather) |
| `ALLOWED_CHAT_ID` | Yes | Your chat ID. send `/chatid` to get it |
| `ANTHROPIC_API_KEY` | No | Pay-per-token instead of Max subscription |
| `GROQ_API_KEY` | No | Voice input. [console.groq.com](https://console.groq.com) |
| `ELEVENLABS_API_KEY` | No | Voice output. [elevenlabs.io](https://elevenlabs.io) |
| `ELEVENLABS_VOICE_ID` | No | Your ElevenLabs voice ID string |
| `GOOGLE_API_KEY` | No | Gemini. [aistudio.google.com](https://aistudio.google.com) |
| `SLACK_USER_TOKEN` | No | Slack User OAuth Token (starts with `xoxp-`) |
| `GOOGLE_CREDS_PATH` | No | Path to Google OAuth credentials.json (default: `~/.config/gmail/credentials.json`) |
| `GMAIL_TOKEN_PATH` | No | Path to Gmail OAuth token (default: `~/.config/gmail/token.json`) |
| `GCAL_TOKEN_PATH` | No | Path to Calendar OAuth token (default: `~/.config/calendar/token.json`) |
| `DASHBOARD_TOKEN` | No | 48-char hex token for dashboard access |
| `DASHBOARD_PORT` | No | Dashboard port (default: `3141`) |
| `DASHBOARD_URL` | No | Public URL if using Cloudflare Tunnel |
| `CLAUDE_CODE_OAUTH_TOKEN` | No | Override which Claude account is used |

---

## Available scripts

```bash
npm run setup     # Interactive setup wizard
npm run status    # Health check. env, bot, DB, service
npm run build     # Compile TypeScript → dist/
npm start         # Run compiled bot (production)
npm run dev       # Run with tsx, no build needed (development)
npm test          # Run test suite (vitest)
npm run typecheck # Type-check without compiling
```

---

## Is this compliant with Anthropic's Terms of Service?

**Yes.** On February 19, 2026, Anthropic published their [Legal and Compliance page](https://docs.anthropic.com/en/docs/legal-and-compliance) banning OAuth tokens in third-party tools. ClaudeClaw is not affected.

**What's banned:** Tools that extract your OAuth token and make API calls with it from third-party code. impersonating Claude Code without running it (e.g. the old OpenClaw).

**Why ClaudeClaw is different:** `@anthropic-ai/claude-agent-sdk`'s `query()` spawns the `claude` binary as a child process. That subprocess manages its own OAuth from `~/.claude/`. ClaudeClaw never reads or transmits your token. It runs Claude Code and reads the output. identical to `claude -p "message"` in a terminal.

| | ClaudeClaw | Token-extraction tools |
|---|---|---|
| Runs the official `claude` CLI | ✅ | ❌ |
| OAuth stays in `~/.claude/` | ✅ | ❌ |
| Uses Anthropic-published SDK | ✅ | ❌ |
| Single-user, personal machine | ✅ | ❌ |
| Anthropic telemetry intact | ✅ | ❌ |

For server or multi-user deployments, set `ANTHROPIC_API_KEY` to use pay-per-token billing.

---

## Security

ClaudeClaw has multiple security layers. Some are always on, others are opt-in. The setup wizard (`npm run setup`) configures all of them interactively.

### Always on

These protections are active in every ClaudeClaw installation, no configuration needed.

| Layer | What it does |
|-------|-------------|
| **Chat ID restriction** | `ALLOWED_CHAT_ID` locks the bot to a single Telegram account. Messages from any other user are silently dropped. |
| **Private chat only** | The bot rejects all group chats. Only private (1-on-1) conversations are accepted. |
| **Audit logging** | Every action (messages, commands, delegations, lock/unlock, blocked attempts) is recorded to the `audit_log` table in SQLite with timestamps, agent ID, and chat ID. |
| **DB file permissions** | The `store/` directory is set to `0700` and all database files to `0600` on startup (owner-only access). |
| **Message encryption** | WhatsApp and Slack message bodies are encrypted with AES-256-GCM before being written to the database. The key is stored in `.env` (gitignored). |
| **Message auto-purge** | A 3-day retention sweep runs on startup and every 24 hours, deleting all message data from `wa_messages`, `wa_outbox`, `wa_message_map`, and `slack_messages`. |

**`bypassPermissions` mode.** The bot runs Claude Code with `permissionMode: 'bypassPermissions'` because there is no terminal to approve tool-use prompts. Claude can execute any tool (shell commands, file reads, web requests) without confirmation. This is safe when the bot is locked to your chat ID on your own machine. Do not expose it to untrusted users.

### PIN lock (opt-in)

PIN lock adds a session gate. When enabled, the bot starts locked and ignores all messages until you send the correct PIN.

| Behavior | Detail |
|----------|--------|
| **Startup** | Bot starts locked. Send your PIN as a regular message to unlock. |
| **`/lock`** | Locks the session immediately. |
| **`/status`** | Shows current security status (locked/unlocked, idle timeout, kill phrase). |
| **Idle auto-lock** | If `IDLE_LOCK_MINUTES` is set, the session re-locks after that many minutes of inactivity. |

The PIN is stored as a salted SHA-256 hash. The plaintext never touches disk.

### Emergency kill switch (opt-in)

Set `EMERGENCY_KILL_PHRASE` to a unique phrase. Sending it immediately stops all ClaudeClaw launchd/systemd services and force-exits the process. This is a hard stop, not a lock. Use it if something goes wrong and you need everything shut down now.

The setup wizard can generate one for you, or you can choose your own.

### Security .env reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_CHAT_ID` | **Yes** | Your Telegram chat ID. Bot ignores all other users. |
| `DB_ENCRYPTION_KEY` | **Yes** | AES-256 key for message field encryption. Auto-generated on first run. |
| `SECURITY_PIN_HASH` | No | Salted SHA-256 hash of your PIN. Format: `salt:hash`. Setup wizard generates this. |
| `IDLE_LOCK_MINUTES` | No | Auto-lock after N minutes of inactivity. Only active when PIN is set. |
| `EMERGENCY_KILL_PHRASE` | No | Phrase that immediately kills all agents and exits. |

### Viewing the audit log

```bash
sqlite3 store/claudeclaw.db \
  "SELECT datetime(created_at,'unixepoch'), action, detail FROM audit_log ORDER BY created_at DESC LIMIT 20;"
```

Or view it in the dashboard via the API: `GET /api/audit?limit=50`.

### Other things to know

**WhatsApp daemon runs on localhost only.** The `wa-daemon` HTTP API (port 4242) and Chrome DevTools Protocol (port 9222) bind to `127.0.0.1`. They are not accessible from outside your machine, but any local process can reach them.

**`notify.sh` is called by Claude.** The notification script sends Telegram messages via `curl`. Since Claude has full shell access, it can call this script with any content. This is by design (progress updates), but prompt injection via external content could theoretically cause unexpected messages.

---

## Troubleshooting

**Bot doesn't respond**
- Check `ALLOWED_CHAT_ID` matches the number from `/chatid`
- Check logs: `tail -f /tmp/claudeclaw.log`
- Run `npm run status` for a full health check
- Verify Claude auth: `claude --version`
- **macOS:** Check if your Mac is showing "Node wants to access..." permission dialogs. The bot hangs until you click Allow. This is easy to miss if your Mac screen is off or in the background.

**Setup fails at bracket placeholders**
- `CLAUDE.md` ships with `[BRACKETED]` placeholder values like `[YOUR NAME]` and `[YOUR ASSISTANT NAME]`
- These **must** be replaced before the bot can work properly
- The setup wizard opens `CLAUDE.md` in your editor for this, but if you skip it or your editor doesn't save, edit it manually: open `CLAUDE.md` in any text editor, find/replace all `[BRACKETED]` values with your actual info
- You do **not** need to fill in every bracket. At minimum: `[YOUR ASSISTANT NAME]`, `[YOUR NAME]`, and `[PATH TO CLAUDECLAW]` (the full path to your claudeclaw directory)

**Git errors during setup**
- "Please tell me who you are". run `git config --global user.name "Your Name"` and `git config --global user.email "you@email.com"`
- Git needs these set once, globally, before it can do anything

**Can't access the internet / "break out"**
- ClaudeClaw runs the real Claude Code CLI, which has full internet access through its built-in tools (web search, web fetch, bash with curl, etc.)
- If Claude says it can't access the internet, it's likely a skill or prompt issue, not a ClaudeClaw limitation
- Make sure your Claude Code CLI works in the terminal first: open a terminal, run `claude`, and ask it to search the web

**Voice notes return an error**
- `GROQ_API_KEY` must be in `.env` and the bot restarted after adding it

**Voice replies not working**
- Both `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` must be set
- Voice ID is a string like `21m00Tcm4TlvDq8ikWAM`, not the voice name
- Either `/voice` mode must be on, or say "respond with voice" in your message

**WhatsApp not connecting**
- `wa-daemon` must be running separately: `npx tsx scripts/wa-daemon.ts`
- QR code expires after ~30s. kill and restart the daemon if it timed out
- To force re-authentication, delete `store/waweb/` and restart the daemon

**"409 Conflict: terminated by other getUpdates request"**
- Two instances running. Kill the old one: `kill $(cat store/claudeclaw.pid)`

**Session feels off or confused**
- Send `/newchat` for a fresh start

**File downloads fail**
- Telegram caps downloads at 20MB. this is a Telegram API limit, not a ClaudeClaw one

---

## Common confusions

**"Do I need the mega prompt / Rebuild_Prompt.md?"**
No. There is no separate prompt to execute and no `Rebuild_Prompt.md` file. `CLAUDE.md` in the repo **is** the prompt, it loads automatically into every Claude Code session. You personalize it once (replace the `[BRACKETED]` placeholders with your info) and forget about it. Just clone the repo, run setup, and go. When you `git pull` updates, your personalized `.env` stays untouched (gitignored) and `CLAUDE.md` changes are merged by git.

**"Does this use Claude Remote?"**
No. ClaudeClaw has nothing to do with Anthropic's Remote product. It runs the `claude` CLI locally on your own machine (Mac, Linux, or Windows via WSL2) and pipes results to Telegram. No cloud VMs, no remote sessions.

**"Does this work on Windows?"**
Yes, through WSL2. Install WSL2, clone ClaudeClaw inside the WSL filesystem, and follow the normal Linux setup steps. The setup wizard detects Windows and offers WSL2 or PM2 options.

**"What is GOOGLE_API_KEY for?"**
Video analysis via Google Gemini. It is **not** for Gmail or Google Calendar (those use separate OAuth credentials via the gmail and google-calendar skills). Get it free at [aistudio.google.com](https://aistudio.google.com).

**"Should I watch the Claude Code video first?"**
Recommended but not required. The video covers how Claude Code works under the hood, which helps you understand what ClaudeClaw is actually doing. But you can set up ClaudeClaw first and watch it later.

**"How do I update when a new version drops?"**
`cd claudeclaw && git pull && npm install && npm run migrate && npm run build` then restart. See [Updating ClaudeClaw](#updating-claudeclaw) above.

**"Telegram formatting looks broken / not formatting properly"**
ClaudeClaw converts Claude's Markdown to Telegram-safe HTML (bold, italic, code blocks, links). Telegram's formatting support is limited compared to a full web page. If something looks off, it's usually Telegram's rendering, not a bug. For very long or complex responses, the formatting is intentionally kept simple to avoid Telegram parse errors.

**"Can I add extra security like 2FA?"**
`ALLOWED_CHAT_ID` restricts the bot to your Telegram account, which is the default security layer. Community members have added Google Authenticator (TOTP) for tiered permissions (read-only vs elevated actions with time-limited re-auth). This isn't built in yet, but it's a straightforward addition to `handleMessage()` in `src/bot.ts` if you want that extra layer.

---

## Architecture

```mermaid
flowchart TD
    Phone["Telegram App"] -->|message| TGAPI["Telegram Bot API"]
    TGAPI -->|long-poll| Bot["bot.ts\n(grammy)"]

    Bot -->|voice note| STT["Groq Whisper\nTranscription"]
    Bot -->|photo / doc / video| DL["Media Download\nworkspace/uploads/"]
    STT --> Handler
    DL --> Handler
    Bot -->|text| Handler["handleMessage()"]

    Handler -->|"5-layer retrieval"| Mem["Memory Layer\nVector + FTS5 + Gemini"]
    Mem -->|context block| Agent

    Handler -->|"@agent: syntax"| Orch["orchestrator.ts\nAgent delegation"]
    Orch -->|route to agent| Agent

    Agent["agent.ts\nClaude Agent SDK"] -->|spawns subprocess| CC["claude CLI\n~/.claude/ auth"]
    CC -->|loads| Config["CLAUDE.md\n+ ~/.claude/skills/"]
    CC -->|uses| Tools["Bash · Web · MCP\nFile system · APIs"]
    CC -->|result| Agent

    Agent --> Format["Format + Split\nMarkdown to HTML"]
    Format -->|reply| TGAPI

    Sched["Scheduler\ncron + mission tasks"] -->|every 60s| Agent
    WA["WhatsApp daemon\n:4242"] --> Bot
    Dashboard["Dashboard\nHono + SSE"] --> Bot
    Mission["Mission Control\nTasks inbox + kanban"] --> Sched

    DB[("SQLite\nstore/claudeclaw.db")] --- Mem
    DB --- Sched
    DB --- WA
    DB --- Dashboard
    DB --- Mission

    Gemini["Gemini API\nextraction + auto-assign"] --- Mem
    Gemini --- Mission
```

---

## Project structure

```
claudeclaw/
│
│  ← Files you'll actually touch
├── CLAUDE.md             ← START HERE: your assistant's personality and context
├── banner.txt            ← ASCII art shown on startup. edit or replace freely
├── .env                  ← Your API keys (created by setup wizard, gitignored)
│
│  ← Configuration and setup
├── .env.example          Template for .env. shows all available variables
├── claudeclaw.plist      macOS LaunchAgent template (setup wizard uses this)
├── package.json          npm scripts and dependencies
├── tsconfig.json         TypeScript compiler config
│
│  ← Bot source code (src/)
├── src/
│   ├── index.ts             Main entrypoint. starts everything
│   ├── bot.ts               Handles all Telegram messages (text, voice, photo, etc.)
│   ├── agent.ts             Runs Claude Code via Agent SDK
│   ├── agent-config.ts      Loads agent YAML configs and CLAUDE.md templates
│   ├── orchestrator.ts      Agent delegation routing (@agent: syntax)
│   ├── db.ts                SQLite database. all tables and queries
│   ├── memory.ts            5-layer context injection and memory feedback
│   ├── memory-ingest.ts     Gemini-powered memory extraction from conversations
│   ├── memory-consolidate.ts Pattern detection across memories (every 30 min)
│   ├── embeddings.ts        Vector embeddings for semantic memory search
│   ├── gemini.ts            Gemini API client (extraction, classification)
│   ├── scheduler.ts         Cron + mission task runner. checks every 60 seconds
│   ├── schedule-cli.ts      CLI for managing scheduled tasks
│   ├── mission-cli.ts       CLI for creating/managing mission tasks
│   ├── voice.ts             Voice transcription (Groq) and synthesis (ElevenLabs)
│   ├── media.ts             Downloads files from Telegram, cleans up after 24h
│   ├── slack.ts             Slack API client (conversations, messages, send)
│   ├── slack-cli.ts         CLI wrapper for Slack (used by the slack skill)
│   ├── whatsapp.ts          WhatsApp client via whatsapp-web.js
│   ├── dashboard.ts         Web dashboard server (Hono + API routes + token auth)
│   ├── dashboard-html.ts    Dashboard HTML/CSS/JS (Tailwind + Chart.js, no build step)
│   ├── state.ts             Shared state and SSE event emitter
│   ├── message-queue.ts     Per-chat FIFO queue (prevents session collisions)
│   ├── config.ts            Reads .env safely (never pollutes process.env)
│   ├── env.ts               Low-level .env file parser
│   ├── obsidian.ts          Obsidian vault context injection (per agent)
│   └── logger.ts            Structured logging via pino
│
│  ← Skills (copy to ~/.claude/skills/ to activate)
├── skills/
│   ├── gmail/SKILL.md     Gmail inbox management
│   ├── google-calendar/   Calendar events, invites, availability
│   └── slack/SKILL.md     Slack conversations and messages
│
│  ← Scripts (scripts/)
├── scripts/
│   ├── setup.ts          Interactive setup wizard. run with: npm run setup
│   ├── status.ts         Health check. run with: npm run status
│   ├── notify.sh         Sends a Telegram message from the shell (used by Claude)
│   └── wa-daemon.ts      WhatsApp daemon. run separately for WhatsApp bridge
│
│  ← Runtime data (auto-created, gitignored)
├── store/
│   ├── claudeclaw.db     SQLite database. created automatically on first run
│   ├── claudeclaw.pid    Tracks the running process to prevent duplicates
│   └── waweb/            WhatsApp session. scan QR once, persists here
│
└── workspace/
    └── uploads/          Telegram media downloads. auto-deleted after 24 hours
```

**The only files you need to edit to get started:**
1. `CLAUDE.md`. fill in your name, what you do, your file paths, your skills
2. `.env`. add your API keys (the setup wizard does this for you)

Everything else runs without modification.

---

## Creating a team of agents

ClaudeClaw can run **specialist agents** alongside the main bot. Each agent is its own Telegram bot with its own personality, its own Claude Code session, and its own chat on your phone.

![Agent avatars](assets/agent-comms.png) ![Agent avatars](assets/agent-content.png) ![Agent avatars](assets/agent-ops.png) ![Agent avatars](assets/agent-research.png)

*Example setup: Comms, Content, Ops, and Research agents, each with a pop-art avatar generated via Gemini.*

![Multi-agent architecture](assets/multi-agent-architecture.png)

### Why agents?

Your main ClaudeClaw bot does everything. That's powerful but also means one long conversation, one context window, and one personality trying to handle email, research, billing, and content all at once.

Agents let you split the work:

| What | Main bot | Specialist agents |
|------|----------|-------------------|
| Context window | Shared across all tasks | Each gets its own 1M window |
| Personality | General purpose | Focused CLAUDE.md per role |
| Model | Opus (default) | Sonnet (cheaper, fast enough for routine work) |
| Scheduled tasks | All fire in one process | Scoped per agent |
| Obsidian context | Optional | Auto-injected from assigned vault folders |
| Cost | Full Opus pricing | Sonnet by default, /model opus when needed |

All agents share your machine, your SQLite database, your global skills (`~/.claude/skills/`), and your `.env` secrets. A **hive mind** table lets agents log what they did so any agent (or the main bot) can see cross-agent activity.

**This is 100% optional.** `npm start` with no flags works exactly like before. Zero breaking changes.

### Step 1: Decide what agents you want

Think about the roles that make sense for your workflow. Here are the templates we ship:

| Template | What it handles | Default model |
|----------|----------------|---------------|
| `comms` | Email, Slack, WhatsApp, YouTube comments, community forums, LinkedIn DMs | Sonnet |
| `content` | YouTube scripts, LinkedIn posts, carousels, trend research | Sonnet |
| `ops` | Calendar, billing, Stripe, Gumroad, admin, task management | Sonnet |
| `research` | Deep web research, academic sources, competitive intel | Sonnet |

You can start with one and add more later. Or use the blank `_template` and define your own role entirely.

### Step 2: Create Telegram bots

Each agent needs its own Telegram bot. Open Telegram and message **@BotFather**:

1. Send `/newbot`
2. Choose a name (e.g., "MyName Comms", "MyName Ops")
3. Choose a username ending in `_bot` (e.g., `yourname_comms_bot`)
4. Copy the token BotFather gives you

Repeat for each agent you want. Keep the tokens handy.

**Or use the interactive wizard:**

```bash
npm run agent:create
```

It walks you through template selection, bot creation, token setup, and a test start.

### Step 3: Configure each agent

For each agent, you need two files in `agents/<name>/`:

**agent.yaml** -- the agent's config:
```yaml
name: Comms
description: Email, Slack, WhatsApp, YouTube comments, community forums, LinkedIn
telegram_bot_token_env: COMMS_BOT_TOKEN
model: claude-sonnet-4-6

# Optional: auto-inject open tasks from your Obsidian vault
obsidian:
  vault: /path/to/your/obsidian/vault
  folders:
    - Inbox/
    - Client Work/
  read_only:
    - Daily Notes/
```

**CLAUDE.md** -- the agent's personality and instructions:
```markdown
# Comms Agent

You handle all human communication on the user's behalf.
[... focused instructions for this role ...]
```

Add the bot token to `.env`:
```
COMMS_BOT_TOKEN=1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Start your agents

You have two options: run agents in foreground terminals (great for testing), or install them as persistent background services with `launchd` (recommended for daily use).

#### Option A: Foreground (testing / debugging)

Open a new terminal tab for each agent:

```bash
npm start -- --agent comms      # Terminal 1
npm start -- --agent content    # Terminal 2
npm start -- --agent ops        # Terminal 3
npm start -- --agent research   # Terminal 4
```

Each will show:
```
ClaudeClaw agent [comms] online: @yourname_comms_bot
```

Your main bot keeps running in its own terminal as usual (`npm start`). Close the terminal and the agent dies.

#### Option B: Background services with launchd (recommended)

**What is launchd?** On macOS, `launchd` is the system's built-in service manager (like `systemd` on Linux). It starts your agents automatically when you log in, and if an agent crashes, launchd restarts it within 30 seconds. No open terminals needed. Your agents just run.

**Why this is better than running terminals:**
- Agents **survive reboots** -- they start automatically when you log in
- Agents **auto-restart on crash** -- if one dies, launchd brings it back
- **No open terminal tabs** -- they run invisibly in the background
- **One command** installs everything -- main bot + all agents at once

**Install all agents with one command:**

```bash
bash scripts/install-launchd.sh
```

This script:
1. Builds the project (`npm run build`)
2. Removes any stale/orphaned agents from previous installs
3. Copies each agent's `.plist` config to `~/Library/LaunchAgents/`
4. Loads them into launchd (they start immediately)
5. Verifies all agents are running and shows their PIDs

After installation you'll see:
```
com.claudeclaw.main:     running (PID: 12345)
com.claudeclaw.comms:    running (PID: 12346)
com.claudeclaw.content:  running (PID: 12347)
com.claudeclaw.ops:      running (PID: 12348)
com.claudeclaw.research: running (PID: 12349)

All agents installed and running.
```

**Useful commands after install:**

```bash
# Check which agents are running
launchctl list | grep claudeclaw

# View logs for a specific agent
tail -f logs/main.log
tail -f logs/comms.log

# Restart a single agent (e.g., after code changes)
launchctl unload ~/Library/LaunchAgents/com.claudeclaw.comms.plist
launchctl load ~/Library/LaunchAgents/com.claudeclaw.comms.plist

# Restart ALL agents after a rebuild
npm run build
for agent in main comms ops content research; do
  launchctl unload ~/Library/LaunchAgents/com.claudeclaw.$agent.plist 2>/dev/null
  launchctl load ~/Library/LaunchAgents/com.claudeclaw.$agent.plist
done

# Remove all agents (stop everything)
bash scripts/uninstall-launchd.sh
```

**How the plist files work:** Each agent has a `.plist` file in the `launchd/` directory that tells macOS how to run it. These are XML config files that specify the command, working directory, environment variables, and log paths. You shouldn't need to edit them unless you're adding a custom agent -- the install script handles everything.

**Logs:** Each agent writes stdout and stderr to `logs/<agent-name>.log`. These files grow over time; you can safely truncate them with `> logs/comms.log` if they get large.

**Linux users:** launchd is macOS-only. On Linux, use `systemd` or run agents with `pm2` / `screen` / `tmux`. The same `npm start -- --agent comms` command works everywhere.

### Step 5: Message your agents

Open each agent's chat in Telegram and send `/start`. They'll respond with their name and role. From there, use them like you use the main bot -- voice notes, photos, files, slash commands -- everything works.

### What each agent gets automatically

Every agent runs the exact same `createBot()` code path as the main bot. There's no "lite" agent mode -- they inherit everything with zero extra config:

- Voice notes (STT via Groq, TTS via ElevenLabs/Gradium/macOS say)
- Photo, document, and video handling (including Gemini video analysis)
- File sending (`[SEND_FILE:...]` markers)
- All built-in slash commands: /newchat, /respin, /voice, /model, /memory, /stop, /wa, /slack
- All global skills from `~/.claude/skills/` (auto-discovered and registered in each bot's Telegram command menu)
- Memory system (FTS5 search, salience decay) -- isolated per agent
- Context window tracking and compaction warnings
- WhatsApp and Slack integration

**Inheritance works like this:** agents and the main bot share the same compiled codebase (`dist/`), the same SQLite database, the same `.env` secrets, and the same global skills directory (`~/.claude/skills/`). Each agent just has its own Telegram bot token, its own `CLAUDE.md` personality, and its own session state.

This means when you:
- **Install a new skill** to `~/.claude/skills/` -- every agent picks it up on restart, including its `/slash` command in Telegram's menu
- **Change code and rebuild** (`npm run build`) -- every agent picks up the changes on restart
- **Add a new `.env` variable** -- every agent can use it on restart

**Restarting agents after changes:**

Agents load code and skills at startup. Rebuilding `dist/` or adding skills doesn't hot-reload running processes. You need to restart:

```bash
# Rebuild first
npm run build

# If running via launchd (recommended): reload each agent
for agent in main comms ops content research; do
  launchctl unload ~/Library/LaunchAgents/com.claudeclaw.$agent.plist 2>/dev/null
  launchctl load ~/Library/LaunchAgents/com.claudeclaw.$agent.plist
done

# If running in terminals: Ctrl+C each agent, then restart
npm start -- --agent comms
npm start -- --agent content

# Or re-run the install script (rebuilds + restarts everything)
bash scripts/install-launchd.sh
```

**Note:** After restarting, Telegram may cache the old command menu for a few minutes. Force-close and reopen Telegram on your phone to see updated `/` commands immediately.

### Obsidian auto-injection

If you use Obsidian, agents can be assigned vault folders. Open tasks (`- [ ]` lines) from those folders are automatically prepended to every message -- the agent just knows what's on your plate without you having to say anything.

```yaml
# In agent.yaml
obsidian:
  vault: ~/ObsidianVault
  folders:
    - Client Work/       # agent can read and reference
    - Inbox/
  read_only:
    - Daily Notes/       # reference only
```

What the agent sees before every message:
```
[Obsidian context]
  Client Work//
    Open: Send proposal to Acme Corp (Acme Deal)
    Open: Follow up on invoice #42 (Billing)
  Inbox//
    Open: Get back to Brock about podcast (Podcast Invite)
[End Obsidian context]
```

Scanned every 5 minutes (cached), only open tasks, only from assigned folders. Lightweight -- typically 200-500 tokens.

### Hive mind

When an agent completes a meaningful action, it logs it to the shared `hive_mind` table. Any agent can query what others have done:

```sql
SELECT agent_id, action, summary, datetime(created_at, 'unixepoch')
FROM hive_mind ORDER BY created_at DESC LIMIT 20;
```

The dashboard shows the hive mind feed in real-time across all agents.

### Agent-scoped scheduled tasks

Cron jobs belong to the agent that creates them. A task created in the comms agent only fires in the comms agent's process:

```bash
# Create a task for the comms agent
node dist/schedule-cli.js create "check youtube comments" "0 */4 * * *" --agent comms

# List tasks for a specific agent
node dist/schedule-cli.js list --agent comms
```

### The dashboard with agents

When agents are configured, the dashboard adds panels at the top:

- **Summary Stats Bar** -- messages today, active agents count, today's cost, total memories
- **Agent Status Cards** -- each agent with a color-coded status (live/offline), model, today's turns and cost
- **Hive Mind Feed** -- timestamped cross-agent activity table, color-coded by agent, with full summary text that wraps cleanly

All existing dashboard panels (tasks, memory, health, tokens, chat) continue to work as before.

### Create your own agent

There are three ways to create an agent. Pick whichever fits your workflow.

#### Option A: Dashboard wizard (recommended)

Click **"+ New Agent"** in the Agents section of the dashboard. The wizard walks you through three steps:

1. **Basics** -- pick an agent ID, display name, description, model, and template
2. **Connect Telegram** -- the wizard suggests a bot name and username for BotFather, then you paste the token. It validates the token live against the Telegram API and shows the resolved `@username` on success.
3. **Activate** -- creates the agent directory, writes `agent.yaml` and `CLAUDE.md`, saves the bot token to `.env`, generates a launchd/systemd service config, and optionally starts the agent immediately.

Available templates: `comms`, `content`, `ops`, `research`, and `blank` (the default `_template`). The template dropdown is populated from `agents/` on disk, so any custom template directories you add will appear automatically.

#### Option B: CLI

The `agent-create-cli` handles everything non-interactively. Useful for scripting or when the dashboard isn't running.

```bash
# Create and activate in one shot
node dist/agent-create-cli.js \
  --id analytics \
  --name "Analytics" \
  --description "Data analysis and reporting" \
  --template research \
  --token "123456789:ABCdef..." \
  --activate

# Validate a token without creating anything
node dist/agent-create-cli.js --validate --token "123456789:ABCdef..."

# List available templates
node dist/agent-create-cli.js --templates

# Get suggested BotFather names for an ID
node dist/agent-create-cli.js --suggest --id analytics
```

Flags:

| Flag | Required | Description |
|------|----------|-------------|
| `--id` | Yes | Lowercase identifier (letters, numbers, hyphens, underscores) |
| `--name` | Yes | Display name shown in the dashboard and logs |
| `--description` | Yes | What this agent does |
| `--token` | Yes | Telegram bot token from @BotFather |
| `--model` | No | Claude model (default: `claude-sonnet-4-6`) |
| `--template` | No | Template to clone from (default: `_template`) |
| `--activate` | No | Install launchd/systemd service and start immediately |

The CLI validates the bot token against the Telegram API before creating anything. If validation fails, it exits with a non-zero code and no files are written.

#### Option C: Manual setup (advanced)

If you prefer full control, create the files yourself:

```bash
# 1. Copy the template
cp -r agents/_template agents/myagent

# 2. Edit the personality
vim agents/myagent/CLAUDE.md

# 3. Create agent.yaml from the example
cp agents/myagent/agent.yaml.example agents/myagent/agent.yaml
vim agents/myagent/agent.yaml

# 4. Create a bot via @BotFather, add token to .env
echo "MYAGENT_BOT_TOKEN=your_token_here" >> .env

# 5. Build and start
npm run build
npm start -- --agent myagent
```

With the manual approach you also need to create launchd/systemd configs yourself if you want the agent to run as a background service. The dashboard wizard and CLI handle this automatically.

### Profile pictures

Use any image generation tool (Gemini, DALL-E, Midjourney) to create pop-art or branded avatars for your agents. Set them via the Telegram Bot API:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setMyProfilePhoto" \
  -F 'photo={"type":"static","photo":"attach://file"}' \
  -F "file=@assets/agent-comms.png"
```

### Resource usage

5 Node.js processes (main + 4 agents) use ~500MB RAM total at idle. Each `runAgent()` call spawns a separate Claude Code subprocess that exits when done. SQLite WAL mode handles concurrent access from all processes with no contention.

---

## Other channels

The same `runAgent()` pattern in `src/agent.ts` works on any channel:

- **[NanoClaw](https://github.com/qwibitai/nanoclaw)**: WhatsApp, isolated Linux containers
- **[OpenClaw](https://github.com/openclaw/openclaw)**: Telegram, WhatsApp, Slack, Discord, iMessage, Signal, and more
- **[TinyClaw](https://github.com/jlia0/tinyclaw)**: ~400 lines of shell, Claude Code + tmux, zero dependencies

---

## License

MIT
