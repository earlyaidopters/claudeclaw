"""Async HTTP client for the internal voice API at http://127.0.0.1:{VOICE_API_PORT}."""

import logging
import aiohttp
from config import VOICE_API_PORT, VOICE_CHAT_ID

logger = logging.getLogger("voice-agent.memory")

BASE_URL = f"http://127.0.0.1:{VOICE_API_PORT}"


async def get_memory_context(message: str, agent_id: str) -> dict:
    """Fetch memory context for a user message via POST /memory-context."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BASE_URL}/memory-context",
                json={
                    "chatId": VOICE_CHAT_ID,
                    "message": message,
                    "agentId": agent_id,
                },
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                logger.warning(f"Memory context returned {resp.status}")
                return {}
    except Exception as e:
        logger.warning(f"Failed to fetch memory context: {e}")
        return {}


async def log_conversation(user_msg: str, assistant_msg: str, agent_id: str) -> None:
    """Log a conversation exchange via POST /conversation-log."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BASE_URL}/conversation-log",
                json={
                    "chatId": VOICE_CHAT_ID,
                    "userMessage": user_msg,
                    "assistantResponse": assistant_msg,
                    "agentId": agent_id,
                },
            ) as resp:
                if resp.status != 200:
                    logger.warning(f"Conversation log returned {resp.status}")
    except Exception as e:
        logger.warning(f"Failed to log conversation: {e}")


async def evaluate_relevance(
    ids: list, summaries: dict, user_msg: str, assistant_msg: str
) -> None:
    """Evaluate memory relevance via POST /evaluate-relevance."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BASE_URL}/evaluate-relevance",
                json={
                    "ids": ids,
                    "summaries": summaries,
                    "userMessage": user_msg,
                    "assistantResponse": assistant_msg,
                },
            ) as resp:
                if resp.status != 200:
                    logger.warning(f"Evaluate relevance returned {resp.status}")
    except Exception as e:
        logger.warning(f"Failed to evaluate relevance: {e}")


async def get_agent_config(agent_id: str) -> dict:
    """Fetch agent configuration via GET /agent-config/{agent_id}."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{BASE_URL}/agent-config/{agent_id}"
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                logger.warning(f"Agent config returned {resp.status}")
                return {}
    except Exception as e:
        logger.warning(f"Failed to fetch agent config: {e}")
        return {}
