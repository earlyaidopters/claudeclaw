import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const description = 'Move CLAUDE.md to personal workspace (CLAUDECLAW_CONFIG/workspace)';
export const notify = 'This migration intentionally writes outside the repo — it moves your personal CLAUDE.md to a config folder of your choosing';

function prompt(question: string, defaultVal: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultVal}): `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return prompt(`${question} [${hint}]`, defaultYes ? 'y' : 'n').then(
    (a) => a.toLowerCase().startsWith('y'),
  );
}

export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.resolve(p);
}

export interface MigrationDeps {
  prompt: (question: string, defaultVal: string) => Promise<string>;
  confirm: (question: string, defaultYes?: boolean) => Promise<boolean>;
  projectRoot: string;
}

export async function runMigration(deps: MigrationDeps): Promise<void> {
  const { projectRoot } = deps;
  const defaultConfigDir = '~/.claudeclaw';

  console.log('\nThis migration moves CLAUDE.md to a dedicated personal config folder.');
  console.log('Your assistant configuration will be kept private and safe from accidental commits or exposure when sharing the repo.');
  console.log();

  const reservedDir = path.join(os.homedir(), '.claude');

  let rawPath: string;
  let configDir: string;

  while (true) {
    rawPath = await deps.prompt('Config folder path', defaultConfigDir);
    configDir = expandHome(rawPath);
    if (configDir === reservedDir) {
      console.log('~/.claude is reserved by Claude Code and cannot be used as the config folder.');
      continue;
    }
    break;
  }

  const workspaceDir = path.join(configDir, 'workspace');

  const sourcePath = path.join(projectRoot, 'CLAUDE.md');
  const destPath = path.join(workspaceDir, 'CLAUDE.md');

  if (!fs.existsSync(sourcePath)) {
    console.log('CLAUDE.md not found in project root.');
    if (fs.existsSync(destPath)) {
      console.log(`Found existing ${destPath} — nothing to copy.`);
      return;
    } else {
      // this situation shouldn't happen as we run migration only if we have store folder that is created during setup. but I provide manual recovery just in case.
      console.warn(`No CLAUDE.md found in the project root and none exists at ${destPath}.\nRun: cp CLAUDE.md.example CLAUDE.md\nThen edit ${destPath} to replace the [BRACKETED] placeholders before starting ClaudeClaw.`);
      process.exit(1)
    }

  }

  if (fs.existsSync(destPath)) {
    const overwrite = await deps.confirm(`${destPath} already exists. Overwrite?`, false);
    if (!overwrite) {
      console.log('Skipped copy — keeping existing file.');
      fs.unlinkSync(sourcePath);
      console.log('✓  Removed CLAUDE.md from project root');
      return;
    }
  }

  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
  console.log(`✓  Copied CLAUDE.md → ${destPath}`);

  fs.unlinkSync(sourcePath);
  console.log('✓  Removed CLAUDE.md from project root');

  // Write CLAUDECLAW_CONFIG into .env if not already present
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf-8');
    if (!content.includes('CLAUDECLAW_CONFIG=')) {
      content = content.trimEnd() + `\nCLAUDECLAW_CONFIG=${rawPath}\n`;
      fs.writeFileSync(envPath, content, 'utf-8');
      console.log('✓  Added CLAUDECLAW_CONFIG to .env');
    }
  }

  console.log(`\nWorkspace: ${workspaceDir}`);
  console.log('Edit CLAUDE.md there to personalise your assistant.');
}

export async function run(): Promise<void> {
  return runMigration({ prompt, confirm, projectRoot: PROJECT_ROOT });
}
