"""
Agent bridge — spawns the Node.js agent-voice-bridge CLI and returns its response.

Python can't directly call the Claude Agent SDK (it's Node.js only).
This module runs `node dist/agent-voice-bridge.js` as a subprocess,
captures stdout (JSON), and returns the text response.
"""

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from warroom.config import AGENT_BRIDGE_PATH, PROJECT_ROOT

# Resolve node at import time so we fail fast if it's missing.
# When the server runs as a background process the shell PATH may be minimal,
# so we search the common Homebrew / nvm / system locations explicitly.
_NODE_SEARCH = [
    "/usr/local/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/bin/node",
    os.path.expanduser("~/.nvm/versions/node/*/bin/node"),
]

def _find_node() -> str:
    # 1. Already on PATH?
    found = shutil.which("node")
    if found:
        return found
    # 2. Check known locations
    import glob
    for pattern in _NODE_SEARCH:
        matches = glob.glob(pattern)
        if matches:
            return sorted(matches)[-1]  # newest if glob
    raise RuntimeError("Cannot find node binary — add it to PATH")

logger = logging.getLogger(__name__)

# Sensitive env var prefixes to strip from the subprocess environment
_SENSITIVE_PREFIXES = (
    "_API_KEY",
    "_TOKEN",
    "_SECRET",
    "_PASSWORD",
    "_HASH",
    "_PHRASE",
    "SECURITY_PIN",
    "EMERGENCY_KILL",
    "DB_ENCRYPTION",
)


def _safe_env() -> dict[str, str]:
    """Return os.environ minus sensitive keys, with PATH augmented for background processes."""
    import glob as _glob
    safe = {}
    for key, val in os.environ.items():
        if any(key.upper().endswith(p) or key.upper().startswith(p.lstrip("_")) for p in _SENSITIVE_PREFIXES):
            continue
        safe[key] = val

    # Resolve node binary and prepend its directory to PATH so the Claude Agent SDK
    # can spawn 'node' by name even under launchd / nohup environments.
    # Also expose the absolute path as CLAUDECLAW_NODE_BIN for agent-voice-bridge.js
    # to pass as `executable` to the SDK, bypassing any PATH resolution entirely.
    try:
        node_bin = _find_node()
        node_dir = str(Path(node_bin).parent)
        safe["CLAUDECLAW_NODE_BIN"] = node_bin
    except RuntimeError:
        node_dir = None

    # Augment PATH: actual found node dir first, then common fallbacks
    extra_paths = [
        node_dir,  # wherever _find_node() found it
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        os.path.expanduser("~/.nvm/versions/node/v24.15.0/bin"),
        os.path.expanduser("~/.local/bin"),
    ]
    current_path = safe.get("PATH", "")
    augmented = ":".join(p for p in extra_paths if p and p not in current_path)
    safe["PATH"] = augmented + ":" + current_path if augmented else current_path
    return safe


def call_agent(
    agent_id: str,
    prompt: str,
    chat_id: Optional[str] = None,
    quick: bool = False,
    timeout: int = 900,
) -> str:
    """
    Spawn `node dist/agent-voice-bridge.js` and return the response text.

    Args:
        agent_id: Which agent to run (main, comms, content, ops, research)
        prompt:   The user's transcribed speech
        chat_id:  Optional session ID for persistence across voice turns
        quick:    Limit to 3 turns for faster responses (good for short questions)
        timeout:  Subprocess timeout in seconds (default 900 = 15 min)

    Returns:
        The agent's text response, or a fallback string on error.
    """
    node_bin = _find_node()
    args = [node_bin, AGENT_BRIDGE_PATH, agent_id, prompt]

    if quick:
        args.append("--quick")

    if chat_id:
        args.extend(["--chat-id", chat_id])

    logger.info("Calling agent bridge: agent=%s quick=%s", agent_id, quick)

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(PROJECT_ROOT),
            env=_safe_env(),
        )

        if result.returncode != 0:
            logger.error(
                "Agent bridge exited with code %d: %s",
                result.returncode,
                result.stderr[:500] if result.stderr else "(no stderr)",
            )
            return "Something went wrong with the agent. Check the logs."

        if not result.stdout.strip():
            logger.warning("Agent bridge returned empty stdout")
            return "The agent didn't return a response."

        data = json.loads(result.stdout)
        text = data.get("text") or data.get("result") or ""

        if not text:
            logger.warning("Agent bridge JSON missing 'text' field: %s", result.stdout[:200])
            return "Got a response but couldn't parse it."

        return text

    except subprocess.TimeoutExpired:
        logger.error("Agent bridge timed out after %ds (agent=%s)", timeout, agent_id)
        return "The agent timed out. That task may need more time than voice allows."

    except json.JSONDecodeError as e:
        logger.error("Failed to parse agent bridge stdout as JSON: %s", e)
        return "Got a response but it was malformed."

    except Exception as e:  # noqa: BLE001
        logger.error("Unexpected error calling agent bridge: %s", e)
        return "An unexpected error occurred."
