import { initDatabase } from '../src/db.js';
import { searchMemories } from '../src/db.js';
import { embedText } from '../src/embeddings.js';
import { readEnvFile } from '../src/env.js';

const env = readEnvFile(['ALLOWED_CHAT_ID']);
const CHAT_ID = env.ALLOWED_CHAT_ID || '';

initDatabase();

const queries = [
  "How does the user feel about OpenAI?",
  "What is the user's morning routine?",
  "Who is Sarah?",
  "What tools does the user use to edit videos?",
  "How should I write LinkedIn posts?",
  "Tell me about the community forum pricing",
  "What are the user's coding conventions?",
];

async function run() {
  console.log('\n=== SEMANTIC SEARCH TEST (with embeddings) ===\n');

  for (const q of queries) {
    const embedding = await embedText(q);
    const results = searchMemories(CHAT_ID, q, 3, embedding);
    console.log(`Q: "${q}"`);
    if (results.length === 0) {
      console.log('  (no results)\n');
    } else {
      for (const r of results) {
        console.log(`  -> [${r.importance.toFixed(1)}] ${r.summary.slice(0, 100)}`);
      }
      console.log();
    }
  }
}

run().catch(console.error);
