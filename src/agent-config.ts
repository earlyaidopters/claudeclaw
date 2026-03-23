import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import { CLAUDECLAW_CONFIG, PROJECT_ROOT } from './config.js';
import { readEnvFile } from './env.js';

export interface AgentConfig {
  name: string;
  description: string;
  botTokenEnv: string;
  botToken: string;
  model?: string;
  mcpServers?: string[];
  obsidian?: {
    vault: string;
    folders: string[];
    readOnly?: string[];
  };
}

/**
 * Resolve the directory for a given agent, checking CLAUDECLAW_CONFIG first,
 * then falling back to PROJECT_ROOT/agents/<id>.
 */
export function resolveAgentDir(agentId: string): string {
  const externalDir = path.join(CLAUDECLAW_CONFIG, 'agents', agentId);
  if (fs.existsSync(path.join(externalDir, 'agent.yaml'))) {
    return externalDir;
  }
  return path.join(PROJECT_ROOT, 'agents', agentId);
}

/**
 * Resolve the CLAUDE.md path for a given agent, checking CLAUDECLAW_CONFIG first,
 * then falling back to PROJECT_ROOT/agents/<id>/CLAUDE.md.
 */
export function resolveAgentClaudeMd(agentId: string): string | null {
  const externalPath = path.join(CLAUDECLAW_CONFIG, 'agents', agentId, 'CLAUDE.md');
  if (fs.existsSync(externalPath)) {
    return externalPath;
  }
  const repoPath = path.join(PROJECT_ROOT, 'agents', agentId, 'CLAUDE.md');
  if (fs.existsSync(repoPath)) {
    return repoPath;
  }
  return null;
}

export function loadAgentConfig(agentId: string): AgentConfig {
  const agentDir = resolveAgentDir(agentId);
  const configPath = path.join(agentDir, 'agent.yaml');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Agent config not found: ${configPath}`);
  }

  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

  const name = raw['name'] as string;
  const description = (raw['description'] as string) ?? '';
  const botTokenEnv = raw['telegram_bot_token_env'] as string;
  const model = raw['model'] as string | undefined;

  if (!name || !botTokenEnv) {
    throw new Error(`Agent config ${configPath} must have 'name' and 'telegram_bot_token_env'`);
  }

  const env = readEnvFile([botTokenEnv]);
  const botToken = process.env[botTokenEnv] || env[botTokenEnv] || '';
  if (!botToken) {
    throw new Error(`Bot token not found: set ${botTokenEnv} in .env`);
  }

  let obsidian: AgentConfig['obsidian'];
  const obsRaw = raw['obsidian'] as Record<string, unknown> | undefined;
  if (obsRaw) {
    const vault = obsRaw['vault'] as string;
    if (vault && !fs.existsSync(vault)) {
      // eslint-disable-next-line no-console
      console.warn(`[${agentId}] WARNING: Obsidian vault path does not exist: ${vault}`);
      console.warn(`[${agentId}] Update obsidian.vault in agent.yaml to your local vault path.`);
    }
    obsidian = {
      vault,
      folders: (obsRaw['folders'] as string[]) ?? [],
      readOnly: (obsRaw['read_only'] as string[]) ?? [],
    };
  }

  const mcpServers = raw['mcp_servers'] as string[] | undefined;

  return { name, description, botTokenEnv, botToken, model, mcpServers, obsidian };
}

/** Update the model field in an agent's agent.yaml file. */
export function setAgentModel(agentId: string, model: string): void {
  const agentDir = resolveAgentDir(agentId);
  const configPath = path.join(agentDir, 'agent.yaml');
  if (!fs.existsSync(configPath)) throw new Error(`Agent config not found: ${configPath}`);

  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  raw['model'] = model;
  fs.writeFileSync(configPath, yaml.dump(raw, { lineWidth: -1 }), 'utf-8');
}

/** List all configured agent IDs (directories under agents/ with agent.yaml).
 *  Scans both CLAUDECLAW_CONFIG/agents/ and PROJECT_ROOT/agents/, deduplicating.
 */
export function listAgentIds(): string[] {
  const ids = new Set<string>();

  for (const baseDir of [
    path.join(CLAUDECLAW_CONFIG, 'agents'),
    path.join(PROJECT_ROOT, 'agents'),
  ]) {
    if (!fs.existsSync(baseDir)) continue;
    for (const d of fs.readdirSync(baseDir)) {
      if (d.startsWith('_')) continue;
      const yamlPath = path.join(baseDir, d, 'agent.yaml');
      if (fs.existsSync(yamlPath)) ids.add(d);
    }
  }

  return [...ids];
}

/** Return the capabilities (name + description) for a specific agent. */
export function getAgentCapabilities(
  agentId: string,
): { name: string; description: string } | null {
  try {
    const config = loadAgentConfig(agentId);
    return { name: config.name, description: config.description };
  } catch {
    return null;
  }
}

/**
 * List all configured agents with their descriptions.
 * Unlike `listAgentIds()`, this returns richer metadata and silently
 * skips agents whose config fails to load (e.g. missing token).
 */
export function listAllAgents(): Array<{
  id: string;
  name: string;
  description: string;
  model?: string;
}> {
  const ids = listAgentIds();
  const result: Array<{
    id: string;
    name: string;
    description: string;
    model?: string;
  }> = [];

  for (const id of ids) {
    try {
      const config = loadAgentConfig(id);
      result.push({
        id,
        name: config.name,
        description: config.description,
        model: config.model,
      });
    } catch {
      // Skip agents with broken config
    }
  }

  return result;
}
