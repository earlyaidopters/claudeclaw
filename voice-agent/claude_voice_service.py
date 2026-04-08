"""Custom Pipecat LLMService that routes inference through the Claude Code session.

POSTs the user's utterance to the voice API /chat endpoint, which calls runAgent()
with the existing session and Haiku 4.5 model. The Claude Code session handles
all context, memory, tools, and personality.
"""

import asyncio
import aiohttp
import logging

from pipecat.frames.frames import (
    Frame,
    LLMContextFrame,
    LLMFullResponseStartFrame,
    LLMFullResponseEndFrame,
    LLMTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

logger = logging.getLogger("voice-agent.claude")


class ClaudeVoiceLLMService(FrameProcessor):
    """Routes voice utterances through the Claude Code session via /chat.

    Uses FrameProcessor (not LLMService) to avoid LLMSettings validation issues.
    Intercepts LLMContextFrame, extracts user text, POSTs to /chat, emits response frames.
    """

    def __init__(self, voice_api_url: str, agent_id: str = "main", **kwargs):
        super().__init__(**kwargs)
        self._voice_api_url = voice_api_url
        self._agent_id = agent_id

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMContextFrame) and direction == FrameDirection.DOWNSTREAM:
            await self._handle_context(frame)
        else:
            await self.push_frame(frame, direction)

    async def _handle_context(self, frame: LLMContextFrame):
        """Extract last user message, POST to /chat, emit response as TTS-ready frames."""
        context = frame.context
        messages = context.get_messages()
        last_user = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                last_user = msg.get("content", "")
                break

        if not last_user:
            return

        logger.info(f"Sending to /chat: {last_user[:60]}...")

        await self.push_frame(LLMFullResponseStartFrame())
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self._voice_api_url}/chat",
                    json={"message": last_user, "agentId": self._agent_id},
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    data = await resp.json()
                    text = data.get("text", "") if resp.status == 200 else ""
                    if not text:
                        logger.warning(f"/chat returned empty (status {resp.status})")
                    await self.push_frame(LLMTextFrame(text=text or "Give me a second."))
        except asyncio.TimeoutError:
            logger.warning("/chat timed out after 30s")
            await self.push_frame(LLMTextFrame(text="Hold on, still working on that."))
        except Exception as e:
            logger.error(f"/chat error: {e}")
            await self.push_frame(LLMTextFrame(text="Give me a second."))
        finally:
            await self.push_frame(LLMFullResponseEndFrame())
