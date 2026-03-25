# Google Calendar MCP Setup (workspace-mcp)

Reference document for setting up `workspace-mcp` (taylorwilsdon/google_workspace_mcp) as a Google Calendar MCP server for ClaudeClaw/EAC. Written 2026-03-25 after a session that took longer than it should have due to several compounding issues.

Package: `workspace-mcp` (PyPI) / `google_workspace_mcp` (GitHub)
GitHub: https://github.com/taylorwilsdon/google_workspace_mcp (~1.9k stars)
Transport: stdio via `uvx`

---

## Quick Setup Guide (The Correct Steps)

If starting fresh, do exactly this:

### 1. Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth 2.0 Client ID** with Application type: **Desktop Application**
3. Download or copy the Client ID and Client Secret
4. Enable the **Google Calendar API** in APIs & Services > Library

### 2. Environment Variables

Add to `~/.env.shared`:

```bash
GCAL_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GCAL_OAUTH_CLIENT_SECRET="GOCSPX-your-secret"
GCAL_USER_EMAIL="your-email@gmail.com"
```

### 3. Check Port 8000

workspace-mcp defaults to port 8000 for its OAuth callback server. Before anything else:

```bash
lsof -i :8000
```

If anything is listening, pick a different port (e.g., 9099). You will set `WORKSPACE_MCP_PORT` in the next step.

### 4. Configure ~/.mcp.json

Add to the `mcpServers` block:

```json
"google-calendar": {
  "command": "uvx",
  "args": ["--from", "workspace-mcp", "workspace-mcp", "--tools", "calendar", "--single-user"],
  "env": {
    "GOOGLE_OAUTH_CLIENT_ID": "<literal client ID value>",
    "GOOGLE_OAUTH_CLIENT_SECRET": "<literal client secret value>",
    "GOOGLE_USER_EMAIL": "<literal email value>",
    "WORKSPACE_MCP_PORT": "9099"
  }
}
```

**Use literal values in the env block, not `${VAR}` references.** See "What Went Wrong" below.

### 5. Run the OAuth Flow

Start Claude Code (or restart it) so the MCP server launches. On first run, workspace-mcp will:

1. Print a URL to the terminal
2. Open a browser (or you open the URL manually)
3. Google consent screen appears -- authorize
4. Browser redirects to `http://localhost:<port>/oauth/callback`
5. Token is stored at `~/.google_workspace_mcp/credentials/` and persists across restarts

This must happen on the same machine running the MCP server (the localhost redirect won't work remotely).

### 6. Verify

After OAuth completes, the MCP tools should be available. Test with a calendar list or event query.

---

## What Went Wrong

### Issue 1: `uvx` invocation syntax

**Symptom:** `uvx workspace-mcp --tools calendar` failed to find the package.

**Root cause:** `uvx` needs the `--from` flag to specify the package when the command name matches the package name in certain configurations.

**Fix:** `uvx --from workspace-mcp workspace-mcp --tools calendar --single-user`

### Issue 2: Environment variable interpolation in .mcp.json

**Symptom:** MCP server received literal strings like `${GCAL_OAUTH_CLIENT_ID}` instead of resolved values. OAuth failed with invalid credentials.

**Root cause:** The `env` block in `.mcp.json` does NOT resolve `${VAR}` syntax from the shell environment. It passes values as literal strings to the subprocess.

**Fix:** Put the actual credential values directly in the `.mcp.json` env block. This is annoying (duplicates values from `~/.env.shared`) but is how MCP config works.

**Note:** The env key names must match what workspace-mcp expects: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_USER_EMAIL` (not the `GCAL_` prefixed names from `~/.env.shared`).

### Issue 3: OAuth 404 — port conflict

**Symptom:** After Google consent screen, browser redirected to `http://localhost:8000/oauth/callback` and got a 404 page.

**Root cause:** Port 8000 was occupied by a long-running `uvicorn` FastAPI backend (gen-ui-dashboard agent, running since March 19). workspace-mcp's OAuth callback server couldn't bind to 8000, so the browser redirect hit the FastAPI app instead, which returned 404 on `/oauth/callback`.

**Fix:** Set `WORKSPACE_MCP_PORT=9099` in the `.mcp.json` env block. Found this env var in workspace-mcp source at `oauth_config.py` line 29.

**Time wasted:** This was the most expensive issue. We initially assumed it was a Google Cloud Console configuration problem (redirect URIs, OAuth client type) and spent significant time researching before checking the obvious -- whether something else was on port 8000.

### Issue 4: Misleading redirect URI investigation

**Symptom:** After the 404, we investigated adding redirect URIs in Google Cloud Console.

**Root cause:** Desktop Application OAuth clients handle redirect URIs automatically (loopback). There is no option to configure them in the console, and there shouldn't be. The 404 was a port conflict, not a redirect misconfiguration.

**Fix:** Stop looking at Google Cloud Console and check the local machine instead.

---

## Key Lessons

1. **`.mcp.json` env blocks do NOT resolve `${VAR}` from shell environment.** Use literal values. This is a footgun when you centralize secrets in `~/.env.shared`.

2. **Desktop Application OAuth clients don't have configurable redirect URIs.** This is correct behavior. If you can't find a redirect URI option, you probably have the right client type.

3. **workspace-mcp defaults to port 8000 for OAuth callback.** Always check for port conflicts before running the OAuth flow. `lsof -i :8000` first.

4. **`WORKSPACE_MCP_PORT` env var controls the OAuth callback port.** Not documented prominently in the README. Found in source code (`oauth_config.py`).

5. **`uvx` needs `--from package-name` syntax** to run packages: `uvx --from workspace-mcp workspace-mcp`.

6. **OAuth flow must happen on the machine running the MCP server.** The redirect goes to `localhost:<port>`. Cannot do this remotely (e.g., from Surface browsing to ProBook).

7. **Token persists at `~/.google_workspace_mcp/credentials/`.** Once authorized, restarts don't require re-auth. If token expires or is revoked, delete this directory and re-run the flow.

8. **When OAuth fails with 404, check the port first.** Don't start with Google Cloud Console settings. The most likely cause is something else listening on the callback port.

---

## Stale Training Data Issues

Claude's training data (cutoff before this session) had outdated information about Google Cloud Console:

- **Suggested Web Application type** instead of Desktop Application for local OAuth flows. Desktop Application is correct for MCP servers running locally.
- **Suggested adding redirect URIs** to the OAuth client configuration. Desktop Application clients auto-handle loopback redirects; there is no UI option to configure them.
- **Google Cloud Console UI has changed** since training data. Menu locations, option names, and available settings may not match what Claude describes. When in doubt, trust what you see in the console over what Claude suggests.

General rule: For any cloud provider console UI task, Claude's descriptions of where to click and what options exist may be outdated. Verify against the actual UI.

---

## Automation Opportunities

1. **Port check hook:** Before launching any MCP server that uses OAuth, run `lsof -i :<port>` and warn if occupied. Could be a pre-launch check in ClaudeClaw's MCP management.

2. **Env var sync script:** A script that reads `~/.env.shared` and generates the literal values needed for `.mcp.json` env blocks. Prevents manual copy-paste and keeps a single source of truth.

3. **Token health check:** Periodically verify `~/.google_workspace_mcp/credentials/` contains valid tokens. If expired, surface a notification rather than failing silently on the next calendar query.

4. **Kill stale servers:** The uvicorn process on port 8000 had been running for 6 days unnoticed. A periodic cleanup or port audit would catch these.

---

## File Locations

| Item | Path |
|------|------|
| MCP config | `~/.mcp.json` |
| Shared env vars | `~/.env.shared` |
| OAuth tokens | `~/.google_workspace_mcp/credentials/` |
| workspace-mcp source (if needed) | Installed via uvx, check `uvx --from workspace-mcp workspace-mcp --help` |
| This document | `projects/claudeclaw/docs/setup-google-calendar-mcp.md` |
