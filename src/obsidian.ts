import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

export interface ObsidianConfig {
  vault: string;
  folders: string[];
  readOnly?: string[];
}

interface ObsidianNote {
  title: string;
  folder: string;
  openTasks: string[];
}

let _cache: ObsidianNote[] = [];
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function buildObsidianContext(config: ObsidianConfig | undefined): string {
  if (!config) return '';

  // Validate vault path exists on first cache build
  if (_cacheTime === 0 && !fs.existsSync(config.vault)) {
    logger.warn(
      { vault: config.vault },
      'Obsidian vault path does not exist. Check agent.yaml obsidian.vault setting. Obsidian integration is disabled.',
    );
    return '';
  }

  const now = Date.now();
  if (now - _cacheTime > CACHE_TTL_MS) {
    _cache = scanFolders(config);
    _cacheTime = now;
  }

  if (_cache.length === 0) return '';

  const lines: string[] = ['[Obsidian context]'];
  let currentFolder = '';

  for (const note of _cache) {
    if (note.folder !== currentFolder) {
      currentFolder = note.folder;
      lines.push(`  ${currentFolder}/`);
    }
    for (const task of note.openTasks) {
      lines.push(`    Open: ${task} (${note.title})`);
    }
  }

  lines.push('[End Obsidian context]');
  return lines.join('\n');
}

function scanFolders(config: ObsidianConfig): ObsidianNote[] {
  const allFolders = [...config.folders, ...(config.readOnly ?? [])];
  const notes: ObsidianNote[] = [];

  for (const folder of allFolders) {
    const folderPath = path.join(config.vault, folder);
    if (!fs.existsSync(folderPath)) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const filePath = path.join(folderPath, entry.name);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      // Skip notes tagged as done
      if (/^status:\s*done/mi.test(content)) continue;

      // Extract open tasks: lines matching - [ ]
      const openTasks: string[] = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^-\s+\[\s\]\s+(.+)/);
        if (match) {
          openTasks.push(match[1].trim());
        }
      }

      if (openTasks.length > 0) {
        const title = entry.name.replace(/\.md$/, '');
        notes.push({ title, folder, openTasks });
      }
    }
  }

  return notes;
}

/** Reset cache (for testing). */
export function _resetObsidianCache(): void {
  _cache = [];
  _cacheTime = 0;
}
