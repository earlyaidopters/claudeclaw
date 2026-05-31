# Local setup notes

Record of one-time setup for integrating Obsidian, GitHub SSH auth, and the
kepano/obsidian-skills bundle into this ClaudeClaw install. Machine-specific
values (tokens, PINs, chat IDs) are NOT stored here — see `.env` for those.

## 1. Obsidian vault

ClaudeClaw itself is not an Obsidian vault. Agents read from the existing
personal vault instead.

- Active vault: `Obsidian Brain`
- Path: `~/Documents/Claude/Obsidian Brain/Obsidian Brain`
- Obsidian app registry: `~/Library/Application Support/obsidian/obsidian.json`

If the repo root ever gets an empty `.obsidian/` folder (from accidentally
opening the project in Obsidian), remove it:

```bash
rmdir .obsidian
```

## 2. GitHub SSH authentication

An `ed25519` key was generated and registered with GitHub.

- Private key: `~/.ssh/id_ed25519`
- Public key: `~/.ssh/id_ed25519.pub`
- Auto-load config: `~/.ssh/config` sets `UseKeychain yes` and
  `AddKeysToAgent yes` for `github.com`, so the key is loaded from the macOS
  Keychain on every new shell without manual `ssh-add`.

Verification command:

```bash
ssh -T git@github.com
# Expected: "Hi <username>! You've successfully authenticated, ..."
# (exit code 1 is normal — GitHub denies shell access)
```

## 3. Skills: kepano/obsidian-skills

Installed via `npx skills add git@github.com:kepano/obsidian-skills.git`.

Filesystem layout:

```
.agents/skills/<skill>/SKILL.md    # real files (installed by `skills`)
.claude/skills/<skill>             # symlinks to ../../.agents/skills/<skill>
~/.claude/skills/<skill>           # symlinks to .agents/skills/<skill>
```

The user-level symlinks in `~/.claude/skills/` are required for ClaudeClaw's
agent auto-discovery. Recreate them with:

```bash
mkdir -p ~/.claude/skills
for s in defuddle json-canvas obsidian-bases obsidian-cli obsidian-markdown; do
  ln -sf "$(pwd)/.agents/skills/$s" "$HOME/.claude/skills/$s"
done
```

### Skill summary

| Skill | Type | External dependency |
|---|---|---|
| `defuddle` | CLI-backed | `npm i -g defuddle` (binary: `~/.npm-global/bin/defuddle`) |
| `json-canvas` | Authoring (JSON Canvas 1.0) | none |
| `obsidian-bases` | Authoring (`.base` YAML) | none |
| `obsidian-cli` | CLI-backed | `obsidian` binary at `/usr/local/bin/obsidian`, Obsidian app must be running |
| `obsidian-markdown` | Authoring (Obsidian-flavored MD) | none |

None are marked `user_invocable: true`, so they do not register as Telegram
slash commands. Claude invokes them automatically from message content.

### Reinstall / update

```bash
npx -y skills add -y git@github.com:kepano/obsidian-skills.git
```

The command is idempotent — re-running it refreshes all installed skills and
recreates symlinks.

## 4. Agent vault integration

All agent template files (`agents/<role>/agent.yaml.example` and
`agents/_template/agent.yaml.example`) were updated to reference the real
vault path:

```yaml
obsidian:
  vault: /Users/dantecrescenzi/Documents/Claude/Obsidian Brain/Obsidian Brain
  folders:
    - Clippings/   # only folder that exists today
```

The `comms` agent was initialized (`agents/comms/agent.yaml` copied from its
`.example`). Remaining agents still have only `.example` files — copy + edit
to activate them.

Before starting a new agent, ensure its bot token env var is in `.env`:

```
COMMS_BOT_TOKEN=...
CONTENT_BOT_TOKEN=...
OPS_BOT_TOKEN=...
RESEARCH_BOT_TOKEN=...
```

The main process (`com.claudeclaw.app`) loads every configured agent on
startup. Restart it with:

```bash
launchctl unload ~/Library/LaunchAgents/com.claudeclaw.app.plist
launchctl load ~/Library/LaunchAgents/com.claudeclaw.app.plist
```

Logs: `/tmp/claudeclaw.log` (stdout) and `/tmp/claudeclaw.err` (stderr).

## 5. PATH requirements for launchd

The launchd plist for `com.claudeclaw.app` must include `~/.npm-global/bin` in
its `EnvironmentVariables.PATH` so Claude subprocesses can locate both the
`claude` CLI and the `defuddle` skill binary. Current value:

```
/Users/dantecrescenzi/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

If `defuddle` or `claude` start failing with `command not found` after a
macOS upgrade, re-check this PATH value in the plist.
