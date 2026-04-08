import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

import { CLAUDECLAW_CONFIG, PROJECT_ROOT, STORE_DIR } from './config.js';
import { listAgentIds, loadAgentConfig, resolveAgentDir } from './agent-config.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
}

export interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface CreateAgentOpts {
  id: string;
  name: string;
  description: string;
  model?: string;
  template?: string;
  botToken: string;
}

export interface CreateAgentResult {
  agentId: string;
  agentDir: string;
  envKey: string;
  plistPath: string | null;
  botInfo: BotInfo;
}

// ── Auto-color palette for new agents ────────────────────────────────

const AGENT_COLOR_PALETTE = [
  '#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#e11d48', '#06b6d4', '#d97706', '#7c3aed', '#059669',
];

// ── Validation ───────────────────────────────────────────────────────

const VALID_ID_RE = /^[a-z][a-z0-9_-]{0,29}$/;

export function validateAgentId(id: string): { ok: boolean; error?: string } {
  if (!id) return { ok: false, error: 'Agent ID is required' };
  if (!VALID_ID_RE.test(id)) {
    return {
      ok: false,
      error: 'Agent ID must be lowercase, start with a letter, and contain only a-z, 0-9, hyphens, or underscores (max 30 chars)',
    };
  }
  if (id === 'main') return { ok: false, error: '"main" is reserved for the primary bot' };
  if (id.startsWith('_')) return { ok: false, error: 'Agent IDs starting with _ are reserved for templates' };

  // Check for collisions
  const existing = listAgentIds();
  if (existing.includes(id)) {
    return { ok: false, error: `Agent "${id}" already exists` };
  }

  return { ok: true };
}

export async function validateBotToken(token: string): Promise<{ ok: boolean; botInfo?: BotInfo; error?: string }> {
  if (!token || !token.includes(':')) {
    return { ok: false, error: 'Invalid token format. Tokens look like 123456789:ABCdefGHIjklMNO...' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: BotInfo; description?: string };

    if (!data.ok || !data.result) {
      return { ok: false, error: data.description || 'Token validation failed' };
    }

    if (!data.result.is_bot) {
      return { ok: false, error: 'Token does not belong to a bot' };
    }

    return { ok: true, botInfo: data.result };
  } catch {
    return { ok: false, error: 'Could not reach Telegram API. Check your network connection.' };
  }
}

// ── Templates ────────────────────────────────────────────────────────

export function listTemplates(): AgentTemplate[] {
  const templates: AgentTemplate[] = [];
  const agentsDir = path.join(PROJECT_ROOT, 'agents');

  if (!fs.existsSync(agentsDir)) return templates;

  for (const dir of fs.readdirSync(agentsDir)) {
    // Include _template and any agent dir that has an agent.yaml.example or agent.yaml
    const fullDir = path.join(agentsDir, dir);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    const yamlExample = path.join(fullDir, 'agent.yaml.example');
    const yamlFile = path.join(fullDir, 'agent.yaml');
    const hasConfig = fs.existsSync(yamlExample) || fs.existsSync(yamlFile);
    if (!hasConfig) continue;

    // Read name + description from whichever config exists
    let name = dir === '_template' ? 'Blank' : dir;
    let description = dir === '_template' ? 'Start from a blank template' : '';

    try {
      const configPath = fs.existsSync(yamlFile) ? yamlFile : yamlExample;
      const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      if (raw['name'] && typeof raw['name'] === 'string') name = raw['name'];
      if (raw['description'] && typeof raw['description'] === 'string') description = raw['description'];
    } catch { /* use defaults */ }

    templates.push({ id: dir, name, description });
  }

  // Sort: _template (blank) last, others alphabetical
  templates.sort((a, b) => {
    if (a.id === '_template') return 1;
    if (b.id === '_template') return -1;
    return a.id.localeCompare(b.id);
  });

  return templates;
}

// ── Create ───────────────────────────────────────────────────────────

export async function createAgent(opts: CreateAgentOpts): Promise<CreateAgentResult> {
  const { id, name, description, model, template, botToken } = opts;

  // Validate ID
  const idCheck = validateAgentId(id);
  if (!idCheck.ok) throw new Error(idCheck.error);

  // Max agent limit
  const existing = listAgentIds();
  if (existing.length >= 20) throw new Error('Maximum of 20 agents reached. Delete unused agents first.');

  // Validate token
  const tokenCheck = await validateBotToken(botToken);
  if (!tokenCheck.ok || !tokenCheck.botInfo) throw new Error(tokenCheck.error || 'Token validation failed');

  // Check token isn't already in use by another agent
  for (const existingId of existing) {
    try {
      const existingConfig = loadAgentConfig(existingId);
      if (existingConfig.botToken === botToken) {
        throw new Error(`This bot token is already used by agent "${existingId}"`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('already used')) throw err;
      // Skip agents with broken configs
    }
  }

  // Determine agent directory (prefer CLAUDECLAW_CONFIG if it exists)
  let agentDir: string;
  const externalAgentsDir = path.join(CLAUDECLAW_CONFIG, 'agents');
  if (fs.existsSync(CLAUDECLAW_CONFIG)) {
    agentDir = path.join(externalAgentsDir, id);
  } else {
    agentDir = path.join(PROJECT_ROOT, 'agents', id);
  }

  fs.mkdirSync(agentDir, { recursive: true });

  // Resolve template directory
  const templateId = template || '_template';
  const templateDir = path.join(PROJECT_ROOT, 'agents', templateId);

  // Copy CLAUDE.md from template
  const claudeMdSources = [
    path.join(templateDir, 'CLAUDE.md'),
    path.join(templateDir, 'CLAUDE.md.example'),
    path.join(PROJECT_ROOT, 'agents', '_template', 'CLAUDE.md'),
  ];
  for (const src of claudeMdSources) {
    if (fs.existsSync(src)) {
      let content = fs.readFileSync(src, 'utf-8');
      // Replace template agent ID references with the new agent ID
      content = content.replace(/\[AGENT_ID\]/g, id);
      fs.writeFileSync(path.join(agentDir, 'CLAUDE.md'), content, 'utf-8');
      break;
    }
  }

  // Create agent.yaml
  const envKey = `${id.toUpperCase().replace(/-/g, '_')}_BOT_TOKEN`;
  const agentYaml: Record<string, unknown> = {
    name,
    description,
    telegram_bot_token_env: envKey,
    model: model || 'claude-sonnet-4-6',
  };
  fs.writeFileSync(
    path.join(agentDir, 'agent.yaml'),
    yaml.dump(agentYaml, { lineWidth: -1 }),
    'utf-8',
  );

  // Write bot token to .env
  const envPath = path.join(PROJECT_ROOT, '.env');
  writeBotTokenToEnv(envPath, envKey, botToken, id);

  // Generate launchd plist (or systemd unit)
  const plistPath = generateServiceConfig(id);

  logger.info({ agentId: id, agentDir, envKey, bot: tokenCheck.botInfo.username }, 'Agent created');

  return {
    agentId: id,
    agentDir,
    envKey,
    plistPath,
    botInfo: tokenCheck.botInfo,
  };
}

// ── .env management ──────────────────────────────────────────────────

function writeBotTokenToEnv(envPath: string, envKey: string, token: string, agentId: string): void {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf-8');
  } catch { /* .env might not exist yet */ }

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(`${envKey}=`)) {
      lines[i] = `${envKey}=${token}`;
      found = true;
      break;
    }
  }

  if (!found) {
    // Append with a comment
    if (content.length > 0 && !content.endsWith('\n')) {
      lines.push('');
    }
    lines.push(`# Agent: ${agentId}`);
    lines.push(`${envKey}=${token}`);
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

function removeBotTokenFromEnv(envPath: string, envKey: string, agentId: string): void {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const filtered: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Skip the token line
    if (trimmed.startsWith(`${envKey}=`)) continue;
    // Skip the "# Agent: id" comment right before the token
    if (trimmed === `# Agent: ${agentId}` && i + 1 < lines.length && lines[i + 1].trim().startsWith(`${envKey}=`)) {
      continue;
    }
    filtered.push(lines[i]);
  }

  fs.writeFileSync(envPath, filtered.join('\n'), 'utf-8');
}

// ── Service config generation ────────────────────────────────────────

function generateServiceConfig(agentId: string): string | null {
  if (os.platform() === 'darwin') {
    return generateLaunchdPlist(agentId);
  } else if (os.platform() === 'linux') {
    return generateSystemdUnit(agentId);
  }
  return null;
}

function generateLaunchdPlist(agentId: string): string {
  const plistDir = path.join(PROJECT_ROOT, 'launchd');
  fs.mkdirSync(plistDir, { recursive: true });

  const label = `com.claudeclaw.${agentId}`;
  const plistPath = path.join(plistDir, `${label}.plist`);

  // Use the same Node binary that's running this process (works with nvm, homebrew, or system node)
  const nodePath = process.execPath;
  const nodeBinDir = path.dirname(nodePath);

  // Build PATH: node's bin dir first, then standard system paths
  const systemPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  const allPaths = [nodeBinDir, ...systemPaths.filter(p => p !== nodeBinDir)];
  const envPath = allPaths.join(':');

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>dist/index.js</string>
    <string>--agent</string>
    <string>${agentId}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>__PROJECT_DIR__</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>${envPath}</string>
    <key>HOME</key>
    <string>__HOME__</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>__PROJECT_DIR__/logs/${agentId}.log</string>
  <key>StandardErrorPath</key>
  <string>__PROJECT_DIR__/logs/${agentId}.log</string>
</dict>
</plist>
`;

  fs.writeFileSync(plistPath, plist, 'utf-8');
  return plistPath;
}

function generateSystemdUnit(agentId: string): string {
  const unitDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  fs.mkdirSync(unitDir, { recursive: true });

  const serviceName = `com.claudeclaw.agent-${agentId}`;
  const unitPath = path.join(unitDir, `${serviceName}.service`);

  const nodePath = process.execPath;

  const unit = `[Unit]
Description=ClaudeClaw Agent: ${agentId}
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${PROJECT_ROOT}/dist/index.js --agent ${agentId}
WorkingDirectory=${PROJECT_ROOT}
Environment=NODE_ENV=production
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`;

  fs.writeFileSync(unitPath, unit, 'utf-8');
  return unitPath;
}

// ── Activate / Deactivate ────────────────────────────────────────────

export interface ActivationResult {
  ok: boolean;
  error?: string;
  pid?: number;
}

export function activateAgent(agentId: string): ActivationResult {
  try {
    if (os.platform() === 'darwin') {
      return activateLaunchd(agentId);
    } else if (os.platform() === 'linux') {
      return activateSystemd(agentId);
    }
    return { ok: false, error: `Unsupported platform: ${os.platform()}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function activateLaunchd(agentId: string): ActivationResult {
  const label = `com.claudeclaw.${agentId}`;
  const templatePlist = path.join(PROJECT_ROOT, 'launchd', `${label}.plist`);
  const destPlist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);

  if (!fs.existsSync(templatePlist)) {
    return { ok: false, error: `Plist not found: ${templatePlist}` };
  }

  // Ensure logs directory exists
  fs.mkdirSync(path.join(PROJECT_ROOT, 'logs'), { recursive: true });

  // Substitute placeholders
  let content = fs.readFileSync(templatePlist, 'utf-8');
  content = content.replace(/__PROJECT_DIR__/g, PROJECT_ROOT);
  content = content.replace(/__HOME__/g, os.homedir());

  // Ensure LaunchAgents directory exists
  fs.mkdirSync(path.dirname(destPlist), { recursive: true });

  // Unload if already loaded
  try {
    execSync(`launchctl unload "${destPlist}" 2>/dev/null`, { stdio: 'ignore' });
  } catch { /* not loaded */ }

  fs.writeFileSync(destPlist, content, 'utf-8');
  execSync(`launchctl load "${destPlist}"`);

  // Wait briefly and check if process started
  let pid: number | undefined;
  for (let i = 0; i < 5; i++) {
    const pidFile = path.join(STORE_DIR, `agent-${agentId}.pid`);
    if (fs.existsSync(pidFile)) {
      const p = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (!isNaN(p)) {
        try {
          process.kill(p, 0);
          pid = p;
          break;
        } catch { /* not yet */ }
      }
    }
    // Brief synchronous wait
    execSync('sleep 1', { stdio: 'ignore' });
  }

  logger.info({ agentId, pid }, 'Agent activated (launchd)');
  return { ok: true, pid };
}

function activateSystemd(agentId: string): ActivationResult {
  const serviceName = `com.claudeclaw.agent-${agentId}`;
  try {
    execSync(`systemctl --user daemon-reload`, { stdio: 'ignore' });
    execSync(`systemctl --user enable "${serviceName}"`, { stdio: 'ignore' });
    execSync(`systemctl --user start "${serviceName}"`, { stdio: 'ignore' });
    logger.info({ agentId }, 'Agent activated (systemd)');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function deactivateAgent(agentId: string): { ok: boolean; error?: string } {
  try {
    if (os.platform() === 'darwin') {
      const label = `com.claudeclaw.${agentId}`;
      const destPlist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
      if (fs.existsSync(destPlist)) {
        try { execSync(`launchctl unload "${destPlist}"`, { stdio: 'ignore' }); } catch { /* ok */ }
        fs.unlinkSync(destPlist);
      }
    } else if (os.platform() === 'linux') {
      const serviceName = `com.claudeclaw.agent-${agentId}`;
      try {
        execSync(`systemctl --user stop "${serviceName}"`, { stdio: 'ignore' });
        execSync(`systemctl --user disable "${serviceName}"`, { stdio: 'ignore' });
      } catch { /* ok */ }
      const unitPath = path.join(os.homedir(), '.config', 'systemd', 'user', `${serviceName}.service`);
      if (fs.existsSync(unitPath)) fs.unlinkSync(unitPath);
      try { execSync('systemctl --user daemon-reload', { stdio: 'ignore' }); } catch { /* ok */ }
    }

    // Kill the process if still running
    const pidFile = path.join(STORE_DIR, `agent-${agentId}.pid`);
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (!isNaN(pid)) {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
      }
      try { fs.unlinkSync(pidFile); } catch { /* ok */ }
    }

    logger.info({ agentId }, 'Agent deactivated');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Delete ───────────────────────────────────────────────────────────

export function deleteAgent(agentId: string): { ok: boolean; error?: string } {
  // Deactivate first
  deactivateAgent(agentId);

  const envKey = `${agentId.toUpperCase().replace(/-/g, '_')}_BOT_TOKEN`;

  try {
    // Remove agent directory (both possible locations)
    for (const baseDir of [
      path.join(CLAUDECLAW_CONFIG, 'agents'),
      path.join(PROJECT_ROOT, 'agents'),
    ]) {
      const agentDir = path.join(baseDir, agentId);
      if (fs.existsSync(agentDir)) {
        fs.rmSync(agentDir, { recursive: true, force: true });
      }
    }

    // Remove launchd plist template
    const plistTemplate = path.join(PROJECT_ROOT, 'launchd', `com.claudeclaw.${agentId}.plist`);
    if (fs.existsSync(plistTemplate)) fs.unlinkSync(plistTemplate);

    // Remove token from .env
    removeBotTokenFromEnv(path.join(PROJECT_ROOT, '.env'), envKey, agentId);

    // Remove log files
    const logFile = path.join(PROJECT_ROOT, 'logs', `${agentId}.log`);
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    logger.info({ agentId }, 'Agent deleted');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Suggest a bot display name and username based on agent ID. */
export function suggestBotNames(agentId: string): { displayName: string; username: string } {
  const label = agentId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    displayName: `ClaudeClaw ${label}`,
    username: `claudeclaw_${agentId.replace(/-/g, '_')}_bot`,
  };
}

/** Pick a color for a new agent (avoids colors already used by existing agents). */
export function pickAgentColor(existingCount: number): string {
  return AGENT_COLOR_PALETTE[existingCount % AGENT_COLOR_PALETTE.length];
}

/** Check if an agent process is currently running. */
export function isAgentRunning(agentId: string): boolean {
  const pidFile = path.join(STORE_DIR, `agent-${agentId}.pid`);
  if (!fs.existsSync(pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
