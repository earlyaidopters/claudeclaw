"""
Kokoro mode for War Room (fork-specific, not in upstream).

Uses Kokoro TTS (Docker, port 8880) as the TTS backend, with Groq
Whisper cloud for STT. Reuses the legacy-mode pipeline shape
(STT → router → agent-bridge → TTS).

Pros over Voxtral MLX local:
  - Much higher voice quality (Kokoro is top-tier OSS TTS)
  - Comparable or lower latency
  - Already running as Docker on port 8880 (no extra deps)

Cons:
  - Only one French voice available: ff_siwis
  - Still depends on Claude CLI spawn per turn (3-5 s total latency)
  - Runs in Docker (more resource overhead than MLX native)

Selected via WARROOM_MODE=kokoro.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_KOKORO_URL = "http://localhost:8880"
DEFAULT_KOKORO_VOICE = "ff_siwis"  # Kokoro's only French female voice (2026-04)
DEFAULT_KOKORO_MODEL = "kokoro"
GROQ_STT_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_STT_MODEL = "whisper-large-v3-turbo"


def _require_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        raise RuntimeError(
            f"WARROOM_MODE=kokoro requires {key} in the environment. "
            f"Set it in .env or export it before launching warroom."
        )
    return val


def check_required_keys() -> None:
    """Fail fast if kokoro mode is selected without the required keys."""
    _require_env("GROQ_API_KEY")
    url = os.environ.get("KOKORO_LOCAL_URL", DEFAULT_KOKORO_URL)
    logger.info("kokoro mode: using Kokoro at %s", url)


def _build_stt_service():
    """Groq Whisper STT via OpenAI-compatible pipecat service.

    Forces French language (Whisper default is auto-detect and often
    misreads spoken French as English).
    """
    from pipecat.services.openai.stt import OpenAISTTService
    from pipecat.transcriptions.language import Language

    stt_lang = os.environ.get("GROQ_STT_LANGUAGE", "fr").lower()
    language = Language(stt_lang) if stt_lang else Language.FR

    return OpenAISTTService(
        api_key=_require_env("GROQ_API_KEY"),
        base_url=GROQ_STT_BASE_URL,
        model=os.environ.get("GROQ_STT_MODEL", GROQ_STT_MODEL),
        language=language,
    )


def _build_tts_service():
    """Kokoro TTS via OpenAI-compatible /v1/audio/speech endpoint.

    Pipecat's OpenAITTSService enforces the OpenAI-official voice list.
    We pre-register all Kokoro voices we might need so agent-switching
    doesn't trip on KeyError.
    """
    from pipecat.services.openai.tts import OpenAITTSService, VALID_VOICES

    voice = os.environ.get("KOKORO_VOICE", DEFAULT_KOKORO_VOICE)
    # Pre-register all Kokoro voices agents might switch to at runtime.
    # Kokoro only has one French voice (ff_siwis, Voice Assistant Alice),
    # so all agents share it — but future-proof the mapping.
    for kokoro_voice in ("ff_siwis",):
        VALID_VOICES.setdefault(kokoro_voice, kokoro_voice)
    VALID_VOICES.setdefault(voice, voice)

    kokoro_url = os.environ.get("KOKORO_LOCAL_URL", DEFAULT_KOKORO_URL)
    return OpenAITTSService(
        api_key="not-needed",  # local docker server, no auth
        base_url=f"{kokoro_url}/v1",
        voice=voice,
        model=os.environ.get("KOKORO_MODEL", DEFAULT_KOKORO_MODEL),
    )


async def run_kokoro_mode():
    """
    Entry point for WARROOM_MODE=kokoro.

    Reuses the legacy-mode pipeline shape (STT → router → agent-bridge → TTS),
    swapping Deepgram→Groq and Cartesia→Kokoro.
    """
    check_required_keys()

    from server import run_legacy_mode_with_services  # type: ignore

    logger.info(
        "kokoro mode: starting with STT=Groq Whisper, TTS=Kokoro Docker"
    )
    await run_legacy_mode_with_services(
        stt_service=_build_stt_service(),
        tts_service=_build_tts_service(),
        mode_name="kokoro",
    )
