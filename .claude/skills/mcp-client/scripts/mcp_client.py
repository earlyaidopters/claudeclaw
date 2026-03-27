#!/usr/bin/env python3
"""
Universal MCP Client - Connect to any MCP server from config files.

Supports all MCP transports:
- stdio: Local subprocess servers
- sse: HTTP + Server-Sent Events (remote)
- streamable_http: Modern HTTP transport (remote)
- fastmcp: FastMCP client with Bearer auth (Zapier, etc.)

Config Resolution (priority order):
1. MCP_CONFIG_PATH env var (path to config file)
2. MCP_CONFIG env var (inline JSON)
3. .mcp.json in current directory
4. ~/.claude.json (Claude Code user config)

Usage:
    python mcp_client.py servers                           # List configured servers
    python mcp_client.py tools <server>                    # List tools with schemas
    python mcp_client.py call <server> <tool> '{"args"}'   # Execute a tool

Environment:
    MCP_CONFIG_PATH: Path to MCP config file
    MCP_CONFIG: Inline JSON config (for simple setups)
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional
from contextlib import asynccontextmanager


# =============================================================================
# Config Loading
# =============================================================================

def find_config_file() -> Optional[Path]:
    """Find MCP config file in standard locations."""
    # Priority 1: Environment variable path
    if env_path := os.environ.get("MCP_CONFIG_PATH"):
        path = Path(env_path).expanduser()
        if path.exists():
            return path

    # Priority 2: mcp-config.json in skill's references folder (user's actual config)
    script_dir = Path(__file__).parent
    skill_config = script_dir.parent / "references" / "mcp-config.json"
    if skill_config.exists():
        return skill_config

    # Priority 3: .mcp.json in current directory
    local_config = Path(".mcp.json")
    if local_config.exists():
        return local_config

    # Priority 4: ~/.claude.json (Claude Code config)
    claude_config = Path.home() / ".claude.json"
    if claude_config.exists():
        return claude_config

    return None


def load_config() -> dict:
    """Load MCP server configuration."""
    # Priority 1: Inline JSON from environment
    if env_config := os.environ.get("MCP_CONFIG"):
        try:
            config = json.loads(env_config)
            return config.get("mcpServers", config)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid MCP_CONFIG JSON: {e}")

    # Priority 2: Config file
    config_path = find_config_file()
    if not config_path:
        raise FileNotFoundError(
            "No MCP config found. Set MCP_CONFIG_PATH, MCP_CONFIG, "
            "or create .mcp.json in the current directory."
        )

    with open(config_path) as f:
        config = json.load(f)

    # Handle both formats: {"mcpServers": {...}} and direct {...}
    return config.get("mcpServers", config)


def get_server_config(servers: dict, server_name: str) -> dict:
    """Get configuration for a specific server."""
    if server_name not in servers:
        available = ", ".join(servers.keys())
        raise ValueError(f"Server '{server_name}' not found. Available: {available}")
    return servers[server_name]


# =============================================================================
# Transport Detection & Connection
# =============================================================================

def detect_transport(config: dict) -> str:
    """Detect transport type from server config."""
    # Explicit type takes precedence
    if explicit_type := config.get("type"):
        type_map = {
            "stdio": "stdio",
            "sse": "sse",
            "http": "streamable_http",
            "streamable_http": "streamable_http",
            "streamable-http": "streamable_http",
            "fastmcp": "fastmcp",
        }
        return type_map.get(explicit_type.lower(), explicit_type.lower())

    # Infer from config keys
    if "command" in config:
        return "stdio"

    if "url" in config:
        # FastMCP when api_key is present (Zapier-style Bearer auth)
        if "api_key" in config:
            return "fastmcp"

        url = config["url"]
        if url.endswith("/mcp"):
            return "streamable_http"
        if url.endswith("/sse"):
            return "sse"
        # Default to SSE for remote servers
        return "sse"

    raise ValueError("Cannot detect transport: config must have 'command' or 'url'")


@asynccontextmanager
async def create_session(config: dict):
    """Create MCP client session based on server config."""
    transport = detect_transport(config)

    if transport == "fastmcp":
        # FastMCP client with Bearer auth (Zapier, etc.)
        from fastmcp import Client
        from fastmcp.client.transports import StreamableHttpTransport

        url = config["url"]
        api_key = config["api_key"]

        transport_obj = StreamableHttpTransport(
            url,
            headers={"Authorization": f"Bearer {api_key}"}
        )
        client = Client(transport=transport_obj)

        async with client:
            # Wrap FastMCP client in adapter for unified interface
            yield FastMCPSessionAdapter(client)

    elif transport == "stdio":
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        # Build environment with current env + config env
        env = {**os.environ}
        if config_env := config.get("env"):
            env.update(config_env)

        server_params = StdioServerParameters(
            command=config["command"],
            args=config.get("args", []),
            env=env,
            cwd=config.get("cwd"),
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    elif transport == "sse":
        from mcp import ClientSession
        from mcp.client.sse import sse_client

        url = config["url"]
        headers = config.get("headers")
        timeout = config.get("timeout", 30)

        async with sse_client(url, headers=headers, timeout=timeout) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    elif transport == "streamable_http":
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        url = config["url"]
        headers = config.get("headers")
        timeout = config.get("timeout", 30)

        async with streamablehttp_client(url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    else:
        raise ValueError(f"Unsupported transport: {transport}")


class FastMCPSessionAdapter:
    """Adapter to give FastMCP Client a similar interface to mcp ClientSession."""

    def __init__(self, client):
        self.client = client

    async def list_tools(self):
        """List tools, returning object with .tools attribute."""
        tools = await self.client.list_tools()
        return type('ToolsResult', (), {'tools': tools})()

    async def call_tool(self, name: str, arguments: dict):
        """Call a tool and return result."""
        result = await self.client.call_tool(name, arguments)
        return result


# =============================================================================
# Commands
# =============================================================================

def cmd_servers(servers: dict) -> list[dict]:
    """List all configured MCP servers."""
    result = []
    for name, config in servers.items():
        transport = detect_transport(config)
        info = {
            "name": name,
            "transport": transport,
        }
        if transport == "stdio":
            info["command"] = config.get("command")
        else:
            info["url"] = config.get("url")
        result.append(info)
    return result


async def cmd_tools(servers: dict, server_name: str) -> list[dict]:
    """List all tools from a server with full schemas."""
    config = get_server_config(servers, server_name)

    async with create_session(config) as session:
        result = await session.list_tools()

        tools = []
        for tool in result.tools:
            tools.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.inputSchema,
            })
        return tools


async def cmd_call(servers: dict, server_name: str, tool_name: str, arguments: dict) -> Any:
    """Execute a tool on a server."""
    config = get_server_config(servers, server_name)

    async with create_session(config) as session:
        result = await session.call_tool(tool_name, arguments)

        # Extract content from result
        if hasattr(result, 'content'):
            contents = []
            for item in result.content:
                if hasattr(item, 'text'):
                    contents.append(item.text)
                elif hasattr(item, 'data'):
                    contents.append({"type": "data", "data": item.data})
                else:
                    contents.append(str(item))
            return contents[0] if len(contents) == 1 else contents
        return result


# =============================================================================
# CLI Interface
# =============================================================================

def print_json(data: Any) -> None:
    """Print data as formatted JSON."""
    print(json.dumps(data, indent=2, default=str))


def print_error(message: str, error_type: str = "error") -> None:
    """Print error as JSON."""
    print(json.dumps({"error": message, "type": error_type}))


def print_usage():
    """Print usage information."""
    usage = """Usage: mcp_client.py <command> [args]

Commands:
    servers                           List configured MCP servers
    tools <server>                    List tools with full schemas
    call <server> <tool> '<json>'     Execute a tool with arguments

Examples:
    python mcp_client.py servers
    python mcp_client.py tools github
    python mcp_client.py call github search_repos '{"query": "python mcp"}'

Config sources (checked in order):
    1. MCP_CONFIG_PATH environment variable
    2. MCP_CONFIG environment variable (inline JSON)
    3. .mcp.json in current directory
    4. ~/.claude.json"""
    print(usage)


async def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    if command in ("--help", "-h", "help"):
        print_usage()
        sys.exit(0)

    # Load config
    try:
        servers = load_config()
    except (FileNotFoundError, ValueError) as e:
        print_error(str(e), "configuration")
        sys.exit(1)

    try:
        if command == "servers":
            result = cmd_servers(servers)
            print_json(result)

        elif command == "tools":
            if len(sys.argv) < 3:
                print_error("Usage: tools <server_name>", "usage")
                sys.exit(1)
            server_name = sys.argv[2]
            result = await cmd_tools(servers, server_name)
            print_json(result)

        elif command == "call":
            if len(sys.argv) < 4:
                print_error("Usage: call <server> <tool> [json_args]", "usage")
                sys.exit(1)
            server_name = sys.argv[2]
            tool_name = sys.argv[3]
            args = {}
            if len(sys.argv) >= 5:
                try:
                    args = json.loads(sys.argv[4])
                except json.JSONDecodeError as e:
                    print_error(f"Invalid JSON arguments: {e}", "invalid_args")
                    sys.exit(1)
            result = await cmd_call(servers, server_name, tool_name, args)
            print_json(result)

        else:
            print_error(f"Unknown command: {command}", "usage")
            print_usage()
            sys.exit(1)

    except ValueError as e:
        print_error(str(e), "validation")
        sys.exit(1)
    except ConnectionError as e:
        print_error(f"Connection failed: {e}", "connection")
        sys.exit(1)
    except Exception as e:
        print_error(f"Error: {e}", "error")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
