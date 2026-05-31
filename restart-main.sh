#!/bin/bash
# Kill duplicate terminal agents (research/content/ops manually started)
pkill -f "node dist/index.js --agent research" 2>/dev/null && echo "killed research dup" || true
pkill -f "node dist/index.js --agent content" 2>/dev/null && echo "killed content dup" || true
pkill -f "node dist/index.js --agent ops" 2>/dev/null && echo "killed ops dup" || true
pkill -f "node dist/index.js --agent comms" 2>/dev/null && echo "killed comms dup" || true

# Restart main bot via launchctl (KeepAlive will bring it back up)
echo "Restarting main bot..."
launchctl stop com.claudeclaw.main 2>/dev/null && sleep 2
launchctl start com.claudeclaw.main 2>/dev/null
echo "Done — check logs/main.log in ~10s"
