#!/usr/bin/env tsx
/**
 * Pass 1 — Identity Memory Import.
 *
 * Pins the foundational identity/preferences/rules files from
 *   - ~/clawd/*.md (SOUL, USER, TOOLS, RULES, HEARTBEAT, DREAMS, MEMORY, IDENTITY, AGENTS, PROACTIVE-BUILDER-MODE, decisions)
 *   - ~/.claudeclaw/CLAUDE.md + ~/.claudeclaw/ref/*.md
 *   - ~/Obsidian/JSMN/09-Agents, 10-Reference, 08-Memory  (shallow walk)
 *
 * For each file:
 *   1. Read full content
 *   2. Gemini extracts {summary, entities, topics, importance=1.0}
 *   3. embedText() generates 3072-dim vector
 *   4. saveStructuredMemory(source='identity', agentId='main', importance=1.0)
 *   5. UPDATE memories SET pinned=1, salience=1.0
 *
 * Usage:
 *   tsx scripts/memory-import-identity.ts [--dry-run]
 *
 * Output: per-file report + total counts + rough cost.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { ALLOWED_CHAT_ID } from '../src/config.js';
import { initDatabase, saveStructuredMemory, saveMemoryEmbedding } from '../src/db.js';
import { embedText } from '../src/embeddings.js';
import { generateContent, parseJsonResponse } from '../src/gemini.js';
import Database from 'better-sqlite3';

const HOME = os.homedir();
const DRY_RUN = process.argv.includes('--dry-run');

// ── Identity file discovery ────────────────────────────────────────

const CLAWD_IDENTITY = [
  'SOUL.md',
  'USER.md',
  'TOOLS.md',
  'TOOLS-REFERENCE.md',
  'RULES.md',
  'SECURITY-RULES.md',
  'HEARTBEAT.md',
  'DREAMS.md',
  'MEMORY.md',
  'IDENTITY.md',
  'AGENTS.md',
  'PROJECTS.md',
  'PROACTIVE-BUILDER-MODE.md',
  'CLAUDE.md',
  'decisions.md',
  'MORNING_BRIEFING.md',
  'WORKFLOW_AUTO.md',
];

const CLAUDECLAW_IDENTITY = [
  '.claudeclaw/CLAUDE.md',
  '.claudeclaw/ref/decisions.md',
  '.claudeclaw/ref/tools.md',
  '.claudeclaw/ref/memory.md',
  '.claudeclaw/ref/ghl-fields.md',
];

const OBSIDIAN_VAULT = path.join(HOME, 'Obsidian', 'JSMN');
const OBSIDIAN_FOLDERS = ['09-Agents', '10-Reference', '08-Memory'];

function discoverIdentityFiles(): string[] {
  const found: string[] = [];

  // clawd root
  for (const name of CLAWD_IDENTITY) {
    const p = path.join(HOME, 'clawd', name);
    if (fs.existsSync(p)) found.push(p);
  }

  // .claudeclaw
  for (const rel of CLAUDECLAW_IDENTITY) {
    const p = path.join(HOME, rel);
    if (fs.existsSync(p)) found.push(p);
  }

  // Obsidian Identity / System / Memory folders (shallow walk, *.md only)
  for (const folder of OBSIDIAN_FOLDERS) {
    const dir = path.join(OBSIDIAN_VAULT, folder);
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
          found.push(path.join(dir, e.name));
        }
      }
    } catch {
      // ignore folder read failure
    }
  }

  return found;
}

// ── Gemini extraction ─────────────────────────────────────────────

interface Extraction {
  summary: string;
  entities: string[];
  topics: string[];
  importance: number;
}

const IDENTITY_EXTRACT_PROMPT = `You are extracting a PINNED identity/preferences memory from a foundational document. This document is NOT an ephemeral conversation; it's a canonical source of truth about the user's identity, tools, rules, preferences, or project context.

Return JSON:
{
  "summary": "2-4 sentence compact summary capturing the document's durable essence. Write as standing facts/rules, not narration. No em dashes.",
  "entities": ["people, orgs, products, tools, projects mentioned"],
  "topics": ["high-level categories: identity, rules, preferences, workflow, tools, projects, business, agents, etc."],
  "importance": 0.9-1.0
}

Filename: {FILENAME}
Content:
{CONTENT}`;

async function extractIdentity(filename: string, content: string): Promise<Extraction | null> {
  const prompt = IDENTITY_EXTRACT_PROMPT
    .replace('{FILENAME}', filename)
    .replace('{CONTENT}', content.slice(0, 20000)); // 20k char cap per file
  const raw = await generateContent(prompt);
  const parsed = parseJsonResponse<Extraction>(raw);
  if (!parsed || !parsed.summary) return null;
  return {
    summary: parsed.summary,
    entities: parsed.entities ?? [],
    topics: parsed.topics ?? [],
    importance: Math.max(0.9, Math.min(1.0, parsed.importance ?? 1.0)),
  };
}

// ── Main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  initDatabase();

  const chatId = ALLOWED_CHAT_ID;
  if (!chatId) {
    console.error('✗ ALLOWED_CHAT_ID not set in .env');
    process.exit(1);
  }

  const files = discoverIdentityFiles();
  console.log(`Discovered ${files.length} identity file(s):`);
  for (const f of files) console.log(`  • ${f.replace(HOME, '~')}`);
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN — no API calls, no DB writes.');
    return;
  }

  // Direct DB handle for pin + salience update (saveStructuredMemory does not expose these)
  const dbPath = path.join(process.cwd(), 'store', 'claudeclaw.db');
  const rawDb = new Database(dbPath);
  const pinStmt = rawDb.prepare('UPDATE memories SET pinned = 1, salience = 1.0 WHERE id = ?');

  let inserted = 0;
  let skipped = 0;
  let embedFailures = 0;

  for (const fp of files) {
    const rel = fp.replace(HOME, '~');
    try {
      const content = fs.readFileSync(fp, 'utf8').trim();
      if (content.length < 40) {
        console.log(`  ⚠  ${rel} — too short (${content.length} chars), skipping`);
        skipped++;
        continue;
      }

      const name = path.basename(fp);
      process.stdout.write(`  ⏳ ${rel} — extracting... `);
      const ext = await extractIdentity(name, content);
      if (!ext) {
        console.log('EXTRACTION FAILED');
        skipped++;
        continue;
      }

      const memoryId = saveStructuredMemory(
        chatId,
        content,
        ext.summary,
        ext.entities,
        ext.topics,
        ext.importance,
        'identity',
        'main',
      );

      // Pin it
      pinStmt.run(memoryId);

      // Embed
      try {
        const emb = await embedText(`${ext.summary} ${ext.entities.join(' ')} ${ext.topics.join(' ')}`);
        if (emb.length > 0) saveMemoryEmbedding(memoryId, emb);
      } catch (err) {
        embedFailures++;
        console.log(`embed failed (${(err as Error).message.slice(0, 60)})... `);
      }

      inserted++;
      console.log(`#${memoryId} pinned [${ext.topics.slice(0, 3).join(', ')}]`);
    } catch (err) {
      console.log(`  ✗ ${rel} — ${(err as Error).message.slice(0, 100)}`);
      skipped++;
    }
  }

  rawDb.close();

  console.log('');
  console.log(`✓ Pass 1 complete`);
  console.log(`  Inserted:        ${inserted}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log(`  Embed failures:  ${embedFailures}`);
  console.log(`  Chat ID:         ${chatId}`);
  console.log(`  Agent:           main`);
  console.log(`  Source:          identity`);
  console.log(`  Pinned:          yes (salience=1.0)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
