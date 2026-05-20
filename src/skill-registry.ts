import fs from 'fs';
import os from 'os';
import path from 'path';

import { logger } from './logger.js';

// ── Types ───────────────────────────────────────────────────────────

export interface SkillMeta {
  id: string;           // directory name
  name: string;         // from frontmatter or first H1
  description: string;  // first paragraph or frontmatter description
  triggerWords: string[]; // from frontmatter 'triggers:' field or derived from name
  fullPath: string;     // absolute path to SKILL.md
}

// ── Internal state ──────────────────────────────────────────────────

const skills: Map<string, SkillMeta> = new Map();

// ── Frontmatter parsing ─────────────────────────────────────────────

interface Frontmatter {
  name?: string;
  description?: string;
  triggers?: string[];
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();
  const fm: Frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (key === 'name') {
      fm.name = rawValue.replace(/^["']|["']$/g, '');
    } else if (key === 'description') {
      fm.description = rawValue.replace(/^["']|["']$/g, '');
    } else if (key === 'triggers') {
      // triggers can be a comma-separated list or a YAML array on one line
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        fm.triggers = rawValue
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
          .filter(Boolean);
      } else if (rawValue) {
        fm.triggers = rawValue
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
          .filter(Boolean);
      }
    }
  }

  // Handle multi-line triggers (YAML list with - items)
  if (!fm.triggers) {
    const triggersIdx = yamlBlock.indexOf('triggers:');
    if (triggersIdx !== -1) {
      const afterTriggers = yamlBlock.slice(triggersIdx + 'triggers:'.length);
      const firstLineValue = afterTriggers.split('\n')[0].trim();
      if (!firstLineValue) {
        // Multi-line YAML list
        const items: string[] = [];
        const lines = afterTriggers.split('\n').slice(1);
        for (const l of lines) {
          const trimmedLine = l.trim();
          if (trimmedLine.startsWith('- ')) {
            items.push(trimmedLine.slice(2).trim().replace(/^["']|["']$/g, '').toLowerCase());
          } else {
            break;
          }
        }
        if (items.length > 0) fm.triggers = items;
      }
    }
  }

  return { frontmatter: fm, body };
}

function extractFirstH1(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractFirstParagraph(body: string): string {
  const lines = body.split('\n');
  const paragraphLines: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings and empty lines at the start
    if (!started) {
      if (!trimmed || trimmed.startsWith('#')) continue;
      started = true;
    }
    if (started) {
      if (!trimmed) break;
      if (trimmed.startsWith('#')) break;
      paragraphLines.push(trimmed);
    }
  }

  return paragraphLines.join(' ').slice(0, 200);
}

// ── Skill scanning ──────────────────────────────────────────────────

function findSkillFile(dir: string): string | null {
  const skillMd = path.join(dir, 'SKILL.md');
  if (fs.existsSync(skillMd)) return skillMd;

  // Fall back to first .md file
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        return path.join(dir, entry.name);
      }
    }
  } catch {
    // Directory not readable
  }
  return null;
}

function scanDirectory(dir: string): void {
  if (!fs.existsSync(dir)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    logger.warn({ dir }, 'Could not read skill directory');
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const skillDir = path.join(dir, entry.name);
    const skillFile = findSkillFile(skillDir);
    if (!skillFile) continue;

    let content: string;
    try {
      content = fs.readFileSync(skillFile, 'utf-8');
    } catch {
      logger.warn({ skillFile }, 'Could not read skill file');
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(content);
    const name = frontmatter.name || extractFirstH1(body) || entry.name;
    const description = frontmatter.description || extractFirstParagraph(body);
    const triggerWords = frontmatter.triggers
      || name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const meta: SkillMeta = {
      id: entry.name,
      name,
      description,
      triggerWords,
      fullPath: skillFile,
    };

    // Don't overwrite if already registered (project skills take priority)
    if (!skills.has(meta.id)) {
      skills.set(meta.id, meta);
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Scan skills/ (relative to project root) and ~/.claude/skills/ to
 * populate the registry. Safe to call multiple times; clears previous state.
 */
export function initSkillRegistry(): void {
  skills.clear();

  // Find project root by walking up from this file looking for CLAUDE.md
  let projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  // Fallback: look for CLAUDE.md to confirm
  if (!fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
    // Already at a reasonable default, just continue
    logger.debug({ projectRoot }, 'CLAUDE.md not found at expected project root');
  }

  const projectSkillsDir = path.join(projectRoot, 'skills');
  const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');

  // Scan project skills first (they take priority)
  scanDirectory(projectSkillsDir);
  scanDirectory(globalSkillsDir);

  logger.info({ count: skills.size }, 'Skill registry initialized');
}

/**
 * Return a compact index of all skills, one line per skill.
 * Format: "skill_id: description"
 */
export function getSkillIndex(): string {
  return Array.from(skills.values())
    .map((s) => `${s.id}: ${s.description}`)
    .join('\n');
}

/**
 * Find skills whose trigger words appear in the message.
 */
export function matchSkills(message: string): SkillMeta[] {
  const lower = message.toLowerCase();
  const matched: SkillMeta[] = [];

  for (const skill of skills.values()) {
    for (const trigger of skill.triggerWords) {
      if (lower.includes(trigger)) {
        matched.push(skill);
        break;
      }
    }
  }

  return matched;
}

/**
 * Load the full SKILL.md content for a given skill ID.
 */
export function getSkillInstructions(id: string): string | null {
  const skill = skills.get(id);
  if (!skill) return null;

  try {
    return fs.readFileSync(skill.fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Return all registered skills.
 */
export function getAllSkills(): SkillMeta[] {
  return Array.from(skills.values());
}
