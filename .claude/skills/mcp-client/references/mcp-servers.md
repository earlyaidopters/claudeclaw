# Common MCP Server Configurations

Reference configurations for popular MCP servers. Copy relevant sections to your `.mcp.json`.

## Remote Servers (FastMCP/SSE/HTTP)

### Zapier MCP

Connects to 8,000+ apps with 30,000+ actions. Get your API key from [mcp.zapier.com](https://mcp.zapier.com/).

**Current Format (FastMCP with Bearer Auth):**
```json
{
  "zapier": {
    "url": "https://mcp.zapier.com/api/v1/connect",
    "api_key": "YOUR_MCP_API_KEY"
  }
}
```

**Getting Your API Key:**
1. Go to [mcp.zapier.com](https://mcp.zapier.com/)
2. Sign in with your Zapier account
3. Configure which actions/apps to expose
4. Copy the generated MCP API key

**How it works:** The script uses FastMCP client with StreamableHttpTransport and Bearer token authentication. When `api_key` is present in config, it automatically uses this transport.

**Security:** Treat your API key like a password - it grants access to your configured Zapier actions.

**Token Cost:** One MCP tool call = 2 Zapier tasks from your plan quota.

**Legacy SSE Format (if needed):**
```json
{
  "zapier": {
    "url": "https://actions.zapier.com/mcp/YOUR_MCP_SERVER_KEY/sse"
  }
}
```

---

## Local Servers (stdio)

### Sequential Thinking

Structured problem-solving through dynamic, reflective thinking process. Useful for breaking down complex problems into steps.

```json
{
  "sequential-thinking": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
  }
}
```

**Docker Alternative:**
```json
{
  "sequential-thinking": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "mcp/sequentialthinking"]
  }
}
```

**Environment Variable:** Set `DISABLE_THOUGHT_LOGGING=true` to disable verbose output.

**Tool:** `sequentialthinking`
- `thought` (string): Current thinking step
- `thoughtNumber` (int): Current step number
- `totalThoughts` (int): Expected total steps
- `nextThoughtNeeded` (bool): Whether more steps needed

---

### GitHub MCP

Access GitHub repositories, issues, PRs, and more.

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
    }
  }
}
```

**Getting Token:**
1. Go to GitHub Settings > Developer Settings > Personal Access Tokens
2. Generate token with appropriate scopes (repo, read:org, etc.)

---

### Filesystem MCP

Read/write access to local filesystem paths.

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
  }
}
```

**Security:** Only the specified path (and subdirectories) are accessible.

---

### Memory MCP

Persistent key-value memory for conversations.

```json
{
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"]
  }
}
```

---

### PostgreSQL MCP

Query PostgreSQL databases.

```json
{
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@host:5432/db"
    }
  }
}
```

---

### Brave Search MCP

Web search via Brave Search API.

```json
{
  "brave-search": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-brave-search"],
    "env": {
      "BRAVE_API_KEY": "your-api-key"
    }
  }
}
```

---

### Puppeteer MCP

Browser automation for web scraping and testing.

```json
{
  "puppeteer": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  }
}
```

---

## Custom Python Servers

For custom MCP servers written in Python:

```json
{
  "my-server": {
    "command": "python",
    "args": ["path/to/my_mcp_server.py"],
    "env": {
      "MY_API_KEY": "xxx",
      "DEBUG": "true"
    },
    "cwd": "/path/to/working/directory"
  }
}
```

**With uv (recommended):**
```json
{
  "my-server": {
    "command": "uv",
    "args": ["run", "my_mcp_server.py"],
    "cwd": "/path/to/project"
  }
}
```

---

## Full Example Config

```json
{
  "mcpServers": {
    "zapier": {
      "url": "https://actions.zapier.com/mcp/YOUR_KEY/sse"
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
    }
  }
}
```

---

## Transport Reference

| Server Type | Transport | Config Key | Example |
|-------------|-----------|------------|---------|
| Remote (SSE) | SSE | `url` | `https://...../sse` |
| Remote (HTTP) | Streamable HTTP | `url` | `https://...../mcp` |
| Local (Node.js) | stdio | `command` | `npx` |
| Local (Python) | stdio | `command` | `python` |
| Local (Docker) | stdio | `command` | `docker` |

---

## Resources

- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Zapier MCP Guide](https://zapier.com/blog/zapier-mcp-guide/)
- [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
