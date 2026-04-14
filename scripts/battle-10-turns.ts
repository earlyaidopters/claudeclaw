/**
 * 10-turn realistic conversation with each agent.
 * Mixes noise, preferences, context, corrections, follow-ups.
 * Analyzes what got stored, what got filtered, and quality of extraction.
 */
import { initDatabase } from '../src/db.js';
import { readEnvFile } from '../src/env.js';
import {
  getRecentMemories,
  getDashboardMemoryStats,
  getUnconsolidatedMemories,
  getRecentConsolidations,
  searchMemories,
} from '../src/db.js';
import { ingestConversationTurn } from '../src/memory-ingest.js';
import { runConsolidation } from '../src/memory-consolidate.js';

const env = readEnvFile(['ALLOWED_CHAT_ID']);
const CHAT_ID = env.ALLOWED_CHAT_ID || 'test';

initDatabase();

interface Turn {
  user: string;
  assistant: string;
  expectStore: boolean;
  label: string;
}

interface AgentConvo {
  agent: string;
  turns: Turn[];
}

const conversations: AgentConvo[] = [
  // ════════════════════════════════════════════════════════════════
  // MAIN BOT — general assistant, personal context, system config
  // ════════════════════════════════════════════════════════════════
  {
    agent: 'MAIN',
    turns: [
      { user: 'hey', assistant: 'What are we working on?', expectStore: false, label: 'greeting' },
      { user: 'My wife Sarah is Australian-Canadian. We live in Vancouver, BC. We have been married for 3 years.', assistant: 'Got it. Sarah, Australian-Canadian, Vancouver, 3 years married.', expectStore: true, label: 'personal/family' },
      { user: 'cool thanks', assistant: 'Anything else?', expectStore: false, label: 'ack' },
      { user: 'Rex is our Husky. He is black and white, about 4 years old, extremely high energy. We walk him twice a day minimum or he destroys things.', assistant: 'Rex sounds like a handful. Noted the twice-daily walk requirement.', expectStore: true, label: 'personal/pet' },
      { user: 'When you write code for me, never use semicolons in TypeScript. I use the no-semicolon ESLint rule across all my projects.', assistant: 'No semicolons in TypeScript. Will follow that convention.', expectStore: true, label: 'technical preference' },
      { user: 'also tabs not spaces. 2-width tabs.', assistant: 'Tabs, 2-width. Got it.', expectStore: true, label: 'technical preference 2' },
      { user: 'can you check what time it is in Bali right now', assistant: 'It is currently 2:30 AM in Bali (WITA, UTC+8).', expectStore: false, label: 'ephemeral query' },
      { user: 'I wake up at 6am EST every day. First thing I do is check Telegram, then email, then Slack. That is my morning order and I do not want it disrupted.', assistant: 'Morning routine: 6am EST, Telegram first, then email, then Slack. Will respect that order.', expectStore: true, label: 'routine/workflow' },
      { user: 'checkpoint', assistant: 'Checkpoint saved. Safe to /newchat.', expectStore: false, label: 'command' },
      { user: 'I am building ClaudeClaw as an open source project. The repo is at earlyaidopters/claudeclaw on GitHub. It is a Telegram bot powered by Claude Code that runs as a persistent service. I want it to become the reference implementation for personal AI assistants.', assistant: 'Noted. ClaudeClaw is your open-source reference implementation for personal AI assistants, living at earlyaidopters/claudeclaw.', expectStore: true, label: 'project context' },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // COMMS — email, WhatsApp, Slack, community forum, YouTube, LinkedIn
  // ════════════════════════════════════════════════════════════════
  {
    agent: 'COMMS',
    turns: [
      { user: 'check my gmail', assistant: 'You have 7 unread emails. 2 from investors, 1 from legal, 4 newsletters.', expectStore: false, label: 'ephemeral task' },
      { user: 'For investor emails, always CC sarah@example.com. She handles the financial side of investor relations.', assistant: 'Will CC Sarah on all investor emails going forward.', expectStore: true, label: 'email rule' },
      { user: 'move the newsletters', assistant: 'Moved 4 newsletters to their respective labels.', expectStore: false, label: 'action command' },
      { user: 'Alex Rivera is my closest friend in the AI space. He runs an AI agency and we collaborate on content regularly. When he messages, always prioritize his replies.', assistant: 'Noted. Alex Rivera is a close collaborator and friend. Will prioritize his messages.', expectStore: true, label: 'relationship context' },
      { user: 'draft a response to the legal email', assistant: 'Here is a draft response addressing the compliance points...', expectStore: false, label: 'action request' },
      { user: 'looks good send it', assistant: 'Sent.', expectStore: false, label: 'approval' },
      { user: 'For WhatsApp messages, split every sentence into its own message. Never send a wall of text. The only exception is tightly coupled logistics like dates and addresses.', assistant: 'Got it. One sentence per WhatsApp message, except for logistics blocks.', expectStore: true, label: 'messaging style' },
      { user: 'When replying to community posts, never use the word "wild" or any phrase that sounds like AI wrote it. My community can smell AI from a mile away and it kills credibility.', assistant: 'Understood. No AI-sounding language in community replies. Authenticity is critical.', expectStore: true, label: 'style correction' },
      { user: 'reply to that youtube comment saying thanks', assistant: 'Replied with a thank you in your style.', expectStore: false, label: 'action' },
      { user: 'Jordan Lee just joined the community. He is a senior engineer at a major AI lab. He could be very valuable for technical discussions. Keep an eye on his posts.', assistant: 'Flagged Jordan Lee as a high-value new member. Will monitor his activity.', expectStore: true, label: 'new contact' },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // OPS — calendar, billing, admin, Stripe, Gumroad
  // ════════════════════════════════════════════════════════════════
  {
    agent: 'OPS',
    turns: [
      { user: 'what meetings do I have tomorrow', assistant: 'You have 2 meetings: 10am call with Eran, 2pm investor update.', expectStore: false, label: 'calendar check' },
      { user: 'push the Eran call to 11am', assistant: 'Moved to 11am. Eran has been notified.', expectStore: false, label: 'calendar action' },
      { user: 'My Stripe account has two modes: Acme Consulting (consulting invoices, high-ticket) and CommunityHub (community subscriptions, $97/month). Never mix them.', assistant: 'Understood. Two separate Stripe contexts, never cross them.', expectStore: true, label: 'billing structure' },
      { user: 'ok', assistant: 'Anything else?', expectStore: false, label: 'ack' },
      { user: 'The online community is $97/month. We also have a $497 one-time AI Mastery product on Gumroad. Both feed into the same ecosystem but different payment rails.', assistant: 'Noted. $97/mo community forum subscription + $497 Gumroad one-time, same ecosystem, different payment systems.', expectStore: true, label: 'pricing structure' },
      { user: 'cancel my 4pm', assistant: 'Cancelled the 4pm meeting.', expectStore: false, label: 'calendar action' },
      { user: 'For any new Calendly bookings, always check if the person is already a community forum member. If they are, note it in the meeting prep. It changes how I approach the call.', assistant: 'Will cross-reference Calendly bookings with community membership for meeting prep.', expectStore: true, label: 'workflow rule' },
      { user: 'Apex Holdings is my holding company. All contractor payments and accounting go through it. IRS is the tax authority we file with.', assistant: 'Noted. Apex Holdings is the holding company, IRS for tax filings.', expectStore: true, label: 'business entity' },
      { user: 'how much did we make on Gumroad this month', assistant: 'Gumroad revenue this month: $2,485 across 5 sales of Claude Code Mastery.', expectStore: false, label: 'ephemeral query' },
      { user: 'I want a weekly revenue summary every Sunday at 6pm EST. Pull from Stripe and Gumroad, show breakdown by product and compare to last week.', assistant: 'Setting up weekly revenue summary: Sundays 6pm EST, Stripe + Gumroad, product breakdown with week-over-week comparison.', expectStore: true, label: 'recurring task preference' },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // CONTENT — YouTube, LinkedIn, carousels, writing
  // ════════════════════════════════════════════════════════════════
  {
    agent: 'CONTENT',
    turns: [
      { user: 'what videos are trending in the AI space right now', assistant: 'Top trending: agent frameworks, Claude Code workflows, MCP servers, vibe coding backlash.', expectStore: false, label: 'research query' },
      { user: 'interesting', assistant: 'Want me to dig deeper into any of those?', expectStore: false, label: 'ack' },
      { user: 'My YouTube channel is focused on showing real workflows, not tutorials. I do not do "top 10" or "beginner guide" style content. Every video must show me actually doing the thing, not just explaining it.', assistant: 'Real workflows only, no tutorial-style or listicle content. Every video shows you doing it live.', expectStore: true, label: 'content philosophy' },
      { user: 'The next video is about building an empire of Claude Code skills. I want to show how I chain skills together to do multi-step workflows that would take a normal person hours.', assistant: 'Got it. Skills empire video: demonstrate multi-step skill chaining for time compression.', expectStore: true, label: 'upcoming content' },
      { user: 'shorten that title', assistant: 'How about: "Build an Empire of AI Skills"?', expectStore: false, label: 'edit request' },
      { user: 'For LinkedIn posts, I write in a specific pattern: open with a scene or specific moment, then reveal the insight. Never open with a claim or hot take. The scene earns the right to make the point.', assistant: 'LinkedIn formula: scene-first opening, insight follows. Never lead with claims.', expectStore: true, label: 'writing style' },
      { user: 'Also on LinkedIn, no hashtags. I think hashtags look desperate and algorithmic. Let the content speak for itself.', assistant: 'No hashtags on LinkedIn. Noted.', expectStore: true, label: 'style rule' },
      { user: 'When creating carousels, use the McKinsey/Deloitte consulting aesthetic. Clean, minimal, black and white with one accent color. No gradients, no clip art.', assistant: 'Consulting aesthetic for carousels: clean, minimal, B&W with one accent. No gradients or clip art.', expectStore: true, label: 'design preference' },
      { user: 'generate 3 thumbnail ideas', assistant: 'Here are 3 thumbnail concepts for the skills empire video...', expectStore: false, label: 'action request' },
      { user: 'My filming setup: I record on a MacBook Pro M4 Max, use a Shure MV7 mic, and edit in Descript. I do not use Final Cut or Premiere. Descript is my only editing tool because I can script, record, and edit in one place.', assistant: 'Filming: MacBook Pro M4 Max, Shure MV7, Descript for everything. No Final Cut/Premiere.', expectStore: true, label: 'equipment/tools' },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // RESEARCH — deep web research, academic, competitive intel
  // ════════════════════════════════════════════════════════════════
  {
    agent: 'RESEARCH',
    turns: [
      { user: 'look up the latest on Claude 4.6 capabilities', assistant: 'Claude 4.6 (Opus) was released with 1M context, improved tool use, and better agentic behavior...', expectStore: false, label: 'research request' },
      { user: 'When benchmarking AI coding tools, I care about three things: speed of iteration, quality of first-pass code, and how well it handles large codebases. Accuracy on toy problems does not matter to me.', assistant: 'Benchmarking criteria: iteration speed, first-pass quality, large codebase handling. Not toy problem accuracy.', expectStore: true, label: 'evaluation framework' },
      { user: 'interesting, go on', assistant: 'The 1M context window allows entire repositories to be loaded...', expectStore: false, label: 'continuation' },
      { user: 'OpenClaw is a project by Tobias Lutke (Shopify CEO). It is a Claude Code fork focused on memory and local-first design. I studied it closely for the ClaudeClaw memory system. QMD is a related project by the same person for local semantic search.', assistant: 'Noted. OpenClaw by Tobias Lutke, Claude Code fork with memory focus. QMD for local semantic search. Both influenced ClaudeClaw.', expectStore: true, label: 'competitive intel' },
      { user: 'save that', assistant: 'Saved.', expectStore: false, label: 'action' },
      { user: 'Google released an always-on memory agent reference implementation using Gemini. It uses three agents: ingest, consolidate, query. I used that architecture as the basis for ClaudeClaw memory v2.', assistant: 'Noted. Google always-on memory agent with 3-agent architecture influenced your memory v2 design.', expectStore: true, label: 'architecture reference' },
      { user: 'When you find research papers, always include the arXiv link if available. I want to be able to read the full paper, not just your summary.', assistant: 'Will include arXiv links for all papers.', expectStore: true, label: 'output preference' },
      { user: 'yeah', assistant: 'Anything else to look into?', expectStore: false, label: 'ack' },
      { user: 'The MCP (Model Context Protocol) ecosystem is something I track closely. It is how Claude Code connects to external tools. I believe MCP servers will be to AI what APIs were to web development. Track any new interesting MCP servers that come out.', assistant: 'Tracking MCP ecosystem. Will flag new interesting MCP servers. Noted your analogy to APIs.', expectStore: true, label: 'technology thesis' },
      { user: 'For trend research, always cross-reference Google Trends rising queries with YouTube autocomplete suggestions. That combination catches emerging topics before they peak.', assistant: 'Trend methodology: Google Trends rising queries + YouTube autocomplete for early signal detection.', expectStore: true, label: 'research methodology' },
    ],
  },
];

// ── Run ─────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  10-TURN CONVERSATION TEST — ALL 5 AGENTS      ║');
  console.log('╚═══════════════════════════════════════════════╝');

  const agentResults: Array<{ agent: string; pass: number; fail: number; stored: number; skipped: number; details: string[] }> = [];

  for (const convo of conversations) {
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`  ${convo.agent} AGENT — 10 turns`);
    console.log('═'.repeat(60));

    let pass = 0;
    let fail = 0;
    let stored = 0;
    let skipped = 0;
    const details: string[] = [];

    for (let i = 0; i < convo.turns.length; i++) {
      const t = convo.turns[i];
      const result = await ingestConversationTurn(CHAT_ID, t.user, t.assistant);
      const expected = t.expectStore;
      const ok = result === expected;

      if (result) stored++;
      else skipped++;
      if (ok) pass++;
      else fail++;

      const icon = ok ? '✓' : '✗';
      const action = result ? 'STORED' : 'SKIP  ';
      const line = `  ${icon} Turn ${(i + 1).toString().padStart(2)}  ${action}  [${t.label}]  "${t.user.slice(0, 55)}${t.user.length > 55 ? '...' : ''}"`;
      console.log(line);
      if (!ok) {
        const detail = `    ↳ Expected ${expected ? 'STORE' : 'SKIP'}, got ${result ? 'STORE' : 'SKIP'}`;
        console.log(detail);
        details.push(`${t.label}: expected ${expected ? 'STORE' : 'SKIP'}, got ${result ? 'STORE' : 'SKIP'}`);
      }
    }

    console.log(`\n  Result: ${pass}/10 correct | ${stored} stored, ${skipped} skipped`);
    agentResults.push({ agent: convo.agent, pass, fail, stored, skipped, details });
  }

  // ── Overall summary ───────────────────────────────────────────

  console.log('\n\n' + '═'.repeat(60));
  console.log('  OVERALL RESULTS');
  console.log('═'.repeat(60));

  let totalPass = 0;
  let totalFail = 0;

  for (const r of agentResults) {
    totalPass += r.pass;
    totalFail += r.fail;
    const pct = ((r.pass / 10) * 100).toFixed(0);
    const status = r.fail === 0 ? '✓' : '✗';
    console.log(`  ${status} ${r.agent.padEnd(10)} ${r.pass}/10 (${pct}%) — ${r.stored} stored, ${r.skipped} skipped`);
    for (const d of r.details) {
      console.log(`      ↳ ${d}`);
    }
  }

  const totalPct = ((totalPass / 50) * 100).toFixed(1);
  console.log(`\n  TOTAL: ${totalPass}/50 (${totalPct}%)`);

  // ── Memory quality analysis ───────────────────────────────────

  const allMems = getRecentMemories(CHAT_ID, 100);
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  MEMORY QUALITY ANALYSIS');
  console.log('═'.repeat(60));
  console.log(`  Total memories stored: ${allMems.length}`);

  // Importance distribution
  const impBuckets: Record<string, number> = { 'critical (0.8-1.0)': 0, 'moderate (0.5-0.7)': 0, 'low (0.2-0.4)': 0 };
  for (const m of allMems) {
    if (m.importance >= 0.8) impBuckets['critical (0.8-1.0)']++;
    else if (m.importance >= 0.5) impBuckets['moderate (0.5-0.7)']++;
    else impBuckets['low (0.2-0.4)']++;
  }
  console.log('\n  Importance distribution:');
  for (const [k, v] of Object.entries(impBuckets)) {
    console.log(`    ${k}: ${v}`);
  }

  // Topic frequency
  const topicCounts: Record<string, number> = {};
  for (const m of allMems) {
    const topics = JSON.parse(m.topics) as string[];
    for (const t of topics) {
      const normalized = t.toLowerCase();
      topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
    }
  }
  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\n  Top topics:');
  for (const [topic, count] of sortedTopics) {
    console.log(`    ${topic}: ${count}`);
  }

  // Entity frequency
  const entityCounts: Record<string, number> = {};
  for (const m of allMems) {
    const entities = JSON.parse(m.entities) as string[];
    for (const e of entities) {
      entityCounts[e] = (entityCounts[e] || 0) + 1;
    }
  }
  const sortedEntities = Object.entries(entityCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\n  Top entities:');
  for (const [entity, count] of sortedEntities) {
    console.log(`    ${entity}: ${count}`);
  }

  // ── All stored memories ───────────────────────────────────────

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  ALL STORED MEMORIES');
  console.log('═'.repeat(60));
  for (const m of allMems.reverse()) {
    const topics = JSON.parse(m.topics) as string[];
    const entities = JSON.parse(m.entities) as string[];
    console.log(`\n  [${m.importance.toFixed(2)}] ${m.summary}`);
    if (topics.length) console.log(`        topics: ${topics.join(', ')}`);
    if (entities.length) console.log(`        entities: ${entities.join(', ')}`);
  }

  // ── Consolidation ─────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  CONSOLIDATION');
  console.log('═'.repeat(60));

  const uncBefore = getUnconsolidatedMemories(CHAT_ID, 100);
  console.log(`  Running consolidation on ${uncBefore.length} memories...`);
  await runConsolidation(CHAT_ID);

  const cons = getRecentConsolidations(CHAT_ID, 10);
  for (const c of cons) {
    console.log(`\n  INSIGHT: ${c.insight}`);
    console.log(`  SUMMARY: ${c.summary}`);
  }

  const uncAfter = getUnconsolidatedMemories(CHAT_ID, 100);
  console.log(`\n  Consolidated: ${uncBefore.length - uncAfter.length} memories`);

  // ── Retrieval test ────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  RETRIEVAL TEST — can the system find what it stored?');
  console.log('═'.repeat(60));

  const queries = [
    'What is the user\'s morning routine?',
    'Who is Sarah?',
    'How does the user feel about OpenAI?',
    'What is ClaudeClaw?',
    'LinkedIn writing style',
    'Stripe and Gumroad pricing',
    'filming equipment',
    'MCP servers',
    'Alex Rivera',
    'TypeScript preferences',
  ];

  for (const q of queries) {
    const results = searchMemories(CHAT_ID, q, 3);
    console.log(`\n  Q: "${q}"`);
    if (results.length === 0) {
      console.log('    (no results)');
    } else {
      for (const r of results) {
        console.log(`    → [${r.importance.toFixed(1)}] ${r.summary.slice(0, 90)}${r.summary.length > 90 ? '...' : ''}`);
      }
    }
  }

  console.log('\n\n╔═══════════════════════════════════════════════╗');
  console.log('║  BATTLE TEST COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
}

run().catch(console.error);
