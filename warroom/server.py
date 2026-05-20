"""
War Room server — WebSocket voice pipeline + HTTP UI server.

  WS  port 7860 — Pipecat voice pipeline (Gemini Live or legacy)
  HTTP port 7861 — Serves warroom.html

Dual voice modes:
  live   (default) — Gemini Live handles speech recognition, reasoning, and TTS
  legacy           — Deepgram STT + Claude Code reasoning + Cartesia TTS

Start with: python warroom/server.py
Or via npm: npm run warroom
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

sys.path.insert(0, str(Path(__file__).parent.parent))

from warroom.agent_bridge import call_agent
from warroom.serializer import RawPCMSerializer

# VADParams imported here so both pipeline modes can use it
try:
    from pipecat.audio.vad.vad_analyzer import VADParams as _VADParams
    _VAD_PARAMS = _VADParams(
        confidence=0.1,  # debug: lowered from 0.6
        start_secs=0.3,
        stop_secs=0.5,
        min_volume=0.0,  # volume gate disabled — pyloudnorm returns -inf on 32ms chunks (too short)
    )
except Exception:
    _VAD_PARAMS = None  # pipecat not installed yet — will fail at pipeline start

from warroom.config import (
    DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    GEMINI_API_KEY,
    MODE,
    WARROOM_PORT,
)
from warroom.personas import get_gemini_voice, list_personas
from warroom.router import RouteDecision, route, set_pinned_agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ── AudioDebugProcessor (module-level so both pipelines can use it) ───────────
# Defined here, before the pipeline functions, but only instantiated when
# pipecat is actually imported.  We guard with a try/except so the module
# can still be imported even if pipecat isn't installed yet.
try:
    from pipecat.frames.frames import InputAudioRawFrame
    from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

    class AudioDebugProcessor(FrameProcessor):
        def __init__(self):
            super().__init__()
            self._count = 0

        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)
            if isinstance(frame, InputAudioRawFrame):
                self._count += 1
                if self._count % 100 == 1:
                    logger.info("AudioDebug: frame #%d arrived (%d bytes)", self._count, len(frame.audio))
            await self.push_frame(frame, direction)

except ImportError:
    AudioDebugProcessor = None  # pipecat not installed yet


# ── Patch pipecat: reject new clients when one is already active ──────────────
# Default behavior kicks the existing client, causing an infinite reconnect loop
# when multiple tabs are open. This patch closes the new connection instead.
# We patch BOTH the input handler (first line of defense) and the output's
# set_client_connection (fallback, since it also does eviction).
def _patch_pipecat_ws_transport():
    try:
        from pipecat.transports.websocket.server import (
            WebsocketServerInputTransport,
            WebsocketServerOutputTransport,
        )

        # Patch 1: input _client_handler — reject before anything else runs
        _orig_handler = WebsocketServerInputTransport._client_handler

        async def _reject_if_input_busy(self, websocket):
            if self._websocket is not None:
                logger.info(
                    "Rejecting duplicate client %s — War Room already occupied",
                    websocket.remote_address,
                )
                await websocket.close(1008, "War Room busy — close other tabs first")
                return
            await _orig_handler(self, websocket)

        WebsocketServerInputTransport._client_handler = _reject_if_input_busy

        # Patch 2: output set_client_connection — don't evict if already have one
        _orig_set_client = WebsocketServerOutputTransport.set_client_connection

        async def _reject_if_output_busy(self, websocket):
            # websocket=None means disconnect — always let that through
            if websocket is not None and self._websocket is not None:
                logger.info("Output transport: ignoring duplicate client, keeping existing")
                return
            await _orig_set_client(self, websocket)

        WebsocketServerOutputTransport.set_client_connection = _reject_if_output_busy

        logger.info("Pipecat WS transport patched: duplicate clients will be rejected")
    except Exception as e:
        logger.warning("Could not patch pipecat WS transport: %s", e)


_patch_pipecat_ws_transport()

WARROOM_DIR  = Path(__file__).parent
HTTP_PORT    = WARROOM_PORT + 1   # 7861


# ── HTTP server for warroom.html ──────────────────────────────────────────────
class WarRoomHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WARROOM_DIR), **kwargs)

    def log_message(self, fmt, *args):
        pass  # silence access logs

    def do_GET(self):
        # Redirect / to /warroom.html
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', '/warroom.html')
            self.end_headers()
        else:
            super().do_GET()


def _start_http_server():
    server = HTTPServer(('0.0.0.0', HTTP_PORT), WarRoomHTTPHandler)
    logger.info("War Room UI available at http://localhost:%d", HTTP_PORT)
    server.serve_forever()


# ── Dependency check ──────────────────────────────────────────────────────────
def _check_deps() -> bool:
    try:
        import pipecat  # noqa: F401
        return True
    except ImportError:
        logger.error("pipecat-ai not installed. Run: pip install -r warroom/requirements.txt")
        return False


# ── Gemini Live mode ──────────────────────────────────────────────────────────
async def _run_gemini_live():
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.audio.vad_processor import VADProcessor
        from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
        from pipecat.transports.websocket.server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error("Missing pipecat dependency: %s", e)
        return

    logger.info("Starting Gemini Live pipeline on ws://localhost:%d", WARROOM_PORT)

    # ── Agent routing tool ────────────────────────────────────────────────────
    # Passed to Gemini so it can call real ClaudeClaw agents instead of
    # roleplaying as them.
    route_to_agent_tool = {
        "function_declarations": [{
            "name": "route_to_agent",
            "description": (
                "Route the user's request to a specialized ClaudeClaw agent and get their response. "
                "Use this whenever the user addresses a specific agent by name or title, or asks "
                "something that requires specialized capability (research, email/comms, writing, "
                "ops/automation). For casual chat, simple questions, or status checks, answer yourself."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "enum": ["main", "research", "comms", "content", "ops"],
                        "description": (
                            "main = general tasks and default; "
                            "research = web research, analysis, fact-finding; "
                            "comms = email drafting, outreach, messaging; "
                            "content = writing, marketing copy, LinkedIn, blog posts; "
                            "ops = automation, workflows, Make/Zapier, operations"
                        ),
                    },
                    "prompt": {
                        "type": "string",
                        "description": "The user's full request to forward to the agent, verbatim.",
                    },
                },
                "required": ["agent_id", "prompt"],
            },
        }]
    }

    system_instruction = """You are the War Room dispatcher for ClaudeClaw OS.

You have a route_to_agent tool that calls real AI agents. Use it when the user asks for specialized work or addresses an agent by name. For casual questions, quick status checks, or anything you can answer in a sentence or two, just answer directly.

Agents available:
- main: general tasks, default
- research: web research, analysis
- comms: email, outreach, messaging
- content: writing, marketing, social media
- ops: automation, workflows, operations

Voice rules: extremely concise — 1 to 2 sentences max unless the task truly needs more. No em dashes. No AI clichés. When relaying an agent response, summarize it for voice — don't read a wall of text."""

    transport = WebsocketServerTransport(
        params=WebsocketServerParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            serializer=RawPCMSerializer(sample_rate=16000),
        ),
        host="0.0.0.0",
        port=WARROOM_PORT,
    )

    llm = GeminiLiveLLMService(
        api_key=GEMINI_API_KEY,
        voice_id=get_gemini_voice("main"),
        system_instruction=system_instruction,
        tools=[route_to_agent_tool],
    )

    # ── Function handler — calls the actual agent bridge ──────────────────────
    async def handle_route_to_agent(params):
        agent_id = params.arguments.get("agent_id", "main")
        prompt   = params.arguments.get("prompt", "")
        logger.info("Routing to agent=%s | prompt=%s", agent_id, prompt[:120])

        loop = asyncio.get_event_loop()
        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: call_agent(agent_id, prompt, quick=True, timeout=60),
                ),
                timeout=75,
            )
        except asyncio.TimeoutError:
            response = "The agent took too long to respond. Try a simpler request."
        except Exception as e:
            logger.error("Agent bridge error: %s", e)
            response = "Something went wrong reaching that agent."

        logger.info("Agent %s responded (%d chars)", agent_id, len(response))
        await params.result_callback({"response": response})

    llm.register_function("route_to_agent", handle_route_to_agent, timeout_secs=80)

    pipeline = Pipeline([
        transport.input(),
        AudioDebugProcessor(),
        VADProcessor(vad_analyzer=SileroVADAnalyzer(params=_VAD_PARAMS)),
        llm,
        transport.output(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(), idle_timeout_secs=None)

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        logger.info("War Room client connected (Gemini Live + agent routing active)")

    runner = PipelineRunner()
    await runner.run(task)


# ── Legacy mode (Deepgram STT + ElevenLabs TTS) ──────────────────────────────
async def _run_legacy():
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.frames.frames import TextFrame, TranscriptionFrame
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.processors.audio.vad_processor import VADProcessor
        from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        from pipecat.services.deepgram.stt import DeepgramSTTService
        from pipecat.transports.websocket.server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error("Missing pipecat dependency for legacy mode: %s", e)
        return

    # pipecat 1.x renamed TranscriptionFrame -> STTTranscriptionFrame for STT services
    try:
        from pipecat.frames.frames import STTTranscriptionFrame as _STTFrame
    except ImportError:
        _STTFrame = TranscriptionFrame  # older pipecat — same type

    logger.info("Starting legacy pipeline (Deepgram STT + ElevenLabs) on ws://localhost:%d", WARROOM_PORT)

    # Input at 16000 Hz (Silero VAD requirement); ElevenLabs outputs at 24000 Hz
    transport = WebsocketServerTransport(
        params=WebsocketServerParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            serializer=RawPCMSerializer(sample_rate=16000),
        ),
        host="0.0.0.0",
        port=WARROOM_PORT,
    )

    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY, sample_rate=16000)

    # Nikki's ElevenLabs voice — same as Telegram bot
    tts = ElevenLabsTTSService(
        api_key=ELEVENLABS_API_KEY,
        settings=ElevenLabsTTSService.Settings(voice=ELEVENLABS_VOICE_ID),
        sample_rate=24000,
    )

    class AgentBridgeProcessor(FrameProcessor):
        def __init__(self):
            super().__init__()
            self._chat_id = "warroom-legacy"

        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)
            if not isinstance(frame, (TranscriptionFrame, _STTFrame)):
                await self.push_frame(frame, direction)
                return
            transcript = frame.text.strip()
            if not transcript:
                return
            logger.info("Transcription: %s", transcript)

            # Pin commands
            lower = transcript.lower()
            if lower.startswith("pin ") or lower.startswith("stick with "):
                agent_name = transcript.split(None, 1)[-1].strip().lower()
                set_pinned_agent(agent_name if agent_name != "off" else None)
                msg = f"Pinned to {agent_name}." if agent_name != "off" else "Unpinned."
                await self.push_frame(TextFrame(msg), FrameDirection.DOWNSTREAM)
                return

            decision: RouteDecision = route(transcript)
            loop = asyncio.get_event_loop()
            try:
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: call_agent(
                            decision.agent_id, decision.prompt,
                            chat_id=self._chat_id, quick=True, timeout=60,
                        ),
                    ),
                    timeout=75,
                )
            except asyncio.TimeoutError:
                response = "That took too long. Try a simpler request."
            except Exception as e:
                logger.error("Agent bridge error: %s", e)
                response = "Something went wrong reaching that agent."

            if response:
                logger.info("Agent %s responded (%d chars)", decision.agent_id, len(response))
                await self.push_frame(TextFrame(response), FrameDirection.DOWNSTREAM)

    pipeline = Pipeline([
        transport.input(),
        AudioDebugProcessor(),
        VADProcessor(vad_analyzer=SileroVADAnalyzer(params=_VAD_PARAMS)),
        stt,
        AgentBridgeProcessor(),
        tts,
        transport.output(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(), idle_timeout_secs=None)

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        logger.info("War Room client connected (Deepgram STT + ElevenLabs Nikki voice)")

    runner = PipelineRunner()
    await runner.run(task)


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if not _check_deps():
        sys.exit(1)

    if not GEMINI_API_KEY and MODE == "live":
        logger.error("GOOGLE_API_KEY is not set. Required for Gemini Live mode.")
        sys.exit(1)

    if MODE == "legacy":
        if not DEEPGRAM_API_KEY:
            logger.error("DEEPGRAM_API_KEY is not set. Required for Deepgram STT.")
            sys.exit(1)
        if not ELEVENLABS_API_KEY:
            logger.error("ELEVENLABS_API_KEY is not set. Required for ElevenLabs TTS.")
            sys.exit(1)
        if not ELEVENLABS_VOICE_ID:
            logger.error("ELEVENLABS_VOICE_ID is not set.")
            sys.exit(1)

    # Start HTTP server in a background thread
    import threading
    t = threading.Thread(target=_start_http_server, daemon=True)
    t.start()

    runner_fn = _run_gemini_live if MODE == "live" else _run_legacy
    logger.info("War Room WS  on ws://localhost:%d  (mode=%s)", WARROOM_PORT, MODE)
    logger.info("War Room UI  at http://localhost:%d", HTTP_PORT)

    import time
    while True:
        try:
            asyncio.run(runner_fn())
        except Exception as e:
            logger.error("War Room pipeline crashed: %s — restarting in 3s...", e)
        else:
            logger.info("War Room pipeline ended — restarting in 3s...")
        time.sleep(3)
        # Clear ports before restart
        import socket
        for port in (WARROOM_PORT,):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)


if __name__ == "__main__":
    main()
