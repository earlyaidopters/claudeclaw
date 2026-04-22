#!/bin/bash
# Send a Telegram message mid-task via the alert router.
#
# Per-agent routing (amendment to mission e02337a9, 2026-04-20):
#   The outbound bot is chosen by $CLAUDECLAW_AGENT_ID. If unset, defaults to
#   main AND logs a warning to stderr so misuse is visible. This file no
#   longer reads TELEGRAM_BOT_TOKEN directly — every message funnels through
#   dist/alert-cli.js → sendAlert() → the correct per-agent bot token.
#
# Usage:
#   notify.sh "message text"                       # digest (default)
#   notify.sh realtime "message text"              # realtime
#   notify.sh digest "message text"                # explicit digest
#   notify.sh drop "message text"                  # dropped (audit only)
#   notify.sh --severity=realtime "message text"   # flag form
#   notify.sh --agent=ops --severity=realtime "m"  # override agent
#
# Exit codes (from alert-cli):
#   0 — routed (sent or queued)
#   1 — send failure (missing bot token throws here — FAIL LOUD)
#   2 — config error (no message / no chat)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ALERT_CLI="$ROOT_DIR/dist/alert-cli.js"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "notify.sh: .env not found at $ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$ALERT_CLI" ]; then
  echo "notify.sh: $ALERT_CLI missing — run 'npm run build'" >&2
  exit 1
fi

# Collect flags + positional args. The first positional token may be a
# severity keyword (realtime|digest|drop) for backwards compatibility.
ARGS=()
SEVERITY=""
SAW_SEVERITY=0
POSITIONAL=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --agent|--chat|--category)
      ARGS+=("$1" "$2"); shift 2 ;;
    --agent=*|--chat=*|--category=*)
      ARGS+=("$1"); shift ;;
    --severity)
      SEVERITY="$2"; SAW_SEVERITY=1; shift 2 ;;
    --severity=*)
      SEVERITY="${1#--severity=}"; SAW_SEVERITY=1; shift ;;
    --)
      shift; POSITIONAL+=("$@"); break ;;
    *)
      POSITIONAL+=("$1"); shift ;;
  esac
done

# If the first positional token is a severity keyword and no --severity was
# set explicitly, treat it as the severity.
if [ "$SAW_SEVERITY" -eq 0 ] && [ "${#POSITIONAL[@]}" -gt 0 ]; then
  case "${POSITIONAL[0]}" in
    realtime|digest|drop)
      SEVERITY="${POSITIONAL[0]}"
      POSITIONAL=("${POSITIONAL[@]:1}")
      ;;
  esac
fi

if [ -n "$SEVERITY" ]; then
  ARGS+=(--severity "$SEVERITY")
fi

# Read .env into the shell so ALLOWED_CHAT_ID + bot tokens + CLAUDECLAW_AGENT_ID
# (if set at install time) are available to the node process. We do NOT grep
# for TELEGRAM_BOT_TOKEN any more — alert-cli resolves the right bot itself.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Rejoin positional args into a single message string.
MSG=""
if [ "${#POSITIONAL[@]}" -gt 0 ]; then
  MSG="${POSITIONAL[*]}"
fi

# If no message positional, let alert-cli read from stdin.
if [ -z "$MSG" ]; then
  exec node "$ALERT_CLI" "${ARGS[@]}"
else
  exec node "$ALERT_CLI" "${ARGS[@]}" "$MSG"
fi
