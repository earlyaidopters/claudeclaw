"""Daily.co voice agent bridge.

Short-lived Pipecat pipeline that joins a Daily.co room as a named
participant and runs the same Gemini Live speech-to-speech loop the
War Room uses, but over DailyTransport instead of the local WebSocket
transport. Reuses personas, the answer_as_agent router, and the whole
tool set from server.py.

Spawned by src/meet-cli.ts cmdJoinDaily per meeting. Exits when the
room expires, all humans leave, or someone kills the process.

Usage:
    python warroom/daily_agent.py \
        --room-url https://cloud-xxx.daily.co/<room> \
        --agent main \
        --mode direct \
        [--token <daily_meeting_token>] \
        [--brief /tmp/meeting_brief_xxx.txt]
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

from pipecat.frames.frames import LLMContextFrame, OutputImageRawFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.transports.daily.transport import DailyTransport, DailyParams
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.audio.vad.silero import SileroVADAnalyzer

try:
    from PIL import Image  # bundled via Pipecat's dependencies
except ImportError:
    Image = None  # type: ignore

# Reuse the warroom bits: tool handlers, persona loader, env helpers.
from server import (  # noqa: E402
    VALID_AGENTS,
    delegate_to_agent_handler,
    get_time_handler,
    list_agents_handler,
    answer_as_agent_handler,
    check_required_keys,
)
from personas import get_persona  # noqa: E402
from config import AGENT_VOICES  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("daily_agent")


def load_env():
    root = Path(__file__).resolve().parent.parent
    env_path = root / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded env from %s", env_path)


AVATARS_DIR = Path(__file__).resolve().parent / "avatars"
PROFILE_PIC_SIZE = 720  # square, matches DailyParams below


def load_avatar_frame(agent_id: str, size: int = PROFILE_PIC_SIZE) -> OutputImageRawFrame | None:
    """Load the agent's meet avatar and convert it to an OutputImageRawFrame
    so Daily's camera-out track displays it as a static profile picture.

    Avatar preference order (same as meet-cli for Pika):
      1. <agent>-meet.png (the anime/Shiro variant we generated)
      2. <agent>.png (the warroom sidebar cartoon)
    """
    if Image is None:
        logger.warning("PIL not available, skipping profile picture")
        return None

    candidates = [
        AVATARS_DIR / f"{agent_id}-meet.png",
        AVATARS_DIR / f"{agent_id}-meet.jpg",
        AVATARS_DIR / f"{agent_id}.png",
        AVATARS_DIR / f"{agent_id}.jpg",
    ]
    path = next((p for p in candidates if p.exists() and p.stat().st_size > 1024), None)
    if path is None:
        logger.warning("No avatar found for agent=%s, camera-out will be blank", agent_id)
        return None

    try:
        img = Image.open(path).convert("RGB")
        img = img.resize((size, size), Image.LANCZOS)
        frame = OutputImageRawFrame(
            image=img.tobytes(),
            size=(size, size),
            format="RGB",
        )
        logger.info("Loaded profile picture: %s -> %dx%d", path, size, size)
        return frame
    except Exception as exc:
        logger.warning("Failed to load avatar %s: %s", path, exc)
        return None


async def run_agent(args: argparse.Namespace) -> None:
    load_env()
    check_required_keys({"GOOGLE_API_KEY": "Google AI (Gemini Live native audio)"})

    agent = args.agent
    if agent not in VALID_AGENTS:
        logger.error("Invalid agent: %s. Known: %s", agent, sorted(VALID_AGENTS))
        sys.exit(2)

    mode = args.mode if args.mode in {"direct", "auto"} else "direct"

    # Voice picks main's voice in auto mode (Gemini is acting as router)
    # and the agent's own voice in direct mode.
    voice_agent = "main" if mode == "auto" else agent
    voice_entry = AGENT_VOICES.get(voice_agent) or AGENT_VOICES.get("main", {})
    voice = os.environ.get("WARROOM_LIVE_VOICE") or voice_entry.get("gemini_voice") or "Charon"

    # Resolve system prompt. Priority: --brief file, else agent persona.
    system_prompt: str
    if args.brief and Path(args.brief).exists():
        brief_text = Path(args.brief).read_text(encoding="utf-8").strip()
        persona = get_persona(agent, mode=mode)
        # Prepend the persona so the agent still has its identity + rules
        # even when the brief is the main source of meeting context.
        system_prompt = f"{persona}\n\n=== Meeting briefing ===\n{brief_text}"
        logger.info("Loaded brief from %s (%d chars)", args.brief, len(brief_text))
    else:
        system_prompt = get_persona(agent, mode=mode)

    # Transport: audio in + out, camera out as a static profile picture.
    # Silero VAD is critical here because unlike the warroom websocket
    # flow, Daily delivers real mic audio and we need end-of-turn
    # detection to feed the LLM aggregator properly.
    #
    # Camera-out profile-picture setup -- the non-obvious bit:
    #   Daily's join-call code computes
    #     camera_enabled = video_out_enabled AND camera_out_enabled
    #   and Pipecat's BaseOutputTransport.handle_image_frame short-circuits
    #   on `if not video_out_enabled: return`. Both `video_out_*` and
    #   `camera_out_*` must be enabled for a single OutputImageRawFrame to
    #   actually land on Daily's camera track. Also, `_draw_image` resizes
    #   the frame to (video_out_width, video_out_height) on every tick,
    #   which defaults to 1024x768 -- if those don't match the frame size,
    #   a 720x720 square gets stretched into a rectangle. We set both
    #   pairs to the same square so there's no resizing surprise.
    params = DailyParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        audio_in_sample_rate=16000,
        audio_out_sample_rate=24000,
        microphone_out_enabled=True,
        camera_in_enabled=False,
        camera_out_enabled=True,
        camera_out_is_live=False,
        camera_out_width=PROFILE_PIC_SIZE,
        camera_out_height=PROFILE_PIC_SIZE,
        camera_out_color_format="RGB",
        video_in_enabled=False,
        video_out_enabled=True,
        video_out_is_live=False,
        video_out_width=PROFILE_PIC_SIZE,
        video_out_height=PROFILE_PIC_SIZE,
        video_out_color_format="RGB",
        vad_enabled=True,
        vad_audio_passthrough=True,
        vad_analyzer=SileroVADAnalyzer(),
    )

    bot_display_name = args.bot_name or agent.capitalize()

    transport = DailyTransport(
        room_url=args.room_url,
        token=args.token,
        bot_name=bot_display_name,
        params=params,
    )

    # Toolset: same shape as server.py live mode. answer_as_agent only
    # registers in auto mode because otherwise the pinned agent IS the
    # responder, no routing needed.
    delegate_schema = FunctionSchema(
        name="delegate_to_agent",
        description=(
            "Delegate a unit of work to one of the user's sub-agents. The sub-agent runs "
            "the task asynchronously through the full Claude Code environment and "
            "pings the user on Telegram when finished. After calling this, tell the user "
            "verbally that you've queued it. DO NOT wait for the result."
        ),
        properties={
            "agent": {
                "type": "string",
                "enum": sorted(VALID_AGENTS),
                "description": "Which sub-agent should handle this work.",
            },
            "title": {"type": "string", "description": "Short task label (3-8 words)."},
            "prompt": {"type": "string", "description": "Full instructions for the sub-agent."},
            "priority": {"type": "integer", "description": "Task priority 0-10 (default 5)."},
        },
        required=["agent", "title", "prompt"],
    )
    get_time_schema = FunctionSchema(
        name="get_time",
        description="Get the current wall clock time in the user's local timezone.",
        properties={}, required=[],
    )
    list_agents_schema = FunctionSchema(
        name="list_agents",
        description="List the user's sub-agents with one-line role descriptions.",
        properties={}, required=[],
    )
    standard_tools = [delegate_schema, get_time_schema, list_agents_schema]

    if mode == "auto":
        answer_schema = FunctionSchema(
            name="answer_as_agent",
            description=(
                "Route the user's question to the best-fit specialist and return their answer "
                "verbatim. Use this for every substantive question in auto mode."
            ),
            properties={
                "agent": {
                    "type": "string",
                    "enum": sorted(VALID_AGENTS),
                    "description": "Which specialist should answer.",
                },
                "question": {"type": "string", "description": "The user's full question."},
            },
            required=["agent", "question"],
        )
        standard_tools.append(answer_schema)

    tools = ToolsSchema(standard_tools=standard_tools)
    context = LLMContext(messages=[], tools=tools)

    live_kwargs = dict(
        api_key=os.environ["GOOGLE_API_KEY"],
        system_instruction=system_prompt,
        inference_on_context_initialization=False,
    )
    live_kwargs["voice_id"] = voice
    model = os.environ.get("WARROOM_LIVE_MODEL")
    if model:
        live_kwargs["model"] = model

    llm = GeminiLiveLLMService(**live_kwargs)
    llm.register_function("delegate_to_agent", delegate_to_agent_handler)
    llm.register_function("get_time", get_time_handler)
    llm.register_function("list_agents", list_agents_handler)
    if mode == "auto":
        llm.register_function("answer_as_agent", answer_as_agent_handler)

    aggregators = LLMContextAggregatorPair(context)

    pipeline = Pipeline([
        transport.input(),
        aggregators.user(),
        llm,
        aggregators.assistant(),
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
        ),
        # Auto-cancel if nothing happens for 5 min. Unlike the warroom
        # long-running server, each daily_agent process is per-meeting
        # and should clean itself up when the room goes quiet.
        idle_timeout_secs=300,
        cancel_on_idle_timeout=True,
    )

    # Track participants so we exit when everyone leaves.
    human_participants: set[str] = set()
    runner = PipelineRunner()

    # Pre-load the profile picture frame so we can push it the moment
    # we join (and again when any new human arrives, so late joiners
    # also see the static image).
    avatar_frame = load_avatar_frame(agent, size=PROFILE_PIC_SIZE)

    @transport.event_handler("on_joined")
    async def on_joined(transport, data):
        logger.info("Bot joined Daily room as %s", bot_display_name)
        # Push the profile picture to Daily's camera-out track so the
        # participant tile in the Daily UI shows the agent's face
        # instead of the initials placeholder. `transport.send_image`
        # queues the frame directly at the output processor (downstream
        # of the LLM + aggregators), which is the canonical path -- the
        # previous `task.queue_frame` approach routed the image through
        # the whole pipeline and relied on every processor passing it
        # through unchanged, which is fragile.
        if avatar_frame is not None:
            await transport.send_image(avatar_frame)
            logger.info("Pushed profile picture to camera-out")

    @transport.event_handler("on_participant_joined")
    async def on_participant_joined(transport, participant):
        pid = participant.get("id") if isinstance(participant, dict) else getattr(participant, "id", None)
        if pid:
            human_participants.add(pid)
            logger.info("Participant joined: %s (total=%d)", pid, len(human_participants))
            # Prime Gemini Live with the context frame so it's ready
            # to accept audio. Same pitfall as the warroom (see
            # feedback_warroom_pitfalls.md #9).
            await task.queue_frame(LLMContextFrame(context=context))
            # Re-push the avatar so late joiners see the static image
            # even though Daily usually persists it.
            if avatar_frame is not None:
                await transport.send_image(avatar_frame)

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        pid = participant.get("id") if isinstance(participant, dict) else getattr(participant, "id", None)
        if pid and pid in human_participants:
            human_participants.discard(pid)
            logger.info("Participant left: %s (remaining=%d)", pid, len(human_participants))
            if not human_participants:
                logger.info("All humans have left. Cancelling pipeline.")
                await task.cancel()

    # Print a ready line so meet-cli knows the agent is connected and
    # can write the meet_sessions row with status=live.
    print(json.dumps({
        "ok": True,
        "status": "starting",
        "room_url": args.room_url,
        "agent": agent,
        "mode": mode,
        "voice": voice,
    }), flush=True)

    logger.info("Starting Daily agent: room=%s agent=%s mode=%s voice=%s",
                args.room_url, agent, mode, voice)
    await runner.run(task)
    logger.info("Daily agent shut down cleanly.")


def main():
    parser = argparse.ArgumentParser(description="ClaudeClaw Daily.co voice agent")
    parser.add_argument("--room-url", required=True, help="Full Daily room URL")
    parser.add_argument("--agent", default="main", help="Which ClaudeClaw agent persona to use")
    parser.add_argument("--mode", default="direct", choices=["direct", "auto"])
    parser.add_argument("--token", default=None, help="Optional Daily meeting token")
    parser.add_argument("--bot-name", default=None, help="Display name in the Daily UI")
    parser.add_argument("--brief", default=None, help="Path to a pre-flight briefing file")
    args = parser.parse_args()

    try:
        asyncio.run(run_agent(args))
    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    except Exception as exc:
        logger.error("Daily agent crashed: %s", exc, exc_info=True)
        print(json.dumps({"ok": False, "error": str(exc)[:500]}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
