#!/bin/bash
# ClaudeClaw Master QA Audit: monitor-the-monitors for silent failures.
# Ported from /clawd/scripts/cron-qa-master.sh on 2026-04-19.
#
# Usage: bash qa-master-audit.sh [--verbose]
# Exit 0 = all green
# Exit 1 = violations found (wrapping cron pipes output to Discord)
#
# /clawd-specific checks (PM2 trading bots, DION Vercel endpoints, DION slides,
# SOUL drift, thinking-patterns JSONL) are intentionally NOT duplicated here —
# /clawd/scripts/cron-qa-master.sh still owns those.

set -uo pipefail

VERBOSE="${1:-}"
BASE="/Users/aditya_office_ai_assistant/claudeclaw"
DB="$BASE/store/claudeclaw.db"
STORE="$BASE/store"
EOD_DIR="$STORE/eod-reports"
LOG_DIR="$BASE/logs"

TODAY=$(date +%Y-%m-%d)
TODAY_UTC=$(date -u +%Y-%m-%d)
NOW_TS=$(date +%s)
HOUR_LOCAL=$(date +%H)
START_TS=$NOW_TS

# Timeout profile (macOS-friendly: no GNU timeout)
TIMEOUT_FAST=3
TIMEOUT_NET=5
TIMEOUT_DB=5

VIOLATIONS=()
PASSES=()
WARNINGS=()
CHECK_COUNT=0

log_pass() { PASSES+=("✅ $1"); }
log_warn() { WARNINGS+=("⚠️ $1"); }
log_fail() { VIOLATIONS+=("❌ $1"); }

inc() { CHECK_COUNT=$((CHECK_COUNT + 1)); }

# Hard timeout wrapper. perl alarm exits 142 on timeout.
run_with_timeout() {
  local seconds="$1"; shift
  perl -e 'alarm shift @ARGV; exec @ARGV' "$seconds" "$@"
}

# Readonly sqlite3 with short busy timeout (DB is hot: writers are active).
sql() {
  run_with_timeout "$TIMEOUT_DB" sqlite3 -readonly -cmd ".timeout 2000" "$DB" "$1" 2>/dev/null
}

# NOTE: scheduler cron firing is checked via next_run directly (see section 4).
# The scheduler writes next_run = "when this task should next fire" after each
# run. If next_run is significantly in the past, the dispatcher isn't firing.
# This sidesteps parsing 5- and 6-field cron in bash.

# ============================================================
# 1) DB reachable + integrity
# ============================================================
echo "--- Claudeclaw DB ---"
inc
if [ ! -f "$DB" ]; then
  log_fail "DB missing at $DB"
else
  INTEGRITY=$(sql "PRAGMA quick_check;" || echo "unreadable")
  if [ "$INTEGRITY" = "ok" ]; then
    log_pass "DB quick_check: ok"
  else
    log_fail "DB quick_check failed: ${INTEGRITY:-<no response>}"
  fi
fi

# WAL sanity — huge WAL means checkpointing stalled
inc
WAL_FILE="${DB}-wal"
if [ -f "$WAL_FILE" ]; then
  WAL_BYTES=$(stat -f%z "$WAL_FILE" 2>/dev/null || echo 0)
  WAL_MB=$((WAL_BYTES / 1024 / 1024))
  if [ "$WAL_BYTES" -gt 2147483648 ]; then
    log_fail "DB WAL huge: ${WAL_MB}MB (checkpointing stalled)"
  elif [ "$WAL_BYTES" -gt 524288000 ]; then
    log_warn "DB WAL large: ${WAL_MB}MB (>500MB — consider PRAGMA wal_checkpoint)"
  else
    log_pass "DB WAL size: ${WAL_MB}MB"
  fi
else
  log_pass "DB WAL absent (quiescent)"
fi

# ============================================================
# 2) Agent PID files point to live processes
# ============================================================
echo "--- Agent processes ---"
for pidfile in "$STORE/"agent-*.pid "$STORE/claudeclaw.pid"; do
  [ -f "$pidfile" ] || continue
  inc
  AGENT=$(basename "$pidfile" .pid)
  PID=$(cat "$pidfile" 2>/dev/null | tr -d ' \n')
  if [ -z "${PID:-}" ]; then
    log_fail "PID file empty: $AGENT"
    continue
  fi
  if kill -0 "$PID" 2>/dev/null; then
    log_pass "$AGENT pid=$PID alive"
  else
    log_fail "$AGENT pid=$PID dead (stale pidfile)"
  fi
done

# ============================================================
# 3) Agent heartbeats recent for non-offline agents
# ============================================================
echo "--- Agent heartbeats ---"
inc
STALE=$(sql "SELECT agent_id || ' (' || status || ', ' || CAST((strftime('%s','now') - last_heartbeat)/60 AS INT) || 'm stale)' FROM agent_heartbeats WHERE status IN ('online','idle','busy') AND last_heartbeat < strftime('%s','now') - 900 ORDER BY last_heartbeat ASC;")
if [ -z "$STALE" ]; then
  log_pass "All non-offline agents heartbeating within 15m"
else
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    log_fail "Stale heartbeat: $line"
  done <<< "$STALE"
fi

# ============================================================
# 4) Scheduler cron firing — next_run must not be far in the past
# ============================================================
# Logic: the scheduler writes next_run after each firing. If next_run is
# >15min in the past for any active task, the dispatcher has stalled.
echo "--- Scheduler cron firing ---"
if [ ! -f "$DB" ]; then
  inc
  log_fail "Scheduler: DB missing"
else
  inc
  TOTAL_ACTIVE=$(sql "SELECT COUNT(*) FROM scheduled_tasks WHERE status='active';")
  LATE_ROWS=$(run_with_timeout "$TIMEOUT_DB" sqlite3 -readonly -separator $'\t' "$DB" \
    "SELECT id, schedule, (strftime('%s','now') - next_run) FROM scheduled_tasks WHERE status='active' AND next_run < strftime('%s','now') - 900 ORDER BY next_run ASC LIMIT 10;" 2>/dev/null || echo "")
  if [ -z "$LATE_ROWS" ]; then
    log_pass "Scheduler: all ${TOTAL_ACTIVE:-?} active task(s) have next_run ≤15m overdue"
  else
    LATE_N=$(printf '%s\n' "$LATE_ROWS" | grep -c .)
    log_fail "Scheduler: $LATE_N of ${TOTAL_ACTIVE:-?} active task(s) overdue (next_run >15m in past)"
    while IFS=$'\t' read -r TID SCHED LATENESS; do
      [ -z "$TID" ] && continue
      VIOLATIONS+=("    → ${TID:0:8} '$SCHED' next_run=$((LATENESS/60))m late")
    done <<< "$LATE_ROWS"
  fi
fi

# ============================================================
# 5) Mission queue — tasks stuck in 'queued' >30min
# ============================================================
echo "--- Mission queue health ---"
inc
STUCK_CUTOFF=$((NOW_TS - 1800))
if [ ! -f "$DB" ]; then
  log_fail "Mission queue: DB missing"
else
  STUCK_ROWS=$(run_with_timeout "$TIMEOUT_DB" sqlite3 -readonly -separator $'\t' "$DB" \
    "SELECT id, title, (strftime('%s','now') - created_at) FROM mission_tasks WHERE status='queued' AND created_at < $STUCK_CUTOFF ORDER BY created_at ASC;" 2>/dev/null || echo "")
  if [ -z "$STUCK_ROWS" ]; then
    log_pass "Mission queue: no tasks stuck >30min in 'queued'"
  else
    STUCK_N=$(printf '%s\n' "$STUCK_ROWS" | grep -c .)
    log_fail "Mission queue: $STUCK_N task(s) stuck >30min in 'queued'"
    while IFS=$'\t' read -r MID MTITLE MAGE; do
      [ -z "$MID" ] && continue
      VIOLATIONS+=("    → ${MID:0:8} ($((MAGE/60))m): ${MTITLE:0:60}")
    done <<< "$STUCK_ROWS"
  fi
fi

# Running >2h is also a smell
inc
HUNG_ROWS=$(run_with_timeout "$TIMEOUT_DB" sqlite3 -readonly -separator $'\t' "$DB" \
  "SELECT id, title, (strftime('%s','now') - COALESCE(started_at, created_at)) FROM mission_tasks WHERE status='running' AND COALESCE(started_at, created_at) < strftime('%s','now') - 7200 ORDER BY started_at ASC;" 2>/dev/null || echo "")
if [ -z "$HUNG_ROWS" ]; then
  log_pass "Mission queue: no tasks running >2h"
else
  while IFS=$'\t' read -r MID MTITLE MAGE; do
    [ -z "$MID" ] && continue
    log_warn "Long-running task ${MID:0:8} (${MAGE}s): ${MTITLE:0:60}"
  done <<< "$HUNG_ROWS"
fi

# ============================================================
# 6) EOD report sanity
# ============================================================
# Today's EOD should exist after 21:00 local. Before 21:00, expect the most
# recent EOD file to be <26h old (yesterday's run succeeded).
echo "--- EOD report ---"
inc
if [ ! -d "$EOD_DIR" ]; then
  log_fail "EOD dir missing: $EOD_DIR"
else
  if [ "$((10#$HOUR_LOCAL))" -ge 21 ]; then
    EOD_LOCAL="$EOD_DIR/$TODAY.txt"
    EOD_UTC="$EOD_DIR/$TODAY_UTC.txt"
    if [ -f "$EOD_LOCAL" ] || [ -f "$EOD_UTC" ]; then
      log_pass "EOD report present for today (post-21:00 local)"
    else
      log_fail "EOD report missing for today (post-21:00, no $TODAY.txt or $TODAY_UTC.txt)"
    fi
  else
    MOST_RECENT=$(run_with_timeout "$TIMEOUT_FAST" bash -lc \
      "ls -t '$EOD_DIR'/*.txt 2>/dev/null | head -1" 2>/dev/null || echo "")
    if [ -z "$MOST_RECENT" ]; then
      log_fail "EOD report: no .txt files in $EOD_DIR"
    else
      MTIME=$(stat -f %m "$MOST_RECENT" 2>/dev/null || echo 0)
      AGE=$((NOW_TS - MTIME))
      if [ "$AGE" -lt 93600 ]; then
        log_pass "EOD report: latest $(basename "$MOST_RECENT") ($((AGE/3600))h old)"
      else
        log_fail "EOD report: latest $(basename "$MOST_RECENT") is $((AGE/3600))h old (>26h)"
      fi
    fi
  fi
fi

# ============================================================
# 7) Disk space (generic)
# ============================================================
echo "--- Disk ---"
inc
DISK_PCT=$(df -P / 2>/dev/null | awk 'NR==2 {gsub("%",""); print $5}')
if [ -n "${DISK_PCT:-}" ]; then
  if [ "$DISK_PCT" -ge 95 ]; then
    log_fail "Root disk ${DISK_PCT}% full"
  elif [ "$DISK_PCT" -ge 85 ]; then
    log_warn "Root disk ${DISK_PCT}% full"
  else
    log_pass "Root disk ${DISK_PCT}% full"
  fi
else
  log_warn "Could not read disk usage"
fi

# ============================================================
# 8) Internet connectivity (generic)
# ============================================================
echo "--- Internet ---"
inc
CODE=$(run_with_timeout "$TIMEOUT_NET" curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_NET" "https://1.1.1.1" 2>/dev/null || echo "000")
case "$CODE" in
  2*|301|302|307|308) log_pass "Internet reachable (1.1.1.1 → $CODE)" ;;
  *)                  log_fail "Internet unreachable (1.1.1.1 → $CODE)" ;;
esac

# ============================================================
# 9) Notification delivery integrity
# ============================================================
# Detect the "job completed but notification failed" pattern in recent logs.
echo "--- Notification integrity ---"
inc

CANDIDATES=()
if [ -d "$LOG_DIR" ]; then
  for f in "$LOG_DIR"/*.log; do
    [ -f "$f" ] && CANDIDATES+=("$f")
  done
fi

COMPLETE_RE='(completed|finished|all systems healthy|success)'
NOTIFY_FAIL_RE='(discord.*(fail|error)|failed to send|notification failed|webhook.*(fail|error)|post failed|telegram.*(fail|error))'

FOUND_PATTERN=0
CULPRIT=""
for f in "${CANDIDATES[@]}"; do
  RECENT=$(run_with_timeout "$TIMEOUT_FAST" tail -n 200 "$f" 2>/dev/null || true)
  [ -n "$RECENT" ] || continue
  if echo "$RECENT" | grep -Eiq "$COMPLETE_RE" && echo "$RECENT" | grep -Eiq "$NOTIFY_FAIL_RE"; then
    FOUND_PATTERN=1
    CULPRIT=$(basename "$f")
    break
  fi
done

if [ "$FOUND_PATTERN" -eq 0 ]; then
  log_pass "Notification integrity: no completion+delivery-failure pattern in ${#CANDIDATES[@]} log file(s)"
else
  log_fail "Notification integrity: completion + delivery failure pattern in $CULPRIT"
fi

# ============================================================
# Optional: prove timeout guards work (QA_SIMULATE_HANG=1)
# ============================================================
if [ "${QA_SIMULATE_HANG:-0}" = "1" ]; then
  inc
  if run_with_timeout 3 bash -lc 'sleep 10' >/dev/null 2>&1; then
    log_fail "Timeout self-test failed (hung command succeeded)"
  else
    rc=$?
    if [ "$rc" -eq 142 ]; then
      log_pass "Timeout self-test passed (killed at 3s)"
    else
      log_warn "Timeout self-test rc=$rc (expected 142)"
    fi
  fi
fi

# ============================================================
# OUTPUT
# ============================================================
END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

echo ""
echo "========================================"
echo "  CLAUDECLAW QA MASTER AUDIT — $TODAY $(date +%H:%M)"
echo "========================================"
echo ""
echo "Checks run: ${CHECK_COUNT}  |  Runtime: ${DURATION}s"
echo ""

echo "PASSES: ${#PASSES[@]}"
if [ "$VERBOSE" = "--verbose" ]; then
  for p in "${PASSES[@]}"; do echo "  $p"; done
fi
echo ""

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "WARNINGS: ${#WARNINGS[@]}"
  for w in "${WARNINGS[@]}"; do echo "  $w"; done
  echo ""
fi

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "🚨 VIOLATIONS: ${#VIOLATIONS[@]}"
  for v in "${VIOLATIONS[@]}"; do echo "  $v"; done
  exit 1
else
  echo "✅ ALL CRITICAL MONITORS HEALTHY"
  exit 0
fi
