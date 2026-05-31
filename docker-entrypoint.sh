#!/bin/sh
# Bridge Fly-injected environment secrets to /app/.env at container boot.
#
# Why: the app's readEnvFile() function (src/env.ts) reads secrets from a
# .env file on disk rather than process.env, by design — to keep secrets
# from leaking into child processes. On Fly, secrets are injected as env
# vars, so we materialize them into /app/.env here.
#
# Exclusions: system vars (PATH, HOME, LANG, etc.), Fly platform vars
# (FLY_*, PRIMARY_REGION), and Node-internal vars (NODE_VERSION etc.).
# Everything else with an uppercase A-Z key is treated as app config.

set -e

ENV_FILE=/app/.env

env \
  | grep -E '^[A-Z][A-Z0-9_]*=' \
  | grep -vE '^(PATH|HOME|HOSTNAME|SHELL|PWD|USER|LANG|TERM|LC_|LD_|TINI_|FLY_|PRIMARY_REGION|NODE_VERSION|YARN_VERSION|TZDATA)=' \
  > "$ENV_FILE"

# Make sure it's only readable by the app user
chmod 600 "$ENV_FILE"

# ── Materialize Vendasta service-account JSON from Fly secret ─────────
# Vendasta connector needs the GCP service account file on disk. The image
# layer is ephemeral, so we stash the JSON content as a Fly secret
# (VENDASTA_SERVICE_ACCOUNT_JSON) and write it out at boot.
if [ -n "${VENDASTA_SERVICE_ACCOUNT_JSON:-}" ]; then
  mkdir -p /app/secrets
  printf '%s' "$VENDASTA_SERVICE_ACCOUNT_JSON" > /app/secrets/vendasta-nikki-service-account.json
  chmod 600 /app/secrets/vendasta-nikki-service-account.json
  echo "Restored Vendasta service account → /app/secrets/"
fi

# ── Restore Claude Code credentials from persistent volume ───────────────
# Claude Code CLI reads OAuth creds from $HOME/.claude/.credentials.json.
# The image filesystem is ephemeral, so we persist the file in /app/store
# (Fly volume) and re-link it on each boot. We place it in the current
# user's home dir (node, not root — Claude Code refuses to run the
# bot's --dangerously-skip-permissions flag as root).
CLAUDE_DIR="${HOME:-/home/node}/.claude"
mkdir -p "$CLAUDE_DIR"

if [ -f /app/store/claude-credentials.json ]; then
  cp /app/store/claude-credentials.json "$CLAUDE_DIR/.credentials.json"
  chmod 600 "$CLAUDE_DIR/.credentials.json"
  echo "Restored Claude Code credentials → $CLAUDE_DIR/.credentials.json"
fi

# Persist Claude Code session state across container restarts.
# Without this, every deploy wipes ~/.claude/projects/* and the bot's stored
# sessionIds become orphan ("No conversation found"), forcing a manual
# DELETE FROM sessions on every redeploy. Symlink onto the Fly volume.
mkdir -p /app/store/claude-projects
if [ ! -L "$CLAUDE_DIR/projects" ]; then
  rm -rf "$CLAUDE_DIR/projects"
  ln -s /app/store/claude-projects "$CLAUDE_DIR/projects"
  echo "Linked Claude Code project state → /app/store/claude-projects (persistent)"
fi

# ── Start Syncthing in the background ────────────────────────────────────
# Syncthing handles Obsidian-vault sync between this machine and Dante's Mac.
# Config + state live on the Fly volume so device IDs and pairings survive
# container restarts. GUI is exposed on port 8384 (internal); we expose it
# externally only during pairing setup.
SYNCTHING_HOME=/app/store/syncthing-config
mkdir -p "$SYNCTHING_HOME"

# First boot: generate config + cert+key; this is what gives us our device ID.
if [ ! -f "$SYNCTHING_HOME/config.xml" ]; then
  syncthing --generate="$SYNCTHING_HOME" 2>&1 | head -5 || true
fi

# Launch syncthing in background. We bind the GUI to 0.0.0.0 so Fly's
# private network or an ssh-tunnel can reach it for initial pairing.
syncthing serve \
  --home="$SYNCTHING_HOME" \
  --no-browser \
  --no-restart \
  --gui-address=0.0.0.0:8384 \
  >/app/store/logs/syncthing.log 2>&1 &

echo "Started syncthing in background (PID $!)"

# Hand off to the real command (node dist/index.js by default)
exec "$@"
