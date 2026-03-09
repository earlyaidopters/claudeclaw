import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import { PROJECT_ROOT } from './config.js';
import { readEnvFile } from './env.js';

export interface AgentConfig {
  name: string;
  description: string;
  botTokenEnv: string;
  botToken: string;
  model?: string;
  obsidian?: {
    vault: string;
    folders: string[];
    readOnly?: string[];
  };
}

export function loadAgentConfig(agentId: string): AgentConfig {
  const agentDir = path.join(PROJECT_ROOT, 'agents', agentId);
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
    obsidian = {
      vault: obsRaw['vault'] as string,
      folders: (obsRaw['folders'] as string[]) ?? [],
      readOnly: (obsRaw['read_only'] as string[]) ?? [],
    };
  }

  return { name, description, botTokenEnv, botToken, model, obsidian };
}

/** List all configured agent IDs (directories under agents/ with agent.yaml). */
export function listAgentIds(): string[] {
  const agentsDir = path.join(PROJECT_ROOT, 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir).filter((d) => {
    if (d.startsWith('_')) return false;
    const yamlPath = path.join(agentsDir, d, 'agent.yaml');
    return fs.existsSync(yamlPath);
  });
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
