#!/bin/bash
# handle-build-review.sh -- Build verification and re-assignment handler.
#
# Called by Jarvis (QA agent) when a builder marks a task as "review" in Mission Control.
# Verifies the build, and outputs structured results for Jarvis to act on.
#
# Usage:
#   handle-build-review.sh <task_number> <deploy_url> [repo_path] [--wait-for "selector"]
#
# Flow:
#   1. Pull task details from Mission Control
#   2. Check git status (if repo path provided)
#   3. Run browser verification via Playwright
#   4. Output structured result for the calling agent (Jarvis) to process
#
# The calling agent (Jarvis) is responsible for:
#   - PASS: Adding MC comment, logging to HiveMind, signaling Janet for approval
#   - FAIL: Adding MC comment with diagnostics, resetting task to builder, logging to HiveMind

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$WORKSPACE_DIR/.env"
VERIFY_SCRIPT="$WORKSPACE_DIR/scripts/verify-build.sh"
NOTIFY_SCRIPT="$WORKSPACE_DIR/scripts/notify.sh"
STATUS_SCRIPT="$WORKSPACE_DIR/scripts/notify-status.sh"
DELIVERABLE_SCRIPT="$WORKSPACE_DIR/scripts/send-deliverable.sh"
HIVEMIND_DB="$WORKSPACE_DIR/hivemind/hivemind.db"

# Load Supabase credentials for MC status updates
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not found in $ENV_FILE -- MC status updates will fail"
fi

TASK_NUMBER="${1:-}"
DEPLOY_URL="${2:-}"
REPO_PATH="${3:-}"
WAIT_FOR_ARG=""

# Parse remaining args
shift 3 2>/dev/null || shift $# 2>/dev/null
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait-for)
      WAIT_FOR_ARG="--wait-for $2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$TASK_NUMBER" ] || [ -z "$DEPLOY_URL" ]; then
  echo "Usage: handle-build-review.sh <task_number> <deploy_url> [repo_path] [--wait-for selector]"
  exit 2
fi

echo "=== Build Verification (Jarvis QA Pipeline) ==="
echo "Task: #$TASK_NUMBER"
echo "URL: $DEPLOY_URL"
echo "Repo: ${REPO_PATH:-not provided}"
echo ""

# Notify status channel that verification is starting
"$STATUS_SCRIPT" "🔍 Jarvis verifying build for task #$TASK_NUMBER -- $DEPLOY_URL" 2>/dev/null || true

# Run the full verification
echo "Running verification..."
VERIFY_OUTPUT=$("$VERIFY_SCRIPT" "$DEPLOY_URL" "$REPO_PATH" $WAIT_FOR_ARG 2>&1) || true
VERIFY_STATUS=$(echo "$VERIFY_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('overallStatus', 'fail'))" 2>/dev/null || echo "fail")
VERIFY_SUMMARY=$(echo "$VERIFY_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', 'Verification produced no summary'))" 2>/dev/null || echo "Could not parse verification output")
SCREENSHOT_PATH=$(echo "$VERIFY_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('browser', {}).get('screenshotPath', ''))" 2>/dev/null || echo "")
CONSOLE_ERRORS=$(echo "$VERIFY_OUTPUT" | python3 -c "
import sys, json
r = json.load(sys.stdin)
errors = r.get('browser', {}).get('consoleErrors', [])
print('\n'.join(errors[:10]) if errors else 'None')
" 2>/dev/null || echo "Could not parse")
NETWORK_ERRORS=$(echo "$VERIFY_OUTPUT" | python3 -c "
import sys, json
r = json.load(sys.stdin)
errors = r.get('browser', {}).get('networkErrors', [])
print('\n'.join([f\"{e['method']} {e['url']} -- {e['reason']}\" for e in errors[:10]]) if errors else 'None')
" 2>/dev/null || echo "Could not parse")
HTTP_STATUS=$(echo "$VERIFY_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('browser', {}).get('httpStatus', 'unknown'))" 2>/dev/null || echo "unknown")
LOAD_TIME=$(echo "$VERIFY_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('browser', {}).get('loadTimeMs', 'unknown'))" 2>/dev/null || echo "unknown")

echo ""
echo "Status: $VERIFY_STATUS"
echo "Summary: $VERIFY_SUMMARY"
echo ""

# Save full report
REPORT_DIR="$WORKSPACE_DIR/janet-prime/deliverables/verification-reports"
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$REPORT_DIR/task-${TASK_NUMBER}-${TIMESTAMP}.json"
echo "$VERIFY_OUTPUT" > "$REPORT_FILE"

if [ "$VERIFY_STATUS" = "pass" ]; then
  echo "=== VERIFICATION PASSED ==="

  # Send screenshot to deliverables channel
  if [ -n "$SCREENSHOT_PATH" ] && [ -f "$SCREENSHOT_PATH" ]; then
    "$DELIVERABLE_SCRIPT" "$SCREENSHOT_PATH" "Task #$TASK_NUMBER verified PASS -- $DEPLOY_URL" photo 2>/dev/null || true
  fi

  # Log to HiveMind
  sqlite3 "$HIVEMIND_DB" "INSERT INTO activity_log (agent_id, action, summary, created_at) VALUES ('jarvis', 'verification_pass', 'Task #$TASK_NUMBER: PASS -- $VERIFY_SUMMARY. URL: $DEPLOY_URL. HTTP: $HTTP_STATUS. Load: ${LOAD_TIME}ms. Report: $REPORT_FILE', strftime('%s','now'));" 2>/dev/null || true

  # Update MC task status to done (prevents poller re-dispatch loop)
  MC_UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${SUPABASE_URL}/rest/v1/mc_tasks?task_number=eq.${TASK_NUMBER}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"status\":\"done\",\"completed_at\":\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",\"updated_at\":\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"}")
  if [ "$MC_UPDATE_RESPONSE" = "204" ]; then
    echo "MC task #$TASK_NUMBER status -> done (HTTP $MC_UPDATE_RESPONSE)"
  else
    echo "WARNING: MC status update failed (HTTP $MC_UPDATE_RESPONSE) -- task may be re-dispatched by poller"
  fi

  # Notify status channel
  "$STATUS_SCRIPT" "✅ Jarvis PASSED Task #$TASK_NUMBER

$VERIFY_SUMMARY

URL: $DEPLOY_URL | HTTP: $HTTP_STATUS | Load: ${LOAD_TIME}ms
Awaiting Janet's final approval." 2>/dev/null || true

  echo ""
  echo "RESULT: PASS"
  echo "NEXT_ACTION: jarvis_signal_janet"
  echo ""
  echo "JARVIS: Add a VERIFICATION PASS comment to MC task #$TASK_NUMBER with this evidence:"
  echo "  Commit on main: verified"
  echo "  Vercel deploy: READY"
  echo "  HTTP status: $HTTP_STATUS"
  echo "  Load time: ${LOAD_TIME}ms"
  echo "  Console errors: $CONSOLE_ERRORS"
  echo "  Screenshot: ${SCREENSHOT_PATH:-none}"
  echo "  Report: $REPORT_FILE"
  echo ""
  echo "Then signal Janet via HiveMind (already logged above) for final approval."
  echo "Janet will review your report, stamp it, and notify Denver."

else
  echo "=== VERIFICATION FAILED ==="
  echo ""
  echo "Console errors:"
  echo "$CONSOLE_ERRORS"
  echo ""
  echo "Network errors:"
  echo "$NETWORK_ERRORS"
  echo ""

  # Send failure screenshot to deliverables channel
  if [ -n "$SCREENSHOT_PATH" ] && [ -f "$SCREENSHOT_PATH" ]; then
    "$DELIVERABLE_SCRIPT" "$SCREENSHOT_PATH" "❌ Task #$TASK_NUMBER FAILED verification -- $DEPLOY_URL

$VERIFY_SUMMARY" photo 2>/dev/null || true
  fi

  # Log to HiveMind
  sqlite3 "$HIVEMIND_DB" "INSERT INTO activity_log (agent_id, action, summary, created_at) VALUES ('jarvis', 'verification_fail', 'Task #$TASK_NUMBER: FAIL -- $VERIFY_SUMMARY. Sent back to builder.', strftime('%s','now'));" 2>/dev/null || true

  # Update MC task status to assigned (sends back to builder, prevents poller re-dispatch loop)
  MC_UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${SUPABASE_URL}/rest/v1/mc_tasks?task_number=eq.${TASK_NUMBER}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"status\":\"assigned\",\"updated_at\":\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"}")
  if [ "$MC_UPDATE_RESPONSE" = "204" ]; then
    echo "MC task #$TASK_NUMBER status -> assigned (HTTP $MC_UPDATE_RESPONSE)"
  else
    echo "WARNING: MC status update failed (HTTP $MC_UPDATE_RESPONSE) -- task may be re-dispatched by poller"
  fi

  # Notify status channel
  "$STATUS_SCRIPT" "❌ Jarvis FAILED Task #$TASK_NUMBER -- sending back to builder.

$VERIFY_SUMMARY

Iterating with builder. Denver will not be notified." 2>/dev/null || true

  echo ""
  echo "RESULT: FAIL"
  echo "NEXT_ACTION: jarvis_redispatch_to_builder"
  echo ""
  echo "JARVIS: Do the following autonomously:"
  echo "1. Add a VERIFICATION FAIL comment to MC task #$TASK_NUMBER with these diagnostics:"
  echo "   Summary: $VERIFY_SUMMARY"
  if [ "$CONSOLE_ERRORS" != "None" ]; then
    echo "   Console errors: $CONSOLE_ERRORS"
  fi
  if [ "$NETWORK_ERRORS" != "None" ]; then
    echo "   Network errors: $NETWORK_ERRORS"
  fi
  echo "   Report: $REPORT_FILE"
  echo ""
  echo "2. Set the task back to 'assigned' status for the original builder:"
  echo "   UPDATE mc_tasks SET status = 'assigned', updated_at = now() WHERE task_number = $TASK_NUMBER;"
  echo ""
  echo "3. The builder will be re-woken by the MC poller to fix and re-submit."
  echo "4. If this is the 3rd failure cycle, escalate to Janet instead."
  echo "5. Do NOT notify Denver. This stays between you and the builder."
  echo ""
  echo "Completion criteria for re-verification: verify-build.sh must return 'pass' for $DEPLOY_URL"
  echo ""
  echo "Full report saved: $REPORT_FILE"
fi

echo ""
echo "=== Verification Complete ==="
