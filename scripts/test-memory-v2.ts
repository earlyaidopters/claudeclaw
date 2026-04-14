/**
 * Battle test for Memory V2 ingestion pipeline.
 * Sends realistic conversation pairs through the ingest function
 * and reports what gets stored vs filtered.
 */
import { initDatabase } from '../src/db.js';
import { getRecentMemories, getRecentConsolidations } from '../src/db.js';
import { ingestConversationTurn } from '../src/memory-ingest.js';

// Initialize the real database
initDatabase();

const CHAT_ID = 'test-battle';

interface TestCase {
  label: string;
  shouldStore: boolean;
  user: string;
  assistant: string;
}

const testCases: TestCase[] = [
  // ── SHOULD BE SKIPPED (noise) ─────────────────────────────────
  {
    label: 'Short acknowledgment',
    shouldStore: false,
    user: 'ok sounds good',
    assistant: 'Great, I will proceed.',
  },
  {
    label: 'Simple yes',
    shouldStore: false,
    user: 'yes yes yes do it',
    assistant: 'Done.',
  },
  {
    label: 'Send command',
    shouldStore: false,
    user: 'send it please, but add a one minute delay',
    assistant: 'Sent with a 1-minute delay.',
  },
  {
    label: 'Ephemeral task: check email',
    shouldStore: false,
    user: 'check my gmail inbox for anything urgent',
    assistant: 'You have 3 unread emails. One from your accountant about tax filing.',
  },
  {
    label: 'Slash command',
    shouldStore: false,
    user: '/chatid',
    assistant: 'Your chat ID is 12345.',
  },
  {
    label: 'Greeting',
    shouldStore: false,
    user: 'hey whats up good morning',
    assistant: 'Morning. What are we working on?',
  },
  {
    label: 'Draft request (no preference info)',
    shouldStore: false,
    user: 'draft a response to that email please',
    assistant: 'Here is a draft response...',
  },
  {
    label: 'Typo correction',
    shouldStore: false,
    user: 'actually change "recieve" to "receive" in line 3',
    assistant: 'Fixed the typo.',
  },

  // ── SHOULD BE STORED (meaningful) ─────────────────────────────
  {
    label: 'Personal preference (dark mode)',
    shouldStore: true,
    user: 'I always want dark mode enabled in all my apps and tools. Light mode hurts my eyes.',
    assistant: 'Got it, I will remember your dark mode preference.',
  },
  {
    label: 'Relationship context',
    shouldStore: true,
    user: 'My wife Sarah and I are planning a trip to Japan in October. She has been learning Japanese for 2 years.',
    assistant: 'That sounds amazing. October is beautiful in Japan.',
  },
  {
    label: 'Business rule',
    shouldStore: true,
    user: 'For any community forum posts, always respond within 24 hours. If I miss one, flag it in our next morning briefing.',
    assistant: 'Understood. I will monitor community forum and flag any posts older than 24 hours without a response.',
  },
  {
    label: 'Behavioral correction (feedback)',
    shouldStore: true,
    user: 'Stop summarizing what you just did at the end of every response. I can read the diff. Just do the thing and move on.',
    assistant: 'Noted.',
  },
  {
    label: 'Technical preference',
    shouldStore: true,
    user: 'When writing TypeScript, always use explicit return types on exported functions. No implicit any.',
    assistant: 'Will do. Explicit return types on all exports, strict no-any.',
  },
  {
    label: 'Project context',
    shouldStore: true,
    user: 'The ClaudeClaw memory overhaul is the priority this week. After that we need to prep the YouTube video about Claude Code tricks.',
    assistant: 'Got it. Memory overhaul first, then YouTube prep.',
  },
  {
    label: 'Contact/relationship info',
    shouldStore: true,
    user: 'Eran is my co-founder on ClaudeClaw. He handles the SDK integration side. Rolland does the scheduler work. Both are active contributors on GitHub.',
    assistant: 'Noted the team structure.',
  },
  {
    label: 'Workflow preference',
    shouldStore: true,
    user: 'I want my email triaged every morning by 9am EST. Flag anything from investors or legal as urgent. Everything else can wait.',
    assistant: 'I will set up a 9am email triage with urgent flags for investor and legal emails.',
  },
  {
    label: 'Identity/role info',
    shouldStore: true,
    user: 'I run two businesses: Acme Community (an online community for builders) and Acme Consulting (AI consulting for enterprises). Both are growing fast.',
    assistant: 'Got it. Two businesses, community and consulting.',
  },
  {
    label: 'Strong opinion/decision',
    shouldStore: true,
    user: 'We are NOT using OpenAI for anything in our stack. Everything runs on Claude or Gemini. This is a hard rule.',
    assistant: 'Understood. Claude and Gemini only, no OpenAI.',
  },
  {
    label: 'Voice message with context (long)',
    shouldStore: true,
    user: '[Voice transcribed]: So I have been thinking about the retreat in Bali. The venue needs to have strong WiFi because we will be running live demos. Budget is around 50k for the whole thing. I want it in November, probably the second week. Sarah is helping with logistics on the ground.',
    assistant: 'I have noted the Bali retreat requirements: strong WiFi, 50k budget, second week of November, Sarah on logistics.',
  },
];

async function runBattleTest() {
  console.log('\n=== MEMORY V2 BATTLE TEST ===\n');
  console.log(`Running ${testCases.length} test cases through the Gemini ingest pipeline.\n`);

  let correct = 0;
  let incorrect = 0;
  const results: Array<{ label: string; expected: string; actual: string; pass: boolean }> = [];

  for (const tc of testCases) {
    const stored = await ingestConversationTurn(CHAT_ID, tc.user, tc.assistant);
    const expected = tc.shouldStore ? 'STORE' : 'SKIP';
    const actual = stored ? 'STORE' : 'SKIP';
    const pass = expected === actual;

    if (pass) correct++;
    else incorrect++;

    const icon = pass ? '  PASS' : '  FAIL';
    console.log(`${icon}  [${expected.padEnd(5)}] ${tc.label}`);
    if (!pass) {
      console.log(`         Expected: ${expected}, Got: ${actual}`);
      console.log(`         User msg: "${tc.user.slice(0, 60)}..."`);
    }

    results.push({ label: tc.label, expected, actual, pass });
  }

  console.log(`\n--- Results ---`);
  console.log(`Total: ${testCases.length} | Pass: ${correct} | Fail: ${incorrect}`);
  console.log(`Accuracy: ${((correct / testCases.length) * 100).toFixed(1)}%\n`);

  // Now check what actually got stored
  const stored = getRecentMemories(CHAT_ID, 50);
  console.log(`--- Stored Memories (${stored.length}) ---`);
  for (const m of stored) {
    const entities = JSON.parse(m.entities);
    const topics = JSON.parse(m.topics);
    console.log(`  [${m.importance.toFixed(2)}] ${m.summary}`);
    if (entities.length > 0) console.log(`         entities: ${entities.join(', ')}`);
    if (topics.length > 0) console.log(`         topics: ${topics.join(', ')}`);
  }

  console.log('\n=== BATTLE TEST COMPLETE ===\n');
}

runBattleTest().catch(console.error);
