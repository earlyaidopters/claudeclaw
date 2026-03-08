#!/bin/bash
# ClaudeClaw Agent Creator
# Usage: npm run agent:create
# Or:    bash scripts/agent-create.sh

set -e
cd "$(dirname "$0")/.."

echo "=== ClaudeClaw Agent Creator ==="
echo ""

# Step 1: Pick a template or start blank
echo "Available templates:"
echo "  1. comms     -- Email, Slack, WhatsApp, YouTube comments, Skool, LinkedIn"
echo "  2. content   -- YouTube, LinkedIn, writing, trend research"
echo "  3. ops       -- Calendar, billing, Stripe, Gumroad, admin"
echo "  4. research  -- Deep research, academic, competitive intel"
echo "  5. blank     -- Start from the _template"
echo ""
read -p "Pick a template (1-5): " TEMPLATE_NUM

case $TEMPLATE_NUM in
  1) TEMPLATE="comms" ;;
  2) TEMPLATE="content" ;;
  3) TEMPLATE="ops" ;;
  4) TEMPLATE="research" ;;
  5) TEMPLATE="_template" ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

# Step 2: Name the agent
read -p "Agent ID (lowercase, no spaces, e.g. 'comms'): " AGENT_ID

if [ "$AGENT_ID" = "main" ]; then
  echo "Error: 'main' is reserved for the default agent. Choose a different name."
  exit 1
fi

# Step 3: Resolve CLAUDECLAW_CONFIG from environment or .env file
CLAUDECLAW_CONFIG_RAW="${CLAUDECLAW_CONFIG:-$(grep '^CLAUDECLAW_CONFIG=' .env 2>/dev/null | cut -d'=' -f2-)}"
if [ -z "$CLAUDECLAW_CONFIG_RAW" ]; then
  echo "Error: CLAUDECLAW_CONFIG is not set."
  echo "Set it in your .env file or as an environment variable before creating agents."
  exit 1
fi
# Expand leading ~ to $HOME
CLAUDECLAW_CONFIG_PATH="${CLAUDECLAW_CONFIG_RAW/#\~/$HOME}"

AGENT_DIR="$CLAUDECLAW_CONFIG_PATH/agents/$AGENT_ID"

if [ -f "$AGENT_DIR/agent.yaml" ]; then
  echo "Agent '$AGENT_ID' already exists at $AGENT_DIR"
  read -p "Overwrite? (y/N): " OVERWRITE
  if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Step 4: Copy template files from repo into config dir
mkdir -p "$AGENT_DIR"
cp "agents/$TEMPLATE/CLAUDE.md" "$AGENT_DIR/CLAUDE.md"
cp "agents/$TEMPLATE/agent.yaml.example" "$AGENT_DIR/agent.yaml.example"

# Step 5: Create Telegram bot
ENV_KEY=$(echo "${AGENT_ID}_BOT_TOKEN" | tr '[:lower:]' '[:upper:]')
echo ""
echo "Now create a Telegram bot for this agent:"
echo ""
echo "  1. Open Telegram and message @BotFather"
echo "  2. Send /newbot"
AGENT_ID_CAP="$(echo "$AGENT_ID" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"
  echo "  3. Name it something like 'Mark $AGENT_ID_CAP' or 'ClaudeClaw $AGENT_ID_CAP'"
echo "  4. Give it a username like 'mark_${AGENT_ID}_bot'"
echo "  5. Copy the token BotFather gives you"
echo ""
read -p "Paste the bot token here (or press Enter to skip): " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
  echo "No token provided. You can add it to .env later as:"
  echo "  $ENV_KEY=your_token_here"
else
  # Check if token already exists in .env
  if grep -q "^$ENV_KEY=" .env 2>/dev/null; then
    echo "Updating existing $ENV_KEY in .env"
    sed -i '' "s|^$ENV_KEY=.*|$ENV_KEY=$BOT_TOKEN|" .env
  else
    echo "" >> .env
    echo "# Agent: $AGENT_ID" >> .env
    echo "$ENV_KEY=$BOT_TOKEN" >> .env
  fi
  echo "Token saved to .env as $ENV_KEY"
fi

# Step 6: Create agent.yaml from example
sed "s/telegram_bot_token_env:.*/telegram_bot_token_env: $ENV_KEY/" \
  "$AGENT_DIR/agent.yaml.example" > "$AGENT_DIR/agent.yaml"

# Step 7: Show chat ID info
CHAT_ID=$(grep '^ALLOWED_CHAT_ID=' .env 2>/dev/null | cut -d'=' -f2-)
if [ -n "$CHAT_ID" ]; then
  echo ""
  echo "Using your existing ALLOWED_CHAT_ID: $CHAT_ID"
fi

# Step 8: Build
echo ""
echo "Building..."
npm run build

echo ""
echo "Agent '$AGENT_ID' created at $AGENT_DIR/"
echo ""
echo "To start:  npm start -- --agent $AGENT_ID"
echo "To test:   Send a message to your new bot in Telegram"
echo ""

# Step 9: Offer to test start
read -p "Start the agent now for a quick test? (y/N): " START_NOW
if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
  echo "Starting agent '$AGENT_ID'... Press Ctrl+C to stop."
  echo ""
  node dist/index.js --agent "$AGENT_ID"
fi
