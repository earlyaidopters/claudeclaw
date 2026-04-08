#!/bin/bash
# Trigger an outbound phone call via Twilio, routed to the Pipecat voice agent.
# Usage: outbound-call.sh ["objective"]
# If no number given, uses VOICE_OUTBOUND_NUMBER from .env (Ben's phone).
# Optional objective string is passed to the voice agent via Twilio custom params.
#
# Examples:
#   outbound-call.sh                                          # calls Ben, no objective
#   outbound-call.sh "Daily standup -- ask what's on the plate"
#   outbound-call.sh "Ben hasn't responded in 2 hours, check in"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "outbound-call.sh: .env not found at $ENV_FILE" >&2
  exit 1
fi

ACCOUNT_SID=$(grep -E '^TWILIO_ACCOUNT_SID=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
AUTH_TOKEN=$(grep -E '^TWILIO_AUTH_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
FROM_NUMBER=$(grep -E '^VOICE_AGENT_PHONE_NUMBER=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
TUNNEL_HOST=$(grep -E '^VOICE_TUNNEL_HOSTNAME=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DEFAULT_TO=$(grep -E '^VOICE_OUTBOUND_NUMBER=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$ACCOUNT_SID" ] || [ -z "$AUTH_TOKEN" ]; then
  echo "outbound-call.sh: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set in .env" >&2
  exit 1
fi

if [ -z "$FROM_NUMBER" ]; then
  echo "outbound-call.sh: VOICE_AGENT_PHONE_NUMBER not set in .env" >&2
  exit 1
fi

if [ -z "$TUNNEL_HOST" ]; then
  echo "outbound-call.sh: VOICE_TUNNEL_HOSTNAME not set in .env" >&2
  exit 1
fi

TO_NUMBER="$DEFAULT_TO"
if [ -z "$TO_NUMBER" ]; then
  echo "outbound-call.sh: VOICE_OUTBOUND_NUMBER not set in .env" >&2
  exit 1
fi

# Optional objective (first argument)
OBJECTIVE="${1:-}"

# TwiML: connects the call to Pipecat WebSocket, with optional objective as custom param
if [ -n "$OBJECTIVE" ]; then
  # Escape XML special chars in objective
  SAFE_OBJ=$(echo "$OBJECTIVE" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')
  TWIML="<Response><Connect><Stream url=\"wss://${TUNNEL_HOST}/ws\"><Parameter name=\"objective\" value=\"${SAFE_OBJ}\" /></Stream></Connect></Response>"
else
  TWIML="<Response><Connect><Stream url=\"wss://${TUNNEL_HOST}/ws\" /></Connect></Response>"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json" \
  -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
  --data-urlencode "To=${TO_NUMBER}" \
  --data-urlencode "From=${FROM_NUMBER}" \
  --data-urlencode "Twiml=${TWIML}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  CALL_SID=$(echo "$BODY" | grep -o '"sid": *"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Call initiated: $CALL_SID"
else
  echo "outbound-call.sh: Twilio API error ($HTTP_CODE): $BODY" >&2
  exit 1
fi
