#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'migrations');
const VERSION_FILE = path.join(MIGRATIONS_DIR, 'version.json');
const APPLIED_FILE = path.join(MIGRATIONS_DIR, '.applied.json');
const STORE_DIR = path.join(PROJECT_ROOT, 'store');

interface VersionRegistry {
  migrations: Record<string, string[]>;
}

interface AppliedState {
  lastApplied: string | null;
}

interface MigrationModule {
  description: string;
  run: () => Promise<void>;
}

interface PathWarning {
  line: number;
  text: string;
}

function parseSemver(v: string): [number, number, number] {
  const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semver: ${v}`);
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = parseSemver(a);
  const [bMaj, bMin, bPatch] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

const PATH_SCAN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\/(?:etc|var|usr|tmp|home|Users)\b/, label: 'common out-of-repo root' },
  { pattern: /(?:^|[\s=,(["'`])\/[A-Za-z]/, label: 'absolute path' },
  { pattern: /~\//, label: 'home-relative path' },
  { pattern: /[A-Za-z]:\\/, label: 'Windows absolute path' },
  { pattern: /(?:\.\.\/){2,}/, label: 'parent traversal (2+ levels)' },
  { pattern: /process\.chdir\s*\(/, label: 'process.chdir()' },
  { pattern: /os\.homedir\s*\(\)/, label: 'os.homedir()' },
  { pattern: /os\.tmpdir\s*\(\)/, label: 'os.tmpdir()' },
  { pattern: /__dirname/, label: '__dirname' },
];

function scanForPathWarnings(filePath: string): PathWarning[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const warnings: PathWarning[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern } of PATH_SCAN_PATTERNS) {
      if (pattern.test(line)) {
        warnings.push({ line: i + 1, text: line.trim() });
        break;
      }
    }
  }
  return warnings;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(VERSION_FILE)) {
    console.error('migrations/version.json not found.');
    process.exit(1);
  }

  const registry: VersionRegistry = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));

  const allVersions = Object.keys(registry.migrations).sort(compareSemver);
  const latest = allVersions[allVersions.length - 1];

  let lastApplied: string | null = null;
  if (fs.existsSync(APPLIED_FILE)) {
    const state: AppliedState = JSON.parse(fs.readFileSync(APPLIED_FILE, 'utf-8'));
    lastApplied = state.lastApplied;
  } else if (!fs.existsSync(STORE_DIR)) {
    // Fresh clone — store/ has never been created, bot has never run.
    // Auto-initialise .applied.json to the latest version; nothing to migrate.
    if (latest) {
      fs.writeFileSync(APPLIED_FILE, JSON.stringify({ lastApplied: latest }, null, 2) + '\n');
    }
    console.log(`Fresh install detected. Initialised migrations at ${latest ?? 'none'}.`);
    process.exit(0);
  }
  // If .applied.json is absent but store/ exists, this is a pre-migration install.
  // Fall through with lastApplied = null so all migrations are treated as pending.
  const pendingVersions =
    lastApplied === null
      ? allVersions
      : allVersions.filter((v) => compareSemver(v, lastApplied!) > 0);

  if (pendingVersions.length === 0) {
    console.log(`No pending migrations (current: ${lastApplied ?? 'none'}).`);
    process.exit(0);
  }

  // Load descriptions and scan for path warnings up front
  interface MigrationInfo {
    version: string;
    filename: string;
    description: string;
    warnings: PathWarning[];
  }

  const migrationInfos: MigrationInfo[] = [];
  let hasWarnings = false;

  for (const version of pendingVersions) {
    const filenames = registry.migrations[version];
    for (const filename of filenames) {
      const filePath = path.join(MIGRATIONS_DIR, version, `${filename}.ts`);
      if (!fs.existsSync(filePath)) {
        console.error(`Migration file not found: ${filePath}`);
        process.exit(1);
      }

      let description = '(no description)';
      try {
        const mod = (await import(pathToFileURL(filePath).href)) as MigrationModule;
        description = mod.description ?? description;
      } catch (e) {
        console.error(`Failed to load migration ${filePath}: ${e}`);
        process.exit(1);
      }

      const warnings = scanForPathWarnings(filePath);
      if (warnings.length > 0) hasWarnings = true;

      migrationInfos.push({ version, filename, description, warnings });
    }
  }

  // Print dry-run summary
  const totalMigrations = migrationInfos.length;
  console.log(
    `\nPending migrations (current: ${lastApplied ?? 'none'} → latest: ${latest}):\n`,
  );

  let currentVersionHeader = '';
  for (const { version, filename, description, warnings } of migrationInfos) {
    if (version !== currentVersionHeader) {
      console.log(`  ${version}:`);
      currentVersionHeader = version;
    }
    console.log(`    • ${description} (${filename})`);
    if (warnings.length > 0) {
      console.log(`      ⚠️  Possible out-of-repo path access detected:`);
      for (const w of warnings) {
        console.log(`          line ${w.line}: ${w.text}`);
      }
      console.log(`          Inspect migrations/${version}/${filename}.ts before proceeding.`);
    }
  }

  console.log('');
  if (hasWarnings) {
    console.log(`⚠️  Review each migration and check your project before proceeding.`);
    console.log(`    Inspect migrations/<version>/<name>.ts if unsure.\n`);
  }

  const versionWord = pendingVersions.length === 1 ? 'version' : 'versions';
  const migrationWord = totalMigrations === 1 ? 'migration' : 'migrations';
  const answer = await prompt(
    `Apply ${pendingVersions.length} ${versionWord} (${totalMigrations} ${migrationWord})? [y/N] `,
  );

  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    process.exit(0);
  }

  // Run migrations in order
  for (const version of pendingVersions) {
    const filenames = registry.migrations[version];
    for (const filename of filenames) {
      const filePath = path.join(MIGRATIONS_DIR, version, `${filename}.ts`);
      console.log(`[ ${filename} ] running...`);
      try {
        const mod = (await import(pathToFileURL(filePath).href)) as MigrationModule;
        await mod.run();
        console.log(`[ ${filename} ] ✓`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[ ${filename} ] ✗  ${msg}`);
        console.log('\nMigration failed. To recover:');
        console.log('  1. Investigate the error above and identify the root cause.');
        console.log('  2. Reset your working directory to a clean state:');
        console.log('       git reset --hard && git clean -fd');
        console.log('  3. Apply the necessary fix (to the migration script or your environment).');
        console.log('  4. Run `npm run migrate` again.');
        process.exit(1);
      }
    }

    // Write lastApplied after each version fully succeeds
    const state: AppliedState = { lastApplied: version };
    fs.writeFileSync(APPLIED_FILE, JSON.stringify(state, null, 2) + '\n');
  }

  const finalVersion = pendingVersions[pendingVersions.length - 1];
  console.log(`\nMigration complete. Applied: ${lastApplied ?? 'none'} → ${finalVersion}`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
