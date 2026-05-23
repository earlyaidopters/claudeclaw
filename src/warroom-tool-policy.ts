/**
 * War-room tool / MCP policy.
 *
 * The text war-room used to call `query()` with `permissionMode:
 * 'bypassPermissions'`, no `allowedTools` policy, and every MCP server
 * the user has installed. That meant any prompt-injected war-room
 * message could, in principle, drive Chrome, write files, send Slack,
 * or talk to Microsoft 365 without the user noticing — there was no
 * permission UI, no tool allowlist, no MCP scope.
 *
 * This module enforces the boundary:
 *
 *   - Default-allow read-only built-ins: Read, Glob, Grep, WebSearch,
 *     WebFetch, TodoWrite. These are safe for "answer in chat" turns.
 *   - Default-allow `Skill` only when an agent's per-meeting allowlist
 *     names skills that are themselves opt-in.
 *   - Default-deny side-effect built-ins: Bash, Write, Edit,
 *     NotebookEdit, claude-in-chrome, claude_ai_*, ExitPlanMode,
 *     and every MCP server.
 *   - Per-agent opt-in via `tools_allowlist:` in agents/<id>/agent.yaml.
 *     Ops typically wants Bash + google-calendar + gmail skills.
 *     Comms typically wants gmail + slack skills + Bash for scripts.
 *
 * Operators can customize the per-agent allowlist; the default-deny
 * list is hardcoded so a misconfigured agent.yaml can't accidentally
 * grant browser/M365 access.
 */

export interface WarRoomToolPolicy {
  /** Names passed to SDK `allowedTools`. Empty = SDK default-allows. */
  allowedTools: string[];
  /** Names passed to SDK `disallowedTools`. Used as defense-in-depth. */
  disallowedTools: string[];
  /** Allowlist of MCP server names; empty = no MCPs exposed. */
  allowedMcpServers: string[];
}

// Built-in tool names from the Anthropic Agent SDK. Read-only side
// matches the SDK's documented "safe to bypass permissions" set; the
// side-effect set is everything that can mutate state.
const SAFE_READONLY_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
] as const;

const SIDE_EFFECT_TOOLS = [
  'Bash',
  'Write',
  'Edit',
  'NotebookEdit',
  'ExitPlanMode',
  'Skill',
  // Browser-driving and email-suite MCPs that have repeatedly shown up
  // in war-room turns when they shouldn't have. Listed by prefix below
  // via the disallowedTools pattern; named here for documentation.
] as const;

// Agents configured for operational tasks. These defaults are sane
// starting points — each user can override via agents/<id>/agent.yaml.
const DEFAULT_AGENT_ALLOWLISTS: Record<string, string[]> = {
  // Main is the host. Default to read-only — when in doubt, route to a
  // specialist instead of doing the work directly.
  main: [],
  // Ops drives schedules and calendars; needs Bash + Skill.
  ops: ['Bash', 'Skill'],
  // Comms triages email and routes; needs Skill (gmail/slack) + Bash.
  comms: ['Bash', 'Skill'],
  // Content drafts copy. Default Skill (linkedin-post etc.) + Write so
  // it can drop drafts in outputs/. Bash explicitly NOT default — most
  // content tasks shouldn't need shell.
  content: ['Skill', 'Write'],
  // Research does web lookups via WebSearch (already in safe set);
  // shouldn't generally write files in war room.
  research: [],
};

/**
 * Build the tool/MCP policy for a given agent in the war room. Pass
 * `agentTools` from the agent's loaded `agent.yaml` (the
 * `tools_allowlist` field, if any) to override defaults.
 */
export function warRoomToolPolicy(
  agentId: string,
  agentTools?: string[],
): WarRoomToolPolicy {
  const overrides = agentTools && agentTools.length > 0 ? agentTools : null;
  const extra = overrides ?? DEFAULT_AGENT_ALLOWLISTS[agentId] ?? [];
  const allowed = Array.from(new Set([...SAFE_READONLY_TOOLS, ...extra]));

  // Disallow EVERY side-effect tool the agent didn't explicitly opt into.
  // This is defense in depth: if `allowedTools` is non-empty, the SDK
  // already restricts to that set, but we list the dangerous tools here
  // too so a future change that flips to an empty allowlist still has a
  // floor.
  const disallowed = SIDE_EFFECT_TOOLS.filter((t) => !allowed.includes(t));

  // MCP servers default to none. An operator can opt agents in via
  // `tools_allowlist` entries that begin with `mcp:` (e.g. `mcp:gmail`).
  const allowedMcpServers = (overrides ?? [])
    .filter((t) => t.startsWith('mcp:'))
    .map((t) => t.slice('mcp:'.length));

  return {
    allowedTools: allowed,
    disallowedTools: disallowed,
    allowedMcpServers,
  };
}

/**
 * Filter a map of MCP servers (from `loadMcpServers`) to only those the
 * policy permits. Any server not in `allowedMcpServers` is dropped.
 */
export function filterMcpServers<T>(
  servers: Record<string, T>,
  policy: WarRoomToolPolicy,
): Record<string, T> {
  if (policy.allowedMcpServers.length === 0) return {};
  const out: Record<string, T> = {};
  for (const [name, cfg] of Object.entries(servers)) {
    if (policy.allowedMcpServers.includes(name)) out[name] = cfg;
  }
  return out;
}
