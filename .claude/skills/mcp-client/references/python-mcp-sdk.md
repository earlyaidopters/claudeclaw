# Python MCP SDK Reference

The official Python SDK for building and consuming MCP servers.

## Installation

```bash
pip install mcp
```

**Current stable version:** 1.25.x (pin to `mcp>=1.25,<2` for stability)

**Note:** v2 release anticipated Q1 2026. v1.x continues to receive bug fixes.

## Core Concepts

MCP (Model Context Protocol) provides a standardized way to connect AI models to external data sources and tools.

**Think of it like USB-C for AI** - a universal connector that works across different tools and services.

## Client Usage (Consuming MCP Servers)

### Session Creation

```python
from mcp import ClientSession

# For stdio transport
from mcp import StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(
    command="npx",
    args=["-y", "@modelcontextprotocol/server-github"],
    env={"GITHUB_TOKEN": "xxx"}
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        # Use session...
```

### SSE Transport (Remote Servers)

```python
from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client(url, headers=headers, timeout=30) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        # Use session...
```

### Streamable HTTP Transport

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(url, headers=headers) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        # Use session...
```

### Listing Tools

```python
result = await session.list_tools()

for tool in result.tools:
    print(f"Tool: {tool.name}")
    print(f"Description: {tool.description}")
    print(f"Schema: {tool.inputSchema}")
```

### Calling Tools

```python
result = await session.call_tool("tool_name", {"arg1": "value1"})

# Extract content
for item in result.content:
    if hasattr(item, 'text'):
        print(item.text)
    elif hasattr(item, 'data'):
        print(item.data)
```

### Listing Resources

```python
result = await session.list_resources()

for resource in result.resources:
    print(f"Resource: {resource.uri}")
    print(f"Name: {resource.name}")
```

### Reading Resources

```python
result = await session.read_resource("resource://uri")

for content in result.contents:
    print(content.text)
```

---

## Server Creation (Building MCP Servers)

### FastMCP (Recommended)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("My Server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

### Tool Decorators

```python
@mcp.tool()
def search_database(query: str, limit: int = 10) -> list[dict]:
    """
    Search the database for matching records.

    Args:
        query: Search query string
        limit: Maximum results to return

    Returns:
        List of matching records
    """
    # Implementation
    return results
```

**Type hints** are converted to JSON Schema automatically.

### Resource Decorators

```python
@mcp.resource("config://settings")
def get_settings() -> str:
    """Return application settings as JSON."""
    return json.dumps(settings)

@mcp.resource("file://{path}")
def read_file(path: str) -> str:
    """Read a file from the filesystem."""
    return Path(path).read_text()
```

### Prompt Decorators

```python
@mcp.prompt()
def code_review(code: str, language: str = "python") -> str:
    """Generate a code review prompt."""
    return f"Please review this {language} code:\n\n```{language}\n{code}\n```"
```

---

## Transport Configuration

### stdio (Local Servers)

Default for local subprocess servers.

```python
from mcp import StdioServerParameters

params = StdioServerParameters(
    command="python",
    args=["server.py"],
    env={"DEBUG": "true"},
    cwd="/path/to/dir"
)
```

### SSE (Remote - Legacy)

Server-Sent Events for remote HTTP connections.

```python
from mcp.client.sse import sse_client

async with sse_client(
    url="https://example.com/mcp/sse",
    headers={"Authorization": "Bearer token"},
    timeout=60
) as (read, write):
    # ...
```

### Streamable HTTP (Remote - Modern)

Modern HTTP transport with better connection handling.

```python
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(
    url="https://example.com/mcp",
    headers={"Authorization": "Bearer token"}
) as (read, write, session_info):
    # ...
```

---

## Error Handling

```python
from mcp.types import McpError

try:
    result = await session.call_tool("tool", args)
except McpError as e:
    print(f"MCP Error: {e.code} - {e.message}")
except ConnectionError as e:
    print(f"Connection failed: {e}")
except TimeoutError as e:
    print(f"Request timed out: {e}")
```

---

## Authentication

MCP SDK supports OAuth 2.1 for resource server functionality.

```python
from mcp.server.auth import bearer_auth

@mcp.tool()
@bearer_auth(scopes=["read:data"])
def protected_tool(data: str) -> str:
    """A tool requiring authentication."""
    return process(data)
```

---

## Best Practices

1. **Use context managers** - Always use `async with` for sessions
2. **Handle errors** - Wrap calls in try/except for graceful degradation
3. **Set timeouts** - Prevent hanging on unresponsive servers
4. **Type your tools** - Let the SDK generate JSON Schema from type hints
5. **Document tools** - Docstrings become tool descriptions

---

## Resources

- [Python SDK GitHub](https://github.com/modelcontextprotocol/python-sdk)
- [SDK Documentation](https://modelcontextprotocol.github.io/python-sdk/)
- [PyPI Package](https://pypi.org/project/mcp/)
- [MCP Specification](https://modelcontextprotocol.io/specification/)
