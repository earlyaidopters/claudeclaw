"""
War Room WebSocket server — port 7860.

Dual mode:
  live   (default) — Gemini Live handles speech recognition, reasoning, and TTS
  legacy           — Deepgram STT + Claude Code reasoning + Cartesia TTS

Start with: python warroom/server.py
Or via npm: npm run warroom
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Ensure project root is on the Python path so `from warroom.X import Y` works
sys.path.insert(0, str(Path(__file__).parent.parent))

from warroom.agent_bridge import call_agent
from warroom.config import (
    CARTESIA_API_KEY,
    DEEPGRAM_API_KEY,
    GEMINI_API_KEY,
    MODE,
    WARROOM_PORT,
)
from warroom.personas import get_gemini_voice, get_intro, get_system_prompt, list_personas
from warroom.router import RouteDecision, route, set_pinned_agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ── Dependency check ──────────────────────────────────────────────────────────
def _check_deps() -> bool:
    """Verify pipecat is installed."""
    try:
        import pipecat  # noqa: F401
        return True
    except ImportError:
        logger.error(
            "pipecat-ai not installed. Run: pip install -r warroom/requirements.txt"
        )
        return False


# ── Gemini Live mode ────────────────────────────────────────────
async def _run_gemini_live(host: str, port: int) -> None:
    """
    Gemini Live pipeline: browser audio -> Gemini (speech+reasoning+TTS) -> browser.

    Gemini handles everything end-to-end. We intercept transcriptions to route
    to the right agent and inject the agent's response back into Gemini's context.

    In pipecat 1.0+ the transport owns the WebSocket server itself; this
    coroutine builds the pipeline once and runs it for the life of the process.
    """
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.aggregators.llm_context import LLMContext
        from pipecat.processors.aggregators.llm_response_universal import (
            LLMContextAggregatorPair,
        )
        from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
        from pipecat.transports.websocket.server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error("Missing pipecat dependency: %s", e)
        return

    logger.info("Starting Gemini Live pipeline on ws://%s:%d", host, port)

    transport = WebsocketServerTransport(
        params=WebsocketServerParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
        host=host,
        port=port,
    )

    # Build the system instruction from all agent personas
    personas_summary = "\n".join(
        f"- {p['agent_id']} ({p['title']}): voice={p['voice']}"
        for p in list_personas()
    )

    system_instruction = f"""You are the War Room coordinator for ClaudeClaw OS.
You coordinate a team of specialized AI agents:
{personas_summary}

When the user addresses a specific agent by name or role, route their request
to that agent and relay the response. For general questions, handle them yourself
as the Hand of the King (Main agent).

Keep voice responses concise — under 3 sentences unless detail is truly needed.
No em dashes. No AI clichés.
"""

    llm = GeminiLiveLLMService(
        api_key=GEMINI_API_KEY,
        voice_id=get_gemini_voice("main"),
        system_instruction=system_instruction,
    )

    context = LLMContext()
    context_aggregator = LLMContextAggregatorPair(context)

    # SileroVADAnalyzer is attached to the transport params above—it's not a
    # pipeline processor in pipecat 1.0.
    pipeline = Pipeline([
        transport.input(),
        context_aggregator.user(),
        llm,
        transport.output(),
        context_aggregator.assistant(),
    ])

    # In pipecat 1.0 PipelineParams accepts kwargs only; interruptions are
    # handled automatically by the VAD/turn-tracking observers.
    task = PipelineTask(pipeline, params=PipelineParams())

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        logger.info("War Room client connected (Gemini Live mode)")
        intro = get_intro("main")
        await task.queue_frames([context_aggregator.user().get_context_frame()])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        logger.info("War Room client disconnected (Gemini Live mode)")

    runner = PipelineRunner()
    await runner.run(task)


# ── Legacy mode (Deepgram STT + Claude Code + Cartesia TTS) ──────────────────
async def _run_legacy(host: str, port: int) -> None:
    """
    Legacy pipeline: Deepgram STT -> router -> Claude Code -> Cartesia TTS.
    More moving parts, more control over each stage.

    In pipecat 1.0+ the transport owns the WebSocket server itself; this
    coroutine builds the pipeline once and runs it for the life of the process.
    """
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.frames.frames import (
            TextFrame,
            TranscriptionFrame,
        )
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
        from pipecat.services.cartesia.tts import CartesiaTTSService
        from pipecat.services.deepgram.stt import DeepgramSTTService
        from pipecat.transports.websocket.server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error("Missing pipecat dependency for legacy mode: %s", e)
        return

    logger.info("Starting legacy pipeline (Deepgram + Cartesia) on ws://%s:%d", host, port)

    transport = WebsocketServerTransport(
        params=WebsocketServerParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
        host=host,
        port=port,
    )

    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)

    tts = CartesiaTTSService(
        api_key=CARTESIA_API_KEY,
        # overridden per-agent in AgentBridgeProcessor
        settings=CartesiaTTSService.Settings(voice="default"),
    )

    class AgentBridgeProcessor(FrameProcessor):
        """Routes TranscriptionFrames to the correct Claude Code agent."""

        def __init__(self, tts_service):
            super().__init__()
            self._tts = tts_service
            self._chat_id = "warroom-legacy"

        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)

            if not isinstance(frame, TranscriptionFrame):
                await self.push_frame(frame, direction)
                return

            transcript = frame.text.strip()
            if not transcript:
                return

            logger.info("Transcription: %s", transcript)
            decision: RouteDecision = route(transcript)

            # Handle pin commands
            lower = transcript.lower()
            if lower.startswith("pin ") or lower.startswith("stick with "):
                agent_name = transcript.split(None, 1)[-1].strip().lower()
                set_pinned_agent(agent_name if agent_name != "off" else None)
                await self.push_frame(
                    TextFrame(f"Got it. Pinned to {agent_name}." if agent_name != "off" else "Unpinned."),
                    FrameDirection.DOWNSTREAM,
                )
                return

            logger.info("Routing to agent: %s", decision.agent_id)

            # Run agent (blocking in thread to not block event loop)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: call_agent(
                    decision.agent_id,
                    decision.prompt,
                    chat_id=self._chat_id,
                    quick=True,  # voice mode prefers fast 3-turn responses
                ),
            )

            if response:
                await self.push_frame(TextFrame(response), FrameDirection.DOWNSTREAM)

    bridge = AgentBridgeProcessor(tts)

    # SileroVADAnalyzer is attached to the transport params above—it's not a
    # pipeline processor in pipecat 1.0.
    pipeline = Pipeline([
        transport.input(),
        stt,
        bridge,
        tts,
        transport.output(),
    ])

    # In pipecat 1.0 PipelineParams accepts kwargs only; interruptions are
    # handled automatically by the VAD/turn-tracking observers.
    task = PipelineTask(pipeline, params=PipelineParams())

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        logger.info("War Room client connected (legacy mode)")

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        logger.info("War Room client disconnected (legacy mode)")

    runner = PipelineRunner()
    await runner.run(task)


# ── WebSocket server wrapper ────────────────────────────────────
async def _serve():
    """
    Start the War Room pipeline.

    Under pipecat 1.0 the transport owns the underlying `websockets` server,
    so we just hand off host/port to the chosen mode and let PipelineRunner
    drive it.
    """
    run = _run_gemini_live if MODE == "live" else _run_legacy

    logger.info("War Room starting on ws://localhost:%d (mode=%s)", WARROOM_PORT, MODE)
    logger.info("Open http://localhost:3141 -> War Room tab, or visit the War Room UI directly")

    await run("0.0.0.0", WARROOM_PORT)


def main():
    if not _check_deps():
        sys.exit(1)

    if not GEMINI_API_KEY and MODE == "live":
        logger.error("GOOGLE_API_KEY is not set. Required for Gemini Live mode.")
        sys.exit(1)

    if MODE == "legacy":
        if not DEEPGRAM_API_KEY:
            logger.error("DEEPGRAM_API_KEY is not set. Required for legacy mode STT.")
            sys.exit(1)
        if not CARTESIA_API_KEY:
            logger.error("CARTESIA_API_KEY is not set. Required for legacy mode TTS.")
            sys.exit(1)

    asyncio.run(_serve())


if __name__ == "__main__":
    main()
