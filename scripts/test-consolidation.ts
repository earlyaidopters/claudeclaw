import { initDatabase } from '../src/db.js';
import { getUnconsolidatedMemories, getRecentConsolidations, getRecentMemories } from '../src/db.js';
import { runConsolidation } from '../src/memory-consolidate.js';

initDatabase();

const CHAT_ID = 'test-battle';

async function test() {
  const before = getUnconsolidatedMemories(CHAT_ID, 50);
  console.log('Unconsolidated memories:', before.length);
  console.log('Running consolidation...\n');
  await runConsolidation(CHAT_ID);

  const cons = getRecentConsolidations(CHAT_ID, 10);
  console.log('Consolidation records:', cons.length);
  for (const c of cons) {
    console.log('\n=== CONSOLIDATION ===');
    console.log('Summary:', c.summary);
    console.log('Insight:', c.insight);
    console.log('Source IDs:', c.source_ids);
  }

  const after = getUnconsolidatedMemories(CHAT_ID, 50);
  console.log('\nUnconsolidated after:', after.length);

  // Check connections
  const mems = getRecentMemories(CHAT_ID, 50);
  let withConns = 0;
  for (const m of mems) {
    const conns = JSON.parse(m.connections) as Array<{ linked_to: number; relationship: string }>;
    if (conns.length > 0) {
      withConns++;
      console.log(`Memory #${m.id} ("${m.summary.slice(0, 50)}...") linked to: ${conns.map(c => `#${c.linked_to} (${c.relationship})`).join(', ')}`);
    }
  }
  console.log('\nTotal memories with connections:', withConns);
}

test().catch(console.error);
