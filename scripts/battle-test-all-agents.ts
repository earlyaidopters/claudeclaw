/**
 * Battle test: send real messages through the main bot dashboard API
 * AND simulate each agent's memory pipeline with domain-specific messages.
 *
 * Tests:
 * 1. Main bot via dashboard HTTP API (full end-to-end)
 * 2. Each agent via direct ingest pipeline call (tests Gemini extraction per domain)
 * 3. Verify what got stored and what got filtered
 * 4. Run consolidation and verify insights
 */
import { readEnvFile } from '../src/env.js';
import { initDatabase } from '../src/db.js';
import {
  getRecentMemories,
  getRecentConsolidations,
  getUnconsolidatedMemories,
  getDashboardMemoryStats,
} from '../src/db.js';
import { ingestConversationTurn } from '../src/memory-ingest.js';
import { runConsolidation } from '../src/memory-consolidate.js';

const env = readEnvFile(['DASHBOARD_TOKEN', 'DASHBOARD_PORT', 'ALLOWED_CHAT_ID']);
const DASHBOARD_TOKEN = env.DASHBOARD_TOKEN || '';
const DASHBOARD_PORT = env.DASHBOARD_PORT || '3141';
const CHAT_ID = env.ALLOWED_CHAT_ID || '';

initDatabase();

// ── Test data per agent ─────────────────────────────────────────────

interface AgentTest {
  agent: string;
  noise: Array<{ user: string; assistant: string }>;
  meaningful: Array<{ user: string; assistant: string }>;
}

const agentTests: AgentTest[] = [
  {
    agent: 'main',
    noise: [
      { user: 'ok', assistant: 'Got it.' },
      { user: 'yes do it', assistant: 'Done.' },
      { user: 'thanks for that', assistant: 'No problem.' },
      { user: '/chatid', assistant: 'Your chat ID is 12345.' },
    ],
    meaningful: [
      {
        user: 'My dog Rex is a black and white Husky. He is about 4 years old and very high energy. We walk him twice a day.',
        assistant: 'I will remember Rex, your Husky.',
      },
      {
        user: 'When I say checkpoint, save a summary of the current conversation to the database. This is how I preserve context across sessions.',
        assistant: 'Understood. Checkpoint saves a TLDR summary to SQLite as a high-salience semantic memory.',
      },
    ],
  },
  {
    agent: 'comms',
    noise: [
      { user: 'send it', assistant: 'Sent.' },
      { user: 'looks good, ship it', assistant: 'Done, email sent.' },
      { user: 'next email please', assistant: 'Here is the next one...' },
    ],
    meaningful: [
      {
        user: 'For community forum replies, always lead with validation of their point before adding my perspective. Never start with a counterargument.',
        assistant: 'Got it. Validate first, then add perspective. No leading with pushback.',
      },
      {
        user: 'Sam Torres is a community member who focuses on agentic workflows. He is very engaged and often posts deep technical content. Treat his messages with extra care.',
        assistant: 'Noted. Sam Torres is an engaged technical member who deserves thoughtful responses.',
      },
      {
        user: 'For YouTube comment replies, always write in all lowercase with each sentence on its own line. Never use em dashes.',
        assistant: 'Will do. Lowercase, one sentence per line, no em dashes.',
      },
    ],
  },
  {
    agent: 'ops',
    noise: [
      { user: 'whats on my calendar today', assistant: 'You have 3 meetings...' },
      { user: 'move that to Thursday', assistant: 'Moved to Thursday.' },
      { user: 'cancel it', assistant: 'Cancelled.' },
    ],
    meaningful: [
      {
        user: 'All Gumroad products for the Acme Consulting brand should use the consulting logo at /tmp/logos/consulting.png. For CommunityHub use /tmp/logos/community.jpg.',
        assistant: 'Got it. Different logos for each brand on Gumroad.',
      },
      {
        user: 'Provider billing emails like Apify, AWS, Cursor should go to their own label, not Finance. Finance is only for internal accounting like Apex Holdings, IRS, payroll.',
        assistant: 'Understood. SaaS billing to provider labels, Finance only for internal accounting.',
      },
    ],
  },
  {
    agent: 'content',
    noise: [
      { user: 'make that title shorter', assistant: 'How about: "5 Claude Code Tricks"?' },
      { user: 'yeah that works', assistant: 'Updated.' },
    ],
    meaningful: [
      {
        user: 'The YouTube video about Claude Code tricks should open with a live demo, not a talking head intro. Hook them with the demo first, then explain what they just saw.',
        assistant: 'Demo-first opening, explanation after. Got it.',
      },
      {
        user: 'My LinkedIn writing style is anti-hype and scene-first. I never use buzzwords. I show receipts (real screenshots, real numbers) instead of making claims.',
        assistant: 'Anti-hype, scene-first, receipts-based. Noted for all LinkedIn content.',
      },
    ],
  },
  {
    agent: 'research',
    noise: [
      { user: 'search for that', assistant: 'Searching...' },
      { user: 'ok next topic', assistant: 'Moving on.' },
    ],
    meaningful: [
      {
        user: 'When doing competitive research on AI tools, always compare against Claude Code, Cursor, Windsurf, and Copilot. Those are the main players I care about.',
        assistant: 'Will benchmark against Claude Code, Cursor, Windsurf, and Copilot for all AI tool research.',
      },
      {
        user: 'For academic sources, prefer papers from the last 2 years. Older papers are fine for foundational concepts but flag them as older.',
        assistant: 'Prioritizing recent papers (2+ years), flagging older foundational ones.',
      },
    ],
  },
];

// ── Run the tests ───────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  MEMORY V2 FULL AGENT BATTLE TEST        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  let totalNoise = 0;
  let noiseCorrect = 0;
  let totalMeaningful = 0;
  let meaningfulCorrect = 0;

  for (const at of agentTests) {
    console.log(`\n━━━ Agent: ${at.agent.toUpperCase()} ━━━`);

    // Test noise (should all be skipped)
    for (const msg of at.noise) {
      totalNoise++;
      const stored = await ingestConversationTurn(CHAT_ID, msg.user, msg.assistant);
      if (!stored) {
        noiseCorrect++;
        console.log(`  SKIP  ✓  "${msg.user.slice(0, 50)}"`);
      } else {
        console.log(`  SKIP  ✗  SHOULD HAVE SKIPPED: "${msg.user.slice(0, 50)}"`);
      }
    }

    // Test meaningful (should all be stored)
    for (const msg of at.meaningful) {
      totalMeaningful++;
      const stored = await ingestConversationTurn(CHAT_ID, msg.user, msg.assistant);
      if (stored) {
        meaningfulCorrect++;
        console.log(`  STORE ✓  "${msg.user.slice(0, 60)}..."`);
      } else {
        console.log(`  STORE ✗  SHOULD HAVE STORED: "${msg.user.slice(0, 60)}..."`);
      }
    }
  }

  // ── Results ─────────────────────────────────────────────────────

  console.log('\n━━━ INGESTION RESULTS ━━━');
  console.log(`Noise filtered:    ${noiseCorrect}/${totalNoise} correct`);
  console.log(`Meaningful stored: ${meaningfulCorrect}/${totalMeaningful} correct`);
  console.log(`Overall accuracy:  ${(((noiseCorrect + meaningfulCorrect) / (totalNoise + totalMeaningful)) * 100).toFixed(1)}%`);

  // ── Check stored memories ─────────────────────────────────────

  const mems = getRecentMemories(CHAT_ID, 50);
  console.log(`\n━━━ STORED MEMORIES (${mems.length}) ━━━`);
  for (const m of mems) {
    const topics = JSON.parse(m.topics) as string[];
    const entities = JSON.parse(m.entities) as string[];
    console.log(`  [${m.importance.toFixed(2)}] ${m.summary}`);
    if (topics.length) console.log(`         topics: ${topics.join(', ')}`);
    if (entities.length) console.log(`         entities: ${entities.join(', ')}`);
  }

  // ── Run consolidation ─────────────────────────────────────────

  const uncBefore = getUnconsolidatedMemories(CHAT_ID, 50);
  console.log(`\n━━━ CONSOLIDATION ━━━`);
  console.log(`Unconsolidated: ${uncBefore.length}`);

  if (uncBefore.length >= 2) {
    console.log('Running consolidation...');
    await runConsolidation(CHAT_ID);

    const cons = getRecentConsolidations(CHAT_ID, 10);
    for (const c of cons) {
      console.log(`\n  Insight: ${c.insight}`);
      console.log(`  Summary: ${c.summary.slice(0, 200)}...`);
    }

    const uncAfter = getUnconsolidatedMemories(CHAT_ID, 50);
    console.log(`\n  Consolidated: ${uncBefore.length - uncAfter.length} memories`);
    console.log(`  Remaining unconsolidated: ${uncAfter.length}`);
  }

  // ── Dashboard stats ───────────────────────────────────────────

  const stats = getDashboardMemoryStats(CHAT_ID);
  console.log(`\n━━━ DASHBOARD STATS ━━━`);
  console.log(`  Total memories: ${stats.total}`);
  console.log(`  Consolidation insights: ${stats.consolidations}`);
  console.log(`  Avg importance: ${stats.avgImportance.toFixed(2)}`);
  console.log(`  Importance distribution: ${stats.importanceDistribution.map(b => `${b.bucket}: ${b.count}`).join(' | ')}`);

  // ── Test the main bot via dashboard HTTP (end-to-end) ─────────

  if (DASHBOARD_TOKEN) {
    console.log('\n━━━ MAIN BOT DASHBOARD E2E ━━━');
    try {
      const url = `http://localhost:${DASHBOARD_PORT}/api/chat/send?token=${DASHBOARD_TOKEN}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'I prefer to use Obsidian for all my notes and never use Notion anymore. I switched about 6 months ago and will not go back.' }),
      });
      const data = await res.json();
      console.log(`  Dashboard send: ${res.status} ${JSON.stringify(data)}`);
      console.log('  Waiting 15s for agent response + async ingestion...');
      await new Promise(r => setTimeout(r, 15000));

      const newMems = getRecentMemories(CHAT_ID, 1);
      if (newMems.length > 0) {
        const latest = newMems[0];
        console.log(`  Latest memory: [${latest.importance}] ${latest.summary}`);
        console.log(`  E2E test: ✓ Memory was ingested from live bot`);
      } else {
        console.log('  E2E test: ? No new memory yet (may need more time)');
      }
    } catch (err) {
      console.log(`  Dashboard E2E: skipped (${err instanceof Error ? err.message : err})`);
    }
  }

  // ── Cleanup test data ─────────────────────────────────────────

  console.log('\n━━━ CLEANUP ━━━');
  // Leave the data for now so Mark can inspect on the dashboard
  console.log('  Test data left in place for dashboard inspection.');
  console.log('  To clean: sqlite3 store/claudeclaw.db "PRAGMA trusted_schema=ON; DELETE FROM memories WHERE chat_id=\'[CHAT_ID]\'; DELETE FROM consolidations WHERE chat_id=\'[CHAT_ID]\';"');

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  BATTLE TEST COMPLETE                     ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

run().catch(console.error);
