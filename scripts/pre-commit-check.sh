#!/usr/bin/env bash
# ClaudeClaw Pre-Commit Safety Check
# Prevents accidental commit of personal data to the public template repo.
#
# Setup:
#   1. Edit PERSONAL_PATTERNS below with YOUR specific identifiers
#   2. Install: cp scripts/pre-commit-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# The hook is NOT committed to git (lives in .git/hooks/). The script in
# scripts/ is a template. Customize it, then copy to .git/hooks/pre-commit.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FAILED=0

# ── CUSTOMIZE THIS ──────────────────────────────────────────────────
# Add your username, real name, bot names, chat IDs, and any other
# strings that should NEVER appear in a public commit.
# Separate patterns with | (regex OR).
PERSONAL_PATTERNS="YOUR_USERNAME_HERE|YOUR_REAL_NAME_HERE|YOUR_CHAT_ID_HERE"
# ────────────────────────────────────────────────────────────────────

if [ "$PERSONAL_PATTERNS" = "YOUR_USERNAME_HERE|YOUR_REAL_NAME_HERE|YOUR_CHAT_ID_HERE" ]; then
  echo -e "${RED}WARNING: pre-commit-check.sh has not been customized.${NC}"
  echo "Edit PERSONAL_PATTERNS in .git/hooks/pre-commit with your own identifiers."
  echo "Skipping personal data check."
  echo ""
fi

echo "Running ClaudeClaw pre-commit safety checks..."
echo ""

# 1. Check for personal data in staged files (only if patterns are customized)
if [ "$PERSONAL_PATTERNS" != "YOUR_USERNAME_HERE|YOUR_REAL_NAME_HERE|YOUR_CHAT_ID_HERE" ]; then
  CONTENT_MATCHES=$(git diff --cached --name-only | xargs grep -l -E "$PERSONAL_PATTERNS" 2>/dev/null || true)
  if [ -n "$CONTENT_MATCHES" ]; then
    echo -e "${RED}BLOCKED: Personal data found in staged files:${NC}"
    echo "$CONTENT_MATCHES" | while read f; do
      echo "  - $f"
      git diff --cached "$f" | grep -n -E "$PERSONAL_PATTERNS" | head -3 | sed 's/^/    /'
    done
    FAILED=1
  fi
fi

# 2. Check no personal agent configs are staged (only _template and .example allowed)
AGENT_FILES=$(git diff --cached --name-only | grep -E "^agents/.+/(CLAUDE\.md|agent\.yaml)$" | grep -v _template | grep -v "\.example" || true)
if [ -n "$AGENT_FILES" ]; then
  echo -e "${RED}BLOCKED: Personal agent configs staged for commit:${NC}"
  echo "$AGENT_FILES" | while read f; do echo "  - $f"; done
  echo "  Only agents/_template/ files and .example files should be committed."
  FAILED=1
fi

# 3. Check no sensitive files are staged
SENSITIVE=$(git diff --cached --name-only | grep -E "\.env$|^store/|\.db$|\.db-wal$|\.db-shm$|\.pid$" || true)
if [ -n "$SENSITIVE" ]; then
  echo -e "${RED}BLOCKED: Sensitive files staged for commit:${NC}"
  echo "$SENSITIVE" | while read f; do echo "  - $f"; done
  FAILED=1
fi

# 4. Verify CLAUDE.md uses placeholders (if it's being committed)
if git diff --cached --name-only | grep -q "^CLAUDE.md$"; then
  if ! git show :CLAUDE.md | grep -q "\[YOUR NAME\]"; then
    echo -e "${RED}BLOCKED: CLAUDE.md does not contain [YOUR NAME] placeholders.${NC}"
    echo "  The committed CLAUDE.md must use generic placeholders, not personal names."
    FAILED=1
  fi
fi

# Results
echo ""
if [ $FAILED -eq 1 ]; then
  echo -e "${RED}Pre-commit check FAILED. Fix the issues above before committing.${NC}"
  exit 1
else
  echo -e "${GREEN}All pre-commit checks passed.${NC}"
fi
