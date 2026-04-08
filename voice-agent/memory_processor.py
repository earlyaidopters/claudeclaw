"""Pipecat processor that injects memory context before LLM calls,
tracks the call transcript, and sends a post-call summary via Telegram.
"""

import logging
import os
import sqlite3
from pathlib import Path

import aiohttp

from pipecat.frames.frames import Frame, LLMContextFrame, LLMFullResponseEndFrame, LLMTextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from memory_client import get_memory_context, log_conversation, evaluate_relevance

logger = logging.getLogger("voice-agent.memory")

DB_PATH = str(Path(__file__).resolve().parent.parent / "store" / "claudeclaw.db")
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def _read_env_var(name: str) -> str:
    """Read a var from .env file directly."""
    try:
        if not ENV_PATH.exists():
            return ""
        for line in ENV_PATH.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip("'\"")
    except Exception:
        pass
    return ""


def _fetch_recent_turns(agent_id: str, limit: int = 20) -> str:
    """Fetch the last N conversation turns from SQLite for continuity."""
    try:
        if not os.path.exists(DB_PATH):
            return ""

        db = sqlite3.connect(DB_PATH)
        rows = db.execute(
            """SELECT role, content, created_at FROM conversation_log
               WHERE agent_id = ?
               AND content NOT LIKE '[Phone call transcript%'
               ORDER BY created_at DESC LIMIT ?""",
            (agent_id, limit),
        ).fetchall()
        db.close()

        if not rows:
            return ""

        rows.reverse()
        lines = []
        for role, content, _ in rows:
            preview = content[:300].strip()
            if len(content) > 300:
                preview += "..."
            label = "You" if role == "assistant" else "Ben"
            lines.append(f"{label}: {preview}")

        return "[Recent conversation]\n" + "\n".join(lines) + "\n[End recent conversation]"

    except Exception as e:
        logger.warning(f"Failed to fetch recent turns: {e}")
        return ""


class MemoryProcessor(FrameProcessor):
    """Injects memory context, tracks transcript, sends post-call summary."""

    def __init__(self, agent_id: str, chat_id: str, **kwargs):
        super().__init__(**kwargs)
        self._agent_id = agent_id
        self._chat_id = chat_id
        self._transcript: list[dict] = []
        self._last_surfaced_ids: list = []
        self._last_surfaced_summaries: dict = {}
        self._recent_turns = _fetch_recent_turns(agent_id)
        if self._recent_turns:
            logger.info(f"Loaded recent conversation ({len(self._recent_turns)} chars)")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMContextFrame) and direction == FrameDirection.DOWNSTREAM:
            await self._inject_context(frame)

        await self.push_frame(frame, direction)

    async def _inject_context(self, frame: LLMContextFrame):
        context = frame.context
        messages = context.get_messages()

        last_user_msg = None
        last_user_idx = -1
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].get("role") == "user":
                last_user_msg = messages[i]
                last_user_idx = i
                break

        if not last_user_msg or not last_user_msg.get("content"):
            return

        user_text = last_user_msg["content"]
        self._transcript.append({"role": "user", "text": user_text})

        # Memory relevance feedback for previous turn
        if self._last_surfaced_ids and len(self._transcript) >= 2:
            prev_assistant = ""
            for entry in reversed(self._transcript):
                if entry["role"] == "assistant":
                    prev_assistant = entry["text"]
                    break
            if prev_assistant:
                try:
                    await evaluate_relevance(
                        self._last_surfaced_ids,
                        self._last_surfaced_summaries,
                        user_text,
                        prev_assistant,
                    )
                except Exception:
                    pass

        context_parts = []

        if self._recent_turns:
            context_parts.append(self._recent_turns)

        try:
            memory_result = await get_memory_context(user_text, self._agent_id)
            memory_text = memory_result.get("contextText", "")
            self._last_surfaced_ids = memory_result.get("surfacedMemoryIds", [])
            self._last_surfaced_summaries = memory_result.get("surfacedMemorySummaries", {})
            if memory_text:
                context_parts.append(f"[Memory context]\n{memory_text}\n[End memory context]")
        except Exception as e:
            logger.warning(f"Memory fetch failed: {e}")

        if context_parts:
            prefix = "\n\n".join(context_parts)
            enriched = f"{prefix}\n\n[User says]\n{user_text}"
            messages[last_user_idx] = {**last_user_msg, "content": enriched}
            context.set_messages(messages)

    def track_assistant_response(self, text: str):
        if text.strip():
            self._transcript.append({"role": "assistant", "text": text})

    async def log_transcript_and_notify(self):
        """Log transcript to memory DB and send post-call summary via Telegram."""
        if not self._transcript:
            return

        # Log to conversation DB for memory extraction
        user_parts = []
        assistant_parts = []
        for entry in self._transcript:
            if entry["role"] == "user":
                user_parts.append(entry["text"])
            else:
                assistant_parts.append(entry["text"])

        user_text = "[Phone call transcript - User]\n" + "\n".join(user_parts)
        assistant_text = "[Phone call transcript - Assistant]\n" + "\n".join(assistant_parts)

        try:
            await log_conversation(user_text, assistant_text, self._agent_id)
            logger.info(f"Logged call transcript ({len(self._transcript)} turns)")
        except Exception as e:
            logger.warning(f"Failed to log transcript: {e}")

        # Build and send Telegram summary
        await self._send_post_call_summary()

    async def _send_post_call_summary(self):
        """Extract action items, send summary to Telegram, auto-execute Obsidian tasks."""
        if len(self._transcript) < 2:
            return

        lines = []
        for entry in self._transcript:
            speaker = "You" if entry["role"] == "assistant" else "Ben"
            lines.append(f"{speaker}: {entry['text']}")
        transcript_text = "\n".join(lines)

        # Extract action items via OpenAI
        from config import OPENAI_API_KEY, OPENAI_MODEL
        summary_prompt = f"""Review this phone call transcript and extract any action items or requests Ben made.

Transcript:
{transcript_text}

Reply with ONLY this format (no other text):
SUMMARY: 1-2 sentence summary of the call
ACTIONS:
- [auto] action description (for Obsidian tasks -- adding notes, tasks, etc.)
- [confirm] action description (for everything else -- needs Ben's OK first)

If there are no action items, just write:
SUMMARY: 1-2 sentence summary
ACTIONS: none"""

        summary = ""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    json={
                        "model": OPENAI_MODEL,
                        "messages": [{"role": "user", "content": summary_prompt}],
                        "max_tokens": 300,
                    },
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        summary = data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"Failed to generate call summary: {e}")
            summary = f"Call ended ({len(self._transcript)} turns)."

        if not summary:
            return

        bot_token = _read_env_var("TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = _read_env_var("ALLOWED_CHAT_ID") or os.environ.get("ALLOWED_CHAT_ID", "")
        voice_api_port = os.environ.get("VOICE_API_PORT", "3142")

        if not bot_token or not chat_id:
            logger.warning("Missing TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID")
            return

        # Build the full transcript for injection
        transcript_lines = []
        for entry in self._transcript:
            speaker = "Ben" if entry["role"] == "user" else "Agent"
            transcript_lines.append(f"{speaker}: {entry['text']}")
        transcript_block = "\n".join(transcript_lines)

        # Send just the summary to Telegram -- transcript is injected into the session separately
        message = f"Phone call just ended.\n\n{summary}"
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": message},
                )
            logger.info("Post-call summary sent to Telegram")
        except Exception as e:
            logger.warning(f"Failed to send Telegram notification: {e}")

        # Also inject the transcript into the Claude Code session directly
        # so the agent has it in its context window for the next Telegram message
        inject_msg = (
            f"[Phone call transcript -- this just happened, remember everything discussed]\n\n"
            f"{transcript_block}\n\n"
            f"Summary: {summary}"
        )
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"http://127.0.0.1:{voice_api_port}/chat",
                    json={"message": inject_msg},
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as resp:
                    if resp.status == 200:
                        logger.info("Call transcript injected into Claude session")
                    else:
                        logger.warning(f"Transcript injection returned {resp.status}")
        except Exception as e:
            logger.warning(f"Failed to inject transcript into session: {e}")

        # Auto-execute [auto] actions via the Claude Code session
        auto_actions = []
        for line in summary.split("\n"):
            line = line.strip()
            if line.startswith("- [auto]"):
                action = line.replace("- [auto]", "").strip()
                if action:
                    auto_actions.append(action)

        if auto_actions:
            combined = "\n".join(f"- {a}" for a in auto_actions)
            execute_msg = f"[From phone call with Ben -- execute these automatically, no confirmation needed]\n{combined}"
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"http://127.0.0.1:{voice_api_port}/chat",
                        json={"message": execute_msg},
                        timeout=aiohttp.ClientTimeout(total=60),
                    ) as resp:
                        if resp.status == 200:
                            logger.info(f"Auto-executed {len(auto_actions)} actions from call")
                        else:
                            logger.warning(f"Action execution returned {resp.status}")
            except Exception as e:
                logger.warning(f"Failed to auto-execute actions: {e}")


class AssistantResponseTracker(FrameProcessor):
    """Sits after the LLM to capture assistant text for transcript logging."""

    def __init__(self, memory_processor: MemoryProcessor, **kwargs):
        super().__init__(**kwargs)
        self._memory = memory_processor
        self._current_response = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMTextFrame) and direction == FrameDirection.DOWNSTREAM:
            self._current_response += frame.text
        elif isinstance(frame, LLMFullResponseEndFrame) and direction == FrameDirection.DOWNSTREAM:
            if self._current_response.strip():
                self._memory.track_assistant_response(self._current_response.strip())
            self._current_response = ""

        await self.push_frame(frame, direction)
