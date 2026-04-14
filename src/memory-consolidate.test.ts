import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./gemini.js', () => ({
  generateContent: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

vi.mock('./db.js', () => ({
  getUnconsolidatedMemories: vi.fn(),
  saveConsolidation: vi.fn(() => 1),
  saveConsolidationEmbedding: vi.fn(),
  supersedeMemory: vi.fn(),
  markMemoriesConsolidated: vi.fn(),
  updateMemoryConnections: vi.fn(),
}));

vi.mock('./embeddings.js', () => ({
  embedText: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { runConsolidation } from './memory-consolidate.js';
import { generateContent, parseJsonResponse } from './gemini.js';
import {
  getUnconsolidatedMemories,
  saveConsolidation,
  markMemoriesConsolidated,
  updateMemoryConnections,
} from './db.js';

const mockGetUnconsolidated = vi.mocked(getUnconsolidatedMemories);
const mockGenerateContent = vi.mocked(generateContent);
const mockParseJson = vi.mocked(parseJsonResponse);
const mockSaveConsolidation = vi.mocked(saveConsolidation);
const mockMarkConsolidated = vi.mocked(markMemoriesConsolidated);
const mockUpdateConnections = vi.mocked(updateMemoryConnections);

function makeMemory(id: number, summary: string) {
  return {
    id,
    chat_id: 'chat1',
    source: 'conversation',
    agent_id: 'main',
    raw_text: 'raw',
    summary,
    entities: '[]',
    topics: '[]',
    connections: '[]',
    importance: 0.6,
    salience: 1.0,
    consolidated: 0,
    pinned: 0,
    embedding: null,
    created_at: Math.floor(Date.now() / 1000) - 3600,
    accessed_at: Math.floor(Date.now() / 1000) - 3600,
  };
}

describe('runConsolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Skip conditions ───────────────────────────────────────────────

  it('skips when fewer than 2 unconsolidated memories', async () => {
    mockGetUnconsolidated.mockReturnValue([makeMemory(1, 'only one')]);
    await runConsolidation('chat1');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockSaveConsolidation).not.toHaveBeenCalled();
  });

  it('skips when zero unconsolidated memories', async () => {
    mockGetUnconsolidated.mockReturnValue([]);
    await runConsolidation('chat1');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // ── Successful consolidation ──────────────────────────────────────

  it('consolidates 2+ memories and saves the result', async () => {
    const memories = [
      makeMemory(10, 'User prefers morning email triage'),
      makeMemory(20, 'User checks Slack after email'),
      makeMemory(30, 'User blocks 9-10am for admin tasks'),
    ];
    mockGetUnconsolidated.mockReturnValue(memories);

    const consolidationResult = {
      summary: 'User has a structured morning routine: email triage, then Slack, with a dedicated 9-10am admin block.',
      insight: 'User organizes mornings around a clear priority order: email first, Slack second, admin last.',
      connections: [
        { from_id: 10, to_id: 20, relationship: 'sequential workflow' },
        { from_id: 20, to_id: 30, relationship: 'part of morning routine' },
      ],
    };
    mockGenerateContent.mockResolvedValue(JSON.stringify(consolidationResult));
    mockParseJson.mockReturnValue(consolidationResult);

    await runConsolidation('chat1');

    // Should save consolidation record
    expect(mockSaveConsolidation).toHaveBeenCalledWith(
      'chat1',
      [10, 20, 30],
      consolidationResult.summary,
      consolidationResult.insight,
    );

    // Should wire bidirectional connections
    expect(mockUpdateConnections).toHaveBeenCalledWith(10, [
      { linked_to: 20, relationship: 'sequential workflow' },
    ]);
    expect(mockUpdateConnections).toHaveBeenCalledWith(20, [
      { linked_to: 10, relationship: 'sequential workflow' },
    ]);
    expect(mockUpdateConnections).toHaveBeenCalledWith(20, [
      { linked_to: 30, relationship: 'part of morning routine' },
    ]);
    expect(mockUpdateConnections).toHaveBeenCalledWith(30, [
      { linked_to: 20, relationship: 'part of morning routine' },
    ]);

    // Should mark all source memories as consolidated
    expect(mockMarkConsolidated).toHaveBeenCalledWith([10, 20, 30]);
  });

  // ── Connection filtering ──────────────────────────────────────────

  it('ignores connections with IDs outside the source set', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);

    const result = {
      summary: 'summary',
      insight: 'insight',
      connections: [
        { from_id: 10, to_id: 999, relationship: 'invalid target' }, // 999 not in source
        { from_id: 888, to_id: 20, relationship: 'invalid source' }, // 888 not in source
        { from_id: 10, to_id: 20, relationship: 'valid connection' },
      ],
    };
    mockGenerateContent.mockResolvedValue(JSON.stringify(result));
    mockParseJson.mockReturnValue(result);

    await runConsolidation('chat1');

    // Only the valid connection (10 -> 20) should be wired
    expect(mockUpdateConnections).toHaveBeenCalledTimes(2); // bidirectional for 1 connection
    expect(mockUpdateConnections).toHaveBeenCalledWith(10, [
      { linked_to: 20, relationship: 'valid connection' },
    ]);
    expect(mockUpdateConnections).toHaveBeenCalledWith(20, [
      { linked_to: 10, relationship: 'valid connection' },
    ]);
  });

  it('handles empty connections array', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);

    const result = {
      summary: 'These cover different topics',
      insight: 'No clear pattern between these memories',
      connections: [],
    };
    mockGenerateContent.mockResolvedValue(JSON.stringify(result));
    mockParseJson.mockReturnValue(result);

    await runConsolidation('chat1');

    expect(mockSaveConsolidation).toHaveBeenCalled();
    expect(mockUpdateConnections).not.toHaveBeenCalled();
    expect(mockMarkConsolidated).toHaveBeenCalledWith([10, 20]);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('handles Gemini API failure gracefully', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);
    mockGenerateContent.mockRejectedValue(new Error('API timeout'));

    await expect(runConsolidation('chat1')).resolves.not.toThrow();
    expect(mockSaveConsolidation).not.toHaveBeenCalled();
    expect(mockMarkConsolidated).not.toHaveBeenCalled();
  });

  it('handles invalid Gemini response (null parse)', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);
    mockGenerateContent.mockResolvedValue('garbage');
    mockParseJson.mockReturnValue(null);

    await runConsolidation('chat1');

    expect(mockSaveConsolidation).not.toHaveBeenCalled();
    expect(mockMarkConsolidated).not.toHaveBeenCalled();
  });

  it('handles missing summary in response', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);

    const result = { summary: '', insight: 'insight', connections: [] };
    mockGenerateContent.mockResolvedValue(JSON.stringify(result));
    mockParseJson.mockReturnValue(result);

    await runConsolidation('chat1');
    expect(mockSaveConsolidation).not.toHaveBeenCalled();
  });

  it('handles missing insight in response', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);

    const result = { summary: 'summary', insight: '', connections: [] };
    mockGenerateContent.mockResolvedValue(JSON.stringify(result));
    mockParseJson.mockReturnValue(result);

    await runConsolidation('chat1');
    expect(mockSaveConsolidation).not.toHaveBeenCalled();
  });

  // ── Overlap guard ─────────────────────────────────────────────────

  it('does not run concurrently (overlap guard)', async () => {
    const memories = [makeMemory(10, 'mem1'), makeMemory(20, 'mem2')];
    mockGetUnconsolidated.mockReturnValue(memories);

    // Make generateContent hang
    let resolveFirst!: (val: string) => void;
    const firstPromise = new Promise<string>((resolve) => { resolveFirst = resolve; });
    mockGenerateContent.mockReturnValueOnce(firstPromise);

    const result = {
      summary: 'summary',
      insight: 'insight',
      connections: [],
    };

    // Start first consolidation (will block on generateContent)
    const run1 = runConsolidation('chat1');

    // Start second immediately (should be skipped due to guard)
    mockGetUnconsolidated.mockReturnValue(memories);
    const run2 = runConsolidation('chat1');

    // Complete first
    resolveFirst(JSON.stringify(result));
    mockParseJson.mockReturnValue(result);

    await run1;
    await run2;

    // generateContent should only have been called once (the second run was skipped)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
