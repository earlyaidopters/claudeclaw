"""
War Room configuration.
Resolves project root and reads env vars needed by the voice server.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Project root is one level up from this file (warroom/)
PROJECT_ROOT = Path(__file__).parent.parent

# Load .env from project root
load_dotenv(PROJECT_ROOT / ".env")

# ── Mode ──────────────────────────────────────────────────────────────────────
# "live"   = Gemini Live end-to-end speech-to-speech (uses GOOGLE_API_KEY)
# "legacy" = Deepgram STT + ElevenLabs TTS (Nikki's voice — default)
MODE: str = os.getenv("WARROOM_MODE", "legacy")

# ── Ports ─────────────────────────────────────────────────────────────────────
WARROOM_PORT: int = int(os.getenv("WARROOM_PORT", "7860"))

# ── API keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")

CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "")

# ── Agent bridge ──────────────────────────────────────────────────────────────
# Path to the Node.js CLI that spawns Claude Code for a given agent
AGENT_BRIDGE_PATH: str = os.getenv(
    "AGENT_BRIDGE_PATH",
    str(PROJECT_ROOT / "dist" / "agent-voice-bridge.js"),
)

# ── Agent IDs ─────────────────────────────────────────────────────────────────
DEFAULT_AGENT = "main"
KNOWN_AGENTS = ["main", "comms", "content", "ops", "research"]

# ── Voices ────────────────────────────────────────────────────────────────────
_voices_path = Path(__file__).parent / "voices.json"


def load_voices() -> dict:
    """Load voice mappings from voices.json."""
    if not _voices_path.exists():
        return {}
    with open(_voices_path) as f:
        return json.load(f)


VOICES: dict = load_voices()


def get_voice(agent_id: str) -> dict:
    """Return voice config for an agent, falling back to main."""
    return VOICES.get(agent_id, VOICES.get("main", {}))
