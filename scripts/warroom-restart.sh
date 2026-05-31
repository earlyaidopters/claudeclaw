#!/usr/bin/env bash
#
# warroom-restart.sh — Clean restart of the War Room voice stack.
#
# Why this exists: launchctl reloading com.claudeclaw.main.plist doesn't
# cascade to the python warroom subprocess. If main spawned a warroom and
# then we kill main, the warroom is orphaned and keeps holding port 7860.
# The next main spawn tries to bind 7860, fails with OSError [Errno 48],
# and burns through the MAX_CRASH_RESPAWNS limiter.
#
# This script kills the zombies first, then bounces main, then waits and
# verifies the warroom is actually alive on port 7860.
#
# Usage:
#   bash scripts/warroom-restart.sh
#   bash scripts/warroom-restart.sh --no-build   # skip tsc rebuild
#
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --no-build) SKIP_BUILD=1 ;;
  esac
done

echo "─── 1. Killing zombie warroom python processes ───"
pkill -9 -f "warroom/server.py" 2>/dev/null || true
lsof -tiTCP:7860 2>/dev/null | xargs -r kill -9 || true
lsof -tiTCP:7861 2>/dev/null | xargs -r kill -9 || true

# Give the OS a moment to release the sockets
sleep 2

echo "─── 2. Confirming both ports are free ───"
if lsof -iTCP:7860 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "ERROR: port 7860 still occupied after kill. Run 'lsof -iTCP:7860' and inspect manually."
  lsof -iTCP:7860 -sTCP:LISTEN
  exit 1
fi
if lsof -iTCP:7861 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "ERROR: port 7861 still occupied after kill. Run 'lsof -iTCP:7861' and inspect manually."
  lsof -iTCP:7861 -sTCP:LISTEN
  exit 1
fi
echo "  ports 7860 + 7861 clear"

if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "─── 3. Rebuilding tsc (server only — no SPA rebuild) ───"
  npm run build:server
fi

echo "─── 4. Bouncing main launchd agent ───"
PLIST="$HOME/Library/LaunchAgents/com.claudeclaw.main.plist"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "─── 5. Waiting for warroom subprocess to spawn ───"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if lsof -iTCP:7860 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "  warroom listening on 7860 after ${i}s"
    break
  fi
  sleep 1
done

echo ""
echo "─── 6. Verifying state ───"
echo ""
echo "── port 7860 listener ──"
lsof -iTCP:7860 -sTCP:LISTEN || echo "  NOT LISTENING"
echo ""
echo "── warroom python process ──"
ps aux | grep "warroom/server.py" | grep -v grep || echo "  NO PROCESS"
echo ""
echo "── /tmp/warroom-debug.log tail (last 8 lines) ──"
tail -8 /tmp/warroom-debug.log 2>/dev/null || echo "  (no debug log)"
echo ""
echo "── main launchd status ──"
launchctl list | grep claudeclaw || echo "  (no launchd entries)"

echo ""
echo "Done. If port 7860 shows a python listener and warroom-debug.log shows"
echo "'server listening on 0.0.0.0:7860' with no OSError, the war room is live."
