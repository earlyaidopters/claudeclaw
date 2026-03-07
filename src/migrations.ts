import fs from 'fs';
import path from 'path';

interface VersionRegistry {
  migrations: Record<string, string[]>;
}

interface AppliedState {
  lastApplied: string | null;
}

function parseSemver(v: string): [number, number, number] {
  const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semver: ${v}`);
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

export function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = parseSemver(a);
  const [bMaj, bMin, bPatch] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

export function checkPendingMigrations(projectRoot: string): void {
  const migrationsDir = path.join(projectRoot, 'migrations');
  const versionFile = path.join(migrationsDir, 'version.json');
  const appliedFile = path.join(migrationsDir, '.applied.json');
  const storeDir = path.join(projectRoot, 'store');

  try {
    const registry: VersionRegistry = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
    const versions = Object.keys(registry.migrations).sort(compareSemver);
    if (versions.length === 0) return;

    const latest = versions[versions.length - 1];

    let lastApplied: string | null = null;
    if (fs.existsSync(appliedFile)) {
      const state: AppliedState = JSON.parse(fs.readFileSync(appliedFile, 'utf-8'));
      lastApplied = state.lastApplied;
    } else if (!fs.existsSync(storeDir)) {
      // Fresh clone — store/ hasn't been created yet, so the bot has never run.
      // Write .applied.json now so subsequent starts (after store/ is created) don't
      // mistake this for a pre-migration install.
      fs.writeFileSync(appliedFile, JSON.stringify({ lastApplied: latest }, null, 2) + '\n');
      return;
    }
    // If .applied.json is absent but store/ exists, this is a pre-migration install.
    // Fall through with lastApplied = null so the guard fires.

    const hasPending =
      lastApplied === null || compareSemver(lastApplied, latest) < 0;

    if (hasPending) {
      console.error(
        `\n⚠️  ClaudeClaw has pending migrations (applied: ${lastApplied ?? 'none'}, latest: ${latest}).\n` +
          `    Run \`npm run migrate\` to update, then restart.\n`,
      );
      process.exit(1);
    }
  } catch {
    // If version.json is missing or unreadable, skip the guard
  }
}
