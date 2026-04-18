"""
ClaudeAgentBridge: a Pipecat FrameProcessor that takes routed messages,
calls the appropriate ClaudeClaw agent via the Node.js voice bridge,
and emits TTS-ready text frames with the correct agent voice.

The bridge invokes:
    node PROJECT_ROOT/dist/agent-voice-bridge.js --agent AGENT_ID --message "TEXT"

It reads the agent's response from stdout and switches the Cartesia TTS
voice before emitting the response as a TextFrame.
"""

import asyncio
import json
import logging
import os
from typing import Optional

from pipecat.frames.frames import (
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSUpdateSettingsFrame,
)
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection

from config import PROJECT_ROOT, AGENT_VOICES, DEFAULT_AGENT
from router import AgentRouteFrame, AGENT_NAMES


logger = logging.getLogger("warroom.agent_bridge")

# How long to wait for the Node.js bridge to respond (seconds)
BRIDGE_TIMEOUT = 60

# Path to the voice bridge script
BRIDGE_SCRIPT = PROJECT_ROOT / "dist" / "agent-voice-bridge.js"

# Agent order for round-robin broadcasts
BROADCAST_ORDER = ["main", "research", "comms", "content", "ops"]


class ClaudeAgentBridge(FrameProcessor):
    """Receives AgentRouteFrames, calls the Claude agent, and emits
    voice-switched TextFrames for TTS output."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._current_voice: Optional[str] = None

    async def process_frame(self, frame, direction: FrameDirection):
        # CRITICAL: Must call super first so the parent registers StartFrame
        await super().process_frame(frame, direction)

        # Only handle AgentRouteFrames going downstream
        if not isinstance(frame, AgentRouteFrame):
            await self.push_frame(frame, direction)
            return

        if frame.mode == "broadcast":
            await self._handle_broadcast(frame.message)
        else:
            await self._handle_single(frame.agent_id, frame.message)

    async def _handle_single(self, agent_id: str, message: str):
        """Route a message to one agent and emit its response."""
        if agent_id not in AGENT_NAMES:
            agent_id = DEFAULT_AGENT

        response = await self._call_agent(agent_id, message)
        if response:
            await self._emit_response(agent_id, response)

    async def _handle_broadcast(self, message: str):
        """Send the message to each agent in order and emit all responses."""
        for agent_id in BROADCAST_ORDER:
            response = await self._call_agent(agent_id, message)
            if response:
                # Prefix with agent name so the listener knows who is speaking
                tagged = f"{agent_id.capitalize()} here. {response}"
                await self._emit_response(agent_id, tagged)

    async def _emit_response(self, agent_id: str, text: str):
        """Switch TTS voice to the agent's voice, then emit the text."""
        # Guard against voices.json being hand-edited into a shape where
        # AGENT_VOICES.get(DEFAULT_AGENT) is None, or where the matched
        # entry is a dict missing `voice_id` (legit in live mode which
        # only tracks `gemini_voice`). Either case would raise TypeError
        # or KeyError mid-response and crash the bridge silently.
        voice_config = AGENT_VOICES.get(agent_id) or AGENT_VOICES.get(DEFAULT_AGENT) or {}
        # FORK: mode-aware voice resolution. Local TTS backends use their
        # own voice identifiers — pushing a Cartesia UUID into OpenAITTSService
        # raises KeyError on VALID_VOICES lookup. Each local mode has its own
        # voice field in voices.json.
        mode = os.environ.get("WARROOM_MODE", "").lower()
        if mode == "voxtral":
            voice_id = voice_config.get("voxtral_voice", "fr_male")
        elif mode == "kokoro":
            voice_id = voice_config.get("kokoro_voice", "ff_siwis")
        else:
            voice_id = voice_config.get("voice_id", "")

        # Only send a voice-switch frame if we have a voice AND it actually changed
        if voice_id and voice_id != self._current_voice:
            await self.push_frame(TTSUpdateSettingsFrame(
                settings={"voice": voice_id}
            ))
            self._current_voice = voice_id

        # Use LLMTextFrame (subclass of TextFrame) instead of plain TextFrame:
        # - Still reaches TTS downstream (TTS listens to TextFrame subclasses)
        # - Pipecat's RTVIObserver watches LLMTextFrame to emit
        #   BotLLMTextMessage + BotTranscriptionMessage to the client,
        #   which populates the War Room chat transcript with the agent's
        #   response (otherwise only user transcripts appear, as observed
        #   during voxtral smoke test 2026-04-18).
        # Bracket with Start/End frames so the client receives proper
        # response boundaries.
        await self.push_frame(LLMFullResponseStartFrame())
        await self.push_frame(LLMTextFrame(text=text))
        await self.push_frame(LLMFullResponseEndFrame())

    async def _call_agent(self, agent_id: str, message: str) -> Optional[str]:
        """Call the Node.js voice bridge subprocess for the given agent.

        Returns the agent's text response, or None on failure.
        """
        logger.info(
            "calling agent %s (msg preview: %r)",
            agent_id, message[:80],
        )
        if not BRIDGE_SCRIPT.exists():
            logger.error(
                "Voice bridge script not found at %s. "
                "Build the project first: npm run build",
                BRIDGE_SCRIPT,
            )
            return f"I'm having trouble reaching the {agent_id} agent right now."

        cmd = [
            "node",
            str(BRIDGE_SCRIPT),
            "--agent", agent_id,
            "--message", message,
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(PROJECT_ROOT),
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=BRIDGE_TIMEOUT,
            )

            if process.returncode != 0:
                error_text = stderr.decode().strip() if stderr else "unknown error"
                logger.error(
                    "Agent %s bridge exited with code %d: %s",
                    agent_id, process.returncode, error_text,
                )
                return f"The {agent_id} agent ran into an issue. Try again in a moment."

            response = stdout.decode().strip()
            if not response:
                logger.warning("Agent %s returned an empty response", agent_id)
                return None

            # The Node bridge emits JSON: {"response": "...", "usage": {...}, "error": null}
            # Fall back to raw text if stdout isn't JSON.
            try:
                data = json.loads(response)
                if isinstance(data, dict):
                    if data.get("error"):
                        logger.error(
                            "Agent %s bridge returned error: %s",
                            agent_id, data["error"],
                        )
                        return f"The {agent_id} agent ran into an issue."
                    text = data.get("response") or data.get("text")
                    if text:
                        return text
                    logger.warning(
                        "Agent %s bridge returned empty response: %s",
                        agent_id, data,
                    )
                    return None
                return response
            except json.JSONDecodeError:
                return response

        except asyncio.TimeoutError:
            # Kill the orphaned subprocess to prevent resource leaks
            try:
                process.kill()
                await process.wait()
            except Exception:
                pass
            logger.error("Agent %s timed out after %ds", agent_id, BRIDGE_TIMEOUT)
            return f"The {agent_id} agent took too long to respond."

        except Exception as exc:
            logger.error("Failed to call agent %s: %s", agent_id, exc)
            return f"Something went wrong reaching the {agent_id} agent."
