#!/usr/bin/env bash
# fly-cutover.sh — orchestrated cutover from Mac to Fly.
#
# Run this when you're ready to flip the switch. The sequence:
#   1. Stop the Mac launchd job (Nikki goes quiet)
#   2. Final SQLite checkpoint + rsync of any last writes
#   3. Smoke test the Fly machine
#   4. Print the DNS instructions for you to update Cloudflare
#   5. Wait for you to confirm DNS is swapped
#   6. Verify claw.impactworks.com is hitting Fly
#
# Rollback (if Fly turns out to be broken): re-point DNS at the Cloudflare
# tunnel and run `launchctl kickstart -k gui/$(id -u)/com.claudeclaw.main`.
# The Mac DB still has the last state — you've lost nothing.
#
# Usage:   ./scripts/fly-cutover.sh

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
APP_NAME="claudeclaw-impactworks"
DOMAIN="claw.impactworks.com"
LAUNCHD_LABEL="com.claudeclaw.main"

cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════"
echo "  ClaudeClaw cutover: Mac → Fly.io"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This will:"
echo "  • Stop the main agent on this Mac"
echo "  • Sync final state to Fly"
echo "  • Print DNS instructions for $DOMAIN"
echo "  • Verify Nikki responds from Fly"
echo ""
read -r -p "Proceed? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

# ── 1. Stop the Mac job ───────────────────────────────────────────────────
echo ""
echo "⏸  Stopping launchd job '$LAUNCHD_LABEL'..."
launchctl bootout "gui/$(id -u)/$LAUNCHD_LABEL" 2>/dev/null || \
  echo "   (already stopped or not loaded)"
sleep 2

# ── 2. Final SQLite checkpoint + ship ─────────────────────────────────────
echo ""
echo "💾 Final SQLite checkpoint..."
sqlite3 store/claudeclaw.db "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null

echo "📤 Final state migration..."
"$PROJECT_ROOT/scripts/fly-migrate-data.sh"

# ── 3. Smoke test ─────────────────────────────────────────────────────────
echo ""
echo "🧪 Smoke testing Fly app..."

FLY_HOST="${APP_NAME}.fly.dev"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${FLY_HOST}/api/health" || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "   ✅ /api/health OK on $FLY_HOST"
else
  echo "   ❌ /api/health returned $HTTP_STATUS — abort?"
  echo "   Check: fly logs -a $APP_NAME"
  read -r -p "Continue anyway? [y/N] " keep
  [[ "$keep" =~ ^[Yy]$ ]] || exit 1
fi

# ── 4. DNS instructions ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  DNS UPDATE REQUIRED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "In Cloudflare DNS for impactworks.com:"
echo ""
echo "  1. DELETE the existing CNAME for 'claw' pointing at the tunnel"
echo "  2. ADD a new CNAME record:"
echo "       Name:   claw"
echo "       Target: ${APP_NAME}.fly.dev"
echo "       Proxy:  OFF (DNS only, gray cloud)"
echo "          ↑ critical — Fly needs to issue its own TLS cert"
echo ""
echo "  3. Then on this machine, run:"
echo "       fly certs add $DOMAIN -a $APP_NAME"
echo ""

read -r -p "Press ENTER when DNS is updated to verify... "

# ── 5. Cert + DNS verification ────────────────────────────────────────────
echo ""
echo "🔐 Provisioning TLS cert for $DOMAIN..."
fly certs add "$DOMAIN" -a "$APP_NAME" 2>/dev/null || true

echo "⏳ Waiting for cert (this can take 30-90s)..."
for i in {1..20}; do
  if fly certs show "$DOMAIN" -a "$APP_NAME" 2>/dev/null | grep -q "Configured"; then
    echo "   ✅ Cert provisioned"
    break
  fi
  sleep 5
done

echo ""
echo "🌐 Verifying $DOMAIN routes to Fly..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "   ✅ $DOMAIN is live on Fly"
else
  echo "   ⚠️  $DOMAIN returned $HTTP_STATUS — DNS may not have propagated yet"
  echo "   Try again in a minute: curl -I https://$DOMAIN/api/health"
fi

# ── 6. Final note ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  CUTOVER COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Nikki is now running on Fly. Your Mac launchd job is stopped."
echo ""
echo "Test in Telegram now: send Nikki a short message and confirm she replies."
echo ""
echo "Tail logs:    fly logs -a $APP_NAME"
echo "SSH in:       fly ssh console -a $APP_NAME"
echo "Restart:      fly machines restart -a $APP_NAME"
echo ""
echo "ROLLBACK (if needed):"
echo "  1. In Cloudflare DNS, swap claw CNAME back to your tunnel"
echo "  2. launchctl kickstart -k gui/\$(id -u)/$LAUNCHD_LABEL"
echo "  3. Wait for tunnel to come back up"
