"""
AgentRouter — a Pipecat FrameProcessor that routes transcribed speech
to the correct agent based on priority rules.

Routing priority:
  1. Broadcast triggers ("everyone", "all agents", "team") -> all agents
  2. Name prefix ("hey comms", "research,", "@ops") -> specific agent
  3. Pinned agent (persisted in /tmp/warroom-pin.json) -> pinned agent
  4. Default -> main agent
"""

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path where agent pin state is persisted across reconnects within a session
PIN_FILE = Path("/tmp/warroom-pin.json")

# Broadcast trigger words/phrases
BROADCAST_TRIGGERS = frozenset([
    "everyone", "all agents", "whole team", "all of you",
    "everybody", "team meeting", "all hands",
])

# Name prefix patterns — maps spoken names/nicknames to agent IDs
AGENT_ALIASES: dict[str, str] = {
    "main": "main",
    "nikki": "main",
    "hand": "main",
    "hand of the king": "main",
    "comms": "comms",
    "communications": "comms",
    "whisperer": "comms",
    "master of whisperers": "comms",
    "content": "content",
    "bard": "content",
    "royal bard": "content",
    "writer": "content",
    "ops": "ops",
    "operations": "ops",
    "master of war": "ops",
    "research": "research",
    "maester": "research",
    "grand maester": "research",
    "researcher": "research",
}

# Pre-compiled regex for name prefix detection
# Matches: "hey comms:", "research,", "@ops", "comms -" at start of utterance
_PREFIX_RE = re.compile(
    r"^(?:hey\s+|@)?"
    + r"("
    + "|".join(re.escape(k) for k in sorted(AGENT_ALIASES.keys(), key=len, reverse=True))
    + r")"
    + r"[\s,:\-–]+",
    re.IGNORECASE,
)


@dataclass
class RouteDecision:
    agent_id: str
    prompt: str          # text with the routing prefix stripped
    broadcast: bool = False


def get_pinned_agent() -> Optional[str]:
    """Read the currently pinned agent from disk, or None if not set."""
    try:
        if PIN_FILE.exists():
            data = json.loads(PIN_FILE.read_text())
            return data.get("agent_id")
    except Exception:  # noqa: BLE001
        pass
    return None


def set_pinned_agent(agent_id: Optional[str]) -> None:
    """Persist (or clear) the pinned agent."""
    try:
        if agent_id is None:
            PIN_FILE.unlink(missing_ok=True)
        else:
            PIN_FILE.write_text(json.dumps({"agent_id": agent_id}))
            logger.info("Pinned agent: %s", agent_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to write pin file: %s", e)


def route(text: str) -> RouteDecision:
    """
    Decide which agent should handle this voice input.

    Returns a RouteDecision with agent_id, cleaned prompt, and broadcast flag.
    """
    cleaned = text.strip()
    lower = cleaned.lower()

    # Rule 1: Broadcast triggers
    for trigger in BROADCAST_TRIGGERS:
        if trigger in lower:
            return RouteDecision(agent_id="main", prompt=cleaned, broadcast=True)

    # Rule 2: Name prefix at start of utterance
    match = _PREFIX_RE.match(cleaned)
    if match:
        spoken_name = match.group(1).lower()
        agent_id = AGENT_ALIASES.get(spoken_name, "main")
        # Strip the prefix so the agent only sees the actual request
        prompt = cleaned[match.end():].strip()
        if not prompt:
            prompt = cleaned  # edge case: name only, keep full text
        return RouteDecision(agent_id=agent_id, prompt=prompt)

    # Rule 3: Pinned agent
    pinned = get_pinned_agent()
    if pinned:
        return RouteDecision(agent_id=pinned, prompt=cleaned)

    # Rule 4: Default to main
    return RouteDecision(agent_id="main", prompt=cleaned)
