#!/bin/bash
# Check for new upstream commits on earlyaidopters/claudeclaw.
# Intended to be run as a scheduled task by ClaudeClaw's scheduler,
# or manually to trigger the demo flow.
#
# Output: JSON with upstream status, suitable for agent consumption.

set -euo pipefail
cd /home/apexaipc/projects/claudeclaw

# Fetch latest upstream
git fetch upstream --quiet 2>/dev/null || { echo '{"error":"fetch failed"}'; exit 1; }

# Get current merge base and counts
MERGE_BASE=$(git merge-base main upstream/main 2>/dev/null)
LOCAL_HEAD=$(git rev-parse main)
UPSTREAM_HEAD=$(git rev-parse upstream/main)

if [ "$LOCAL_HEAD" = "$UPSTREAM_HEAD" ] || [ "$MERGE_BASE" = "$UPSTREAM_HEAD" ]; then
  echo '{"status":"up_to_date","new_commits":0}'
  exit 0
fi

# Count new upstream commits
NEW_COMMITS=$(git log --oneline "$MERGE_BASE..upstream/main" | wc -l)

# Get commit summaries
COMMITS=$(git log --oneline --format='{"hash":"%h","message":"%s"},' "$MERGE_BASE..upstream/main" | sed '$ s/,$//')

# Count potential conflicts
CONFLICT_FILES=$(git diff --name-only main..upstream/main 2>/dev/null | wc -l)

cat <<EOF
{
  "status": "behind",
  "new_commits": $NEW_COMMITS,
  "changed_files": $CONFLICT_FILES,
  "merge_base": "$MERGE_BASE",
  "upstream_head": "$UPSTREAM_HEAD",
  "commits": [$COMMITS]
}
EOF
