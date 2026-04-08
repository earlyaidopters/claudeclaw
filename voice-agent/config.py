"""Voice agent configuration -- reads from env vars set by Node.js launcher + .env fallback."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (voice-agent/ is one level down)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

VOICE_API_PORT = os.environ.get("VOICE_API_PORT", "3142")
VOICE_AGENT_ID = os.environ.get("VOICE_AGENT_ID", "main")
VOICE_CHAT_ID = os.environ.get("VOICE_CHAT_ID", "")
VOICE_PORT = os.environ.get("VOICE_PORT", "8765")

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("VOICE_AGENT_OPENAI_MODEL", "gpt-4.1")

# ElevenLabs for voice agent (separate from voice notes)
# Priority: VOICE_AGENT_* (dedicated voice agent vars) → VOICE_ELEVENLABS_* (launcher/yaml) → ELEVENLABS_* (global fallback)
ELEVENLABS_VOICE_ID = (
    os.environ.get("VOICE_AGENT_ELEVENLABS_VOICE_ID") or
    os.environ.get("VOICE_ELEVENLABS_VOICE_ID") or
    os.environ.get("ELEVENLABS_VOICE_ID") or
    ""
)
ELEVENLABS_MODEL_ID = (
    os.environ.get("VOICE_AGENT_ELEVENLABS_MODEL") or
    os.environ.get("VOICE_ELEVENLABS_MODEL") or
    os.environ.get("ELEVENLABS_MODEL_ID") or
    "eleven_turbo_v2_5"
)
