#!/bin/bash
# One-time setup for the Python voice agent.
# Creates a venv and installs dependencies from requirements.txt.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICE_DIR="$SCRIPT_DIR/../voice-agent"

if [ ! -d "$VOICE_DIR" ]; then
  echo "voice-setup: voice-agent/ directory not found at $VOICE_DIR" >&2
  exit 1
fi

echo "Setting up Python virtual environment..."

cd "$VOICE_DIR"

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "Created venv at $VOICE_DIR/venv"
else
  echo "venv already exists at $VOICE_DIR/venv"
fi

# Activate and install
source venv/bin/activate || source venv/Scripts/activate 2>/dev/null
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Voice agent setup complete."
echo "Dependencies installed in $VOICE_DIR/venv"
echo ""
echo "Next steps:"
echo "  1. Set VOICE_AGENT_* vars in .env"
echo "  2. Configure Twilio (see docs/voice-agent-plan.md, Step 5)"
echo "  3. Run: npm start"
