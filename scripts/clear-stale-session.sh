#!/bin/bash
# One-shot: clear the main agent's stale Claude Code session for Dante's chat.
# Run via: fly ssh console -a claudeclaw-impactworks --command "/bin/bash /app/clear-stale-session.sh"
sqlite3 /app/store/claudeclaw.db <<SQL
DELETE FROM sessions WHERE chat_id = '7523100919' AND agent_id = 'main';
SELECT chat_id, session_id, agent_id FROM sessions WHERE chat_id = '7523100919';
SQL
echo "done"
