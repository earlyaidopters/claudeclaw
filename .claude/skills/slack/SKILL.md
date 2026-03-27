---
name: slack
description: Manage Slack from Claude Code. List conversations, read messages, send replies, search for channels and DMs.
allowed-tools: Bash(cd * && node dist/slack-cli.js *)
---

# Slack Skill

## Purpose

Interact with your Slack workspace using natural language from Claude Code.

## Prerequisites

You need a `SLACK_USER_TOKEN` in your ClaudeClaw `.env` file. If you haven't set this up yet, follow these steps:

### Getting your Slack User OAuth Token

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch** (not "From an app manifest")
3. Name it (e.g. `ClaudeClaw`), select your workspace, click **Create App**
4. In the **left sidebar**, click **OAuth & Permissions**
5. Scroll down to the **Scopes** section. You'll see **Bot Token Scopes** and **User Token Scopes**
6. **Ignore Bot Token Scopes.** Under **User Token Scopes**, click **Add an OAuth Scope** and add all of these:

   - `channels:history` — View messages in public channels
   - `channels:read` — View basic info about public channels
   - `chat:write` — Send messages on your behalf
   - `groups:history` — View messages in private channels
   - `groups:read` — View basic info about private channels
   - `im:history` — View direct messages
   - `im:read` — View basic info about DMs
   - `mpim:history` — View group direct messages
   - `mpim:read` — View basic info about group DMs
   - `search:read` — Search workspace content
   - `users:read` — View people in the workspace

7. Scroll back up, click **Install to Workspace**, then click **Allow**
8. Copy the **User OAuth Token** (starts with `xoxp-`)
9. Add to your `.env`: `SLACK_USER_TOKEN=xoxp-your-token-here`

## Setup

The CLI lives at the ClaudeClaw project root. All commands must run from the project directory (the CLI reads `.env` from `cwd`):

```bash
cd /path/to/claudeclaw && node dist/slack-cli.js <command>
```

## Commands

### List conversations (with unread counts)

```bash
cd /path/to/claudeclaw && node dist/slack-cli.js list
cd /path/to/claudeclaw && node dist/slack-cli.js list --limit 10
```

Returns JSON array of conversations sorted by unread count then recency. Each object has: `id`, `name`, `isIm`, `unreadCount`, `lastMessage`, `lastMessageTs`.

### Read messages from a conversation

```bash
cd /path/to/claudeclaw && node dist/slack-cli.js read <channel_id>
cd /path/to/claudeclaw && node dist/slack-cli.js read <channel_id> --limit 30
```

Returns JSON array of messages (oldest first). Each object has: `text`, `userName`, `fromMe`, `ts`, `threadTs`.

### Send a message

```bash
cd /path/to/claudeclaw && node dist/slack-cli.js send <channel_id> "message text"
cd /path/to/claudeclaw && node dist/slack-cli.js send <channel_id> "reply text" --thread-ts 1234567890.123456
```

### Search conversations by name

```bash
cd /path/to/claudeclaw && node dist/slack-cli.js search "jane"
cd /path/to/claudeclaw && node dist/slack-cli.js search "general"
```

Fuzzy matches against conversation names. Use this to find channel IDs when you need to message someone or read a channel.

## Workflow

1. **"Check my slack"** -> Run `list` to show conversations with unread counts
2. **"Read my DMs with Jane"** -> Run `search "jane"` to find the channel ID, then `read <id>`
3. **"Message Jane on Slack saying hey"** -> Run `search "jane"` to find the channel ID, draft the message, show the user for confirmation, then `send <id> "hey"`
4. **"What's new in #general"** -> Run `search "general"` to find the channel ID, then `read <id>`

## Drafting Rules

- ALWAYS draft the message and show it to the user before sending
- Never send without confirmation
- If the user gives exact phrasing, use it verbatim
