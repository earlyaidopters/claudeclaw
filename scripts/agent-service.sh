#!/bin/bash
# ClaudeClaw Agent Service Manager
# Installs/uninstalls a launchd plist (macOS) or systemd unit (Linux) for an agent.
#
# Usage:
#   bash scripts/agent-service.sh install comms
#   bash scripts/agent-service.sh uninstall comms

set -e
cd "$(dirname "$0")/.."

ACTION=$1
AGENT_ID=$2
PROJECT_DIR=$(pwd)
NODE_PATH=$(which node)

if [ -z "$ACTION" ] || [ -z "$AGENT_ID" ]; then
  echo "Usage: agent-service.sh <install|uninstall> <agent-id>"
  echo "Example: agent-service.sh install comms"
  exit 1
fi

SERVICE_NAME="com.claudeclaw.agent-${AGENT_ID}"

if [ "$(uname)" = "Darwin" ]; then
  # macOS: launchd plist
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST_PATH="$PLIST_DIR/${SERVICE_NAME}.plist"

  if [ "$ACTION" = "install" ]; then
    mkdir -p "$PLIST_DIR"
    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${PROJECT_DIR}/dist/index.js</string>
    <string>--agent</string>
    <string>${AGENT_ID}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROJECT_DIR}/store/agent-${AGENT_ID}.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_DIR}/store/agent-${AGENT_ID}.err</string>
</dict>
</plist>
PLIST

    launchctl load "$PLIST_PATH"
    echo "Installed and started: $PLIST_PATH"
    echo "Logs: store/agent-${AGENT_ID}.log"

  elif [ "$ACTION" = "uninstall" ]; then
    if [ -f "$PLIST_PATH" ]; then
      launchctl unload "$PLIST_PATH" 2>/dev/null || true
      rm "$PLIST_PATH"
      echo "Uninstalled: $SERVICE_NAME"
    else
      echo "Service not found: $PLIST_PATH"
    fi
  fi

else
  # Linux: systemd user unit
  UNIT_DIR="$HOME/.config/systemd/user"
  UNIT_PATH="$UNIT_DIR/${SERVICE_NAME}.service"

  if [ "$ACTION" = "install" ]; then
    mkdir -p "$UNIT_DIR"
    cat > "$UNIT_PATH" << UNIT
[Unit]
Description=ClaudeClaw Agent: ${AGENT_ID}
After=network.target

[Service]
Type=simple
ExecStart=${NODE_PATH} ${PROJECT_DIR}/dist/index.js --agent ${AGENT_ID}
WorkingDirectory=${PROJECT_DIR}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
UNIT

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME"
    systemctl --user start "$SERVICE_NAME"
    echo "Installed and started: $SERVICE_NAME"
    echo "Logs: journalctl --user -u $SERVICE_NAME -f"

  elif [ "$ACTION" = "uninstall" ]; then
    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$UNIT_PATH"
    systemctl --user daemon-reload
    echo "Uninstalled: $SERVICE_NAME"
  fi
fi
