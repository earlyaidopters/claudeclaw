import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const description = 'Move agent configs from repo agents/ to $CLAUDECLAW_CONFIG/agents/';
export const notify =
  'This migration writes outside the repo — it moves agent configs to your personal config folder';

// agent.yaml files containing this string are personal and should be deleted, not copied.
const PERSONAL_PATH_MARKER = '/Users/marwankashef/';

export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.resolve(p);
}

export function readClaudeclawConfig(projectRoot: string): string | null {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(/^CLAUDECLAW_CONFIG=(.+)$/m);
  if (!match) return null;
  return expandHome(match[1].trim());
}

export interface MigrationDeps {
  projectRoot: string;
}

export function runMigration(deps: MigrationDeps): void {
  const { projectRoot } = deps;

  const claudeclawConfig = readClaudeclawConfig(projectRoot);
  if (!claudeclawConfig) {
    console.log(
      'CLAUDECLAW_CONFIG not found in .env — skipping agent migration.\n' +
        'Run `npm run migrate` again after setting CLAUDECLAW_CONFIG in .env.',
    );
    return;
  }

  const repoAgentsDir = path.join(projectRoot, 'agents');
  if (!fs.existsSync(repoAgentsDir)) {
    console.log('No agents/ directory found in repo — nothing to migrate.');
    return;
  }

  const entries = fs.readdirSync(repoAgentsDir, { withFileTypes: true });
  const agentDirs = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith('_'),
  );

  if (agentDirs.length === 0) {
    console.log('No agent directories found — nothing to migrate.');
    return;
  }

  for (const entry of agentDirs) {
    const agentName = entry.name;
    const repoAgentDir = path.join(repoAgentsDir, agentName);
    const yamlPath = path.join(repoAgentDir, 'agent.yaml');

    if (!fs.existsSync(yamlPath)) {
      console.log(`  agents/${agentName}/  — no agent.yaml, skipped`);
      continue;
    }

    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');

    if (yamlContent.includes(PERSONAL_PATH_MARKER)) {
      fs.unlinkSync(yamlPath);
      console.log(
        `  agents/${agentName}/agent.yaml  — deleted (contained personal path '${PERSONAL_PATH_MARKER}')`,
      );
      continue;
    }

    // Copy agent.yaml (and CLAUDE.md if present) to CLAUDECLAW_CONFIG/agents/[name]/
    const destDir = path.join(claudeclawConfig, 'agents', agentName);

    fs.mkdirSync(destDir, { recursive: true });

    fs.copyFileSync(yamlPath, path.join(destDir, 'agent.yaml'));
    fs.unlinkSync(yamlPath);
    console.log(
      `  agents/${agentName}/agent.yaml  — copied to ${destDir}/agent.yaml and removed from repo`,
    );

    const claudeMdSrc = path.join(repoAgentDir, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      const claudeMdDest = path.join(destDir, 'CLAUDE.md');
      if (fs.existsSync(claudeMdDest)) {
        console.log(
          `  agents/${agentName}/CLAUDE.md  — skipped (${claudeMdDest} already exists)`,
        );
      } else {
        fs.copyFileSync(claudeMdSrc, claudeMdDest);
        fs.unlinkSync(claudeMdSrc);
        console.log(
          `  agents/${agentName}/CLAUDE.md  — copied to ${claudeMdDest} and removed from repo`,
        );
      }
    }
  }
}

export async function run(): Promise<void> {
  runMigration({ projectRoot: PROJECT_ROOT });
}
