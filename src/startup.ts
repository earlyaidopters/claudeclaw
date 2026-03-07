import fs from 'fs';
import os from 'os';
import path from 'path';

import { logger } from './logger.js';

export function loadKnownPlaceholders(projectRoot: string): string[] {
  try {
    const example = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md.example'), 'utf-8');
    // Extract lines between "Replace [placeholders] from the list below:" and the closing "-->"
    const match = example.match(/Replace \[placeholders\] from the list below:\n([\s\S]*?)-->/);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => `[${name}]`);
  } catch {
    return [];
  }
}

export function ensureWorkspace(configDir: string, workspaceDir: string, projectRoot: string): void {
  const reservedDir = path.join(os.homedir(), '.claude');
  if (configDir === reservedDir) {
    logger.error(
      `CLAUDECLAW_CONFIG is set to ~/.claude, which is reserved by Claude Code.\n` +
      `Set CLAUDECLAW_CONFIG to a different folder in .env (e.g. ~/.claudeclaw).`,
    );
    process.exit(1);
  }

  if (!workspaceDir) {
    logger.info(
      `Welcome to ClaudeClaw! To get started, set up your project:\n` +
      `Run \`npm run setup\` to create your CLAUDE.md and get started.`      
    );
    process.exit(0);
  }

  const claudeMd = path.join(workspaceDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMd)) {
    logger.info(
      `Welcome to ClaudeClaw! Your workspace is configured but not yet initialised.\n` +
      `Run \`npm run setup\` to create your CLAUDE.md and get started.`
    );
    process.exit(0);
  }

  const content = fs.readFileSync(claudeMd, 'utf-8');
  const knownPlaceholders = loadKnownPlaceholders(projectRoot);
  const unfilled = knownPlaceholders.filter((p) => content.includes(p));
  if (unfilled.length > 0) {
    logger.warn(
      `CLAUDE.md contains unfilled placeholders: ${unfilled.join(', ')}.\n` +
      `Edit ${claudeMd} to replace them — commands referencing these will fail.`,
    );
  } else {
    logger.info(`Using CLAUDE.md file from ${claudeMd}`)
  }
}
