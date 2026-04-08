"""Pipecat voice agent: FastAPI + Twilio WebSocket + Deepgram STT + Ollama LLM + ElevenLabs TTS.

Based on the official pipecat-ai/pipecat-examples/twilio-chatbot pattern.
Minimal configuration -- let Pipecat defaults handle turn detection, VAD, and audio.
"""

import asyncio
import logging
import os

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.responses import Response

from config import (
    VOICE_AGENT_ID,
    VOICE_PORT,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID,
    VOICE_API_PORT,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
)
from memory_client import get_agent_config
from memory_processor import MemoryProcessor, AssistantResponseTracker
from prompt_builder import build_voice_prompt

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame, EndTaskFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
VOICE_CHAT_ID = os.environ.get("VOICE_CHAT_ID", "")

app = FastAPI()

claude_md_content = ""


@app.on_event("startup")
async def startup():
    global claude_md_content
    logger.info(f"Starting voice agent for {VOICE_AGENT_ID}...")

    # Load CLAUDE.md for agent identity
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    claude_md_path = os.path.join(project_root, "CLAUDE.md")
    if os.path.exists(claude_md_path):
        with open(claude_md_path, "r", encoding="utf-8") as f:
            claude_md_content = f.read()
        logger.info(f"Loaded CLAUDE.md ({len(claude_md_content)} chars)")

    logger.info(f"Voice agent ready: model={OPENAI_MODEL}")


@app.get("/twiml")
async def twiml():
    """TwiML endpoint for inbound Twilio calls -- connects to the WebSocket on this same server."""
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response><Connect>'
        f'<Stream url="wss://voice-agent.claudeclaw-dashboard.work/ws" />'
        '</Connect></Response>'
    )
    return Response(content=xml, media_type="text/xml")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket accepted, parsing telephony handshake...")

    _, call_data = await parse_telephony_websocket(websocket)
    call_id = call_data.get("call_id", "unknown")
    body = call_data.get("body", {})
    call_objective = body.get("objective", "")
    logger.info(f"Call: {call_id}, objective: {call_objective or '(inbound/none)'}")

    serializer = TwilioFrameSerializer(
        stream_sid=call_data["stream_id"],
        call_sid=call_data.get("call_id", ""),
        account_sid=TWILIO_ACCOUNT_SID,
        auth_token=TWILIO_AUTH_TOKEN,
    )

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
        ),
    )

    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)

    llm = OpenAILLMService(
        api_key=OPENAI_API_KEY,
        settings=OpenAILLMService.Settings(model=OPENAI_MODEL),
    )

    # End call tool -- the LLM calls this when the conversation is over
    end_call_function = FunctionSchema(
        name="end_call",
        description="End the phone call. Call this when the user says goodbye, bye, talk later, see you, or any variation of ending the conversation.",
        properties={},
        required=[],
    )
    tools = ToolsSchema(standard_tools=[end_call_function])

    async def handle_end_call(params: FunctionCallParams):
        await params.result_callback({"status": "ending"})
        await task.queue_frame(EndTaskFrame(), FrameDirection.UPSTREAM)

    llm.register_function("end_call", handle_end_call)

    tts = ElevenLabsTTSService(
        api_key=ELEVENLABS_API_KEY,
        settings=ElevenLabsTTSService.Settings(
            voice=ELEVENLABS_VOICE_ID,
            model=ELEVENLABS_MODEL_ID or "eleven_turbo_v2_5",
        ),
    )

    # Load weekly task file for call context
    weekly_tasks_content = ""
    try:
        import glob
        import datetime
        tasks_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "AI-OS", "Tasks")
        # Normalize path
        tasks_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "AI-OS", "Tasks"))
        today = datetime.date.today()
        for f in glob.glob(os.path.join(tasks_dir, "*_to_*.md")):
            basename = os.path.basename(f)
            parts_date = basename.replace(".md", "").split("_to_")
            if len(parts_date) == 2:
                start = datetime.date.fromisoformat(parts_date[0])
                end = datetime.date.fromisoformat(parts_date[1])
                if start <= today <= end:
                    with open(f, "r", encoding="utf-8") as fh:
                        weekly_tasks_content = fh.read()
                    break
    except Exception as e:
        logger.warning(f"Failed to load weekly tasks: {e}")

    per_call_prompt = build_voice_prompt(
        claude_md=claude_md_content,
        call_objective=call_objective or None,
        weekly_tasks=weekly_tasks_content or None,
    )

    context = LLMContext(
        messages=[{"role": "system", "content": per_call_prompt}],
        tools=tools,
    )

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    memory = MemoryProcessor(agent_id=VOICE_AGENT_ID, chat_id=VOICE_CHAT_ID)
    response_tracker = AssistantResponseTracker(memory_processor=memory)

    pipeline = Pipeline([
        transport.input(),
        stt,
        user_aggregator,
        memory,
        llm,
        response_tracker,
        tts,
        transport.output(),
        assistant_aggregator,
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected, triggering greeting")
        await asyncio.sleep(0.5)
        if call_objective:
            greeting = f"You're calling Ben. Objective: {call_objective}. Open the call naturally."
        else:
            greeting = "Ben is calling you. Pick up and say hey."
        context.add_message({"role": "user", "content": greeting})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)

    # Pipeline finished (either bot hung up or client disconnected)
    logger.info("Call ended, logging transcript and sending summary")
    await memory.log_transcript_and_notify()


if __name__ == "__main__":
    logger.info(f"Voice agent listening on 0.0.0.0:{VOICE_PORT}")
    uvicorn.run(app, host="0.0.0.0", port=int(VOICE_PORT))
