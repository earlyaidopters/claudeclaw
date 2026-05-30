#!/usr/bin/env bash
# fly-setup.sh — first-time Fly.io app bootstrap for ClaudeClaw.
#
# What this does (idempotent — safe to re-run):
#   1. Verifies `fly` CLI is installed and you're logged in
#   2. Creates the app if it doesn't exist (`claudeclaw`)
#   3. Creates the persistent volume `claudeclaw_store` in iad (3GB)
#   4. Pushes every key from your local .env up as a Fly secret in one batch
#
# After this runs, you can `fly deploy` and the container will boot with
# all secrets and a mounted volume ready for the data migration step.
#
# Usage:   ./scripts/fly-setup.sh
# Reset:   fly apps destroy claudeclaw   (DANGER — wipes everything)

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
APP_NAME="claudeclaw-impactworks"
REGION="iad"
VOLUME_NAME="claudeclaw_store"
VOLUME_SIZE_GB="3"

cd "$PROJECT_ROOT"

# ── 0. Preflight ──────────────────────────────────────────────────────────
if ! command -v fly >/dev/null 2>&1; then
  echo "❌ fly CLI not installed. Install: brew install flyctl"
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "❌ Not logged into Fly. Run: fly auth login"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "❌ .env not found at $PROJECT_ROOT/.env"
  exit 1
fi

echo "✅ fly CLI OK ($(fly auth whoami))"

# ── 1. Create app if missing ──────────────────────────────────────────────
if fly apps list 2>/dev/null | grep -q "^$APP_NAME"; then
  echo "ℹ️  App '$APP_NAME' already exists, skipping creation"
else
  echo "🚀 Creating app '$APP_NAME'..."
  fly apps create "$APP_NAME" --org personal
fi

# ── 2. Create volume if missing ───────────────────────────────────────────
if fly volumes list -a "$APP_NAME" 2>/dev/null | grep -q "$VOLUME_NAME"; then
  echo "ℹ️  Volume '$VOLUME_NAME' already exists, skipping creation"
else
  echo "💾 Creating ${VOLUME_SIZE_GB}GB volume '$VOLUME_NAME' in $REGION..."
  fly volumes create "$VOLUME_NAME" \
    --app "$APP_NAME" \
    --region "$REGION" \
    --size "$VOLUME_SIZE_GB" \
    --yes
fi

# ── 3. Push secrets from .env ─────────────────────────────────────────────
# We exclude DASHBOARD_PORT (set via fly.toml [env]) and anything that looks
# like a path. Everything else gets uploaded as a Fly secret.
echo "🔐 Pushing secrets from .env..."

SECRETS_ARGS=()
while IFS='=' read -r key value; do
  # Skip comments, blanks, and config that belongs in fly.toml
  [[ -z "$key" || "$key" =~ ^# || "$key" == "DASHBOARD_PORT" ]] && continue
  # Skip path-like config (won't work in the container anyway)
  [[ "$key" == *"_PATH" || "$key" == *"_DIR" ]] && continue
  # Strip surrounding quotes if present
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  [[ -z "$value" ]] && continue
  SECRETS_ARGS+=("$key=$value")
done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env)

if [[ ${#SECRETS_ARGS[@]} -eq 0 ]]; then
  echo "⚠️  No secrets found in .env — did you point at the right file?"
  exit 1
fi

echo "   → Found ${#SECRETS_ARGS[@]} secrets to push"
fly secrets set --app "$APP_NAME" --stage "${SECRETS_ARGS[@]}"

echo ""
echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "   1. fly deploy                          (builds image, boots container)"
echo "   2. ./scripts/fly-migrate-data.sh       (copies SQLite + JSONs)"
echo "   3. ./scripts/fly-cutover.sh            (full cutover from Mac)"
