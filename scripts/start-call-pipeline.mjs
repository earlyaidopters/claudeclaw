#!/usr/bin/env node
/**
 * Start-Call-Pipeline wrapper
 *
 * Tiny bridge between the clawd call-transcript worker (.mjs) and the
 * compiled claudeclaw call-pipeline orchestrator (TS → dist/). The
 * worker spawns this script after a transcript note is written; this
 * script imports the orchestrator and kicks off Stage A.
 *
 * Why a wrapper: the worker is JS in a different repo. It can't import
 * TS sources directly, and building the full prompt + acceptance
 * string in JS would duplicate logic. Routing through this wrapper
 * keeps the prompt-building logic single-source-of-truth in
 * src/call-pipeline/stage-prompts.ts.
 *
 * Usage:
 *   node scripts/start-call-pipeline.mjs \
 *     --call-msg-id <id> --contact-id <id> [--conv-id <id>]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLAUDECLAW_ROOT = path.resolve(__dirname, '..');

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] ?? null : null;
}

const callMsgId = getArg('--call-msg-id');
const contactId = getArg('--contact-id');
const ghlConvId = getArg('--conv-id');

if (!callMsgId || !contactId) {
  console.error(
    'Usage: start-call-pipeline.mjs --call-msg-id <id> --contact-id <id> [--conv-id <id>]',
  );
  process.exit(1);
}

// cwd must be claudeclaw so config.ts reads the right .env
process.chdir(CLAUDECLAW_ROOT);

const { initDatabase } = await import(path.join(CLAUDECLAW_ROOT, 'dist/db.js'));
const { startPipeline } = await import(
  path.join(CLAUDECLAW_ROOT, 'dist/call-pipeline/orchestrator.js')
);

initDatabase();

const result = startPipeline({ callMsgId, contactId, ghlConvId });
console.log(JSON.stringify(result));
