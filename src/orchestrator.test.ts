/**
 * Tests for the cross-agent orchestrator: parseDelegation, initOrchestrator,
 * getAvailableAgents, delegateToAgent.
 *
 * Heavy deps (runAgent, DB, memory, fs) are mocked so we exercise the
 * orchestration logic in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be declared BEFORE importing the module under test.
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./agent-config.js', () => ({
  listAgentIds: vi.fn(),
  loadAgentConfig: vi.fn(),
  resolveAgentClaudeMd: vi.fn(() => null),
}));

vi.mock('./agent.js', () => ({
  runAgent: vi.fn(),
}));

vi.mock('./db.js', () => ({
  logToHiveMind: vi.fn(),
  createInterAgentTask: vi.fn(),
  completeInterAgentTask: vi.fn(),
}));

vi.mock('./memory.js', () => ({
  buildMemoryContext: vi.fn(async () => ({ contextText: '' })),
}));

vi.mock('./config.js', () => ({
  PROJECT_ROOT: '/tmp/ccos-test',
}));

import {
  parseDelegation,
  initOrchestrator,
  getAvailableAgents,
  delegateToAgent,
} from './orchestrator.js';
import * as agentConfig from './agent-config.js';
import * as agent from './agent.js';
import * as db from './db.js';

const mockedListAgentIds = vi.mocked(agentConfig.listAgentIds);
const mockedLoadAgentConfig = vi.mocked(agentConfig.loadAgentConfig);
const mockedRunAgent = vi.mocked(agent.runAgent);
const mockedCreateInterAgentTask = vi.mocked(db.createInterAgentTask);
const mockedCompleteInterAgentTask = vi.mocked(db.completeInterAgentTask);
const mockedLogToHiveMind = vi.mocked(db.logToHiveMind);

function fakeAgentConfig(id: string, name = `Agent ${id}`, description = `desc ${id}`) {
  // Only the fields used by initOrchestrator matter; cast to any for the rest.
  return { id, name, description } as unknown as ReturnType<typeof agentConfig.loadAgentConfig>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset registry so each test starts from a clean slate.
  mockedListAgentIds.mockReturnValue([]);
  initOrchestrator();
});

describe('parseDelegation', () => {
  it('parses /delegate command syntax', () => {
    expect(parseDelegation('/delegate rc2 do the thing')).toEqual({
      agentId: 'rc2',
      prompt: 'do the thing',
    });
  });

  it('parses /delegate case-insensitively and trims prompt', () => {
    expect(parseDelegation('/DELEGATE rc2   hello world  ')).toEqual({
      agentId: 'rc2',
      prompt: 'hello world',
    });
  });

  it('parses @agentId: prompt syntax', () => {
    expect(parseDelegation('@comms: send a message')).toEqual({
      agentId: 'comms',
      prompt: 'send a message',
    });
  });

  it('handles multiline prompts after @agentId:', () => {
    expect(parseDelegation('@ops:\nmulti\nline\nprompt')).toEqual({
      agentId: 'ops',
      prompt: 'multi\nline\nprompt',
    });
  });

  it('parses @agentId prompt (no colon) only when agent is registered', () => {
    // No registry → no match for the no-colon form.
    expect(parseDelegation('@rc2 do something')).toBeNull();

    // Register rc2 and retry.
    mockedListAgentIds.mockReturnValue(['rc2']);
    mockedLoadAgentConfig.mockReturnValue(fakeAgentConfig('rc2'));
    initOrchestrator();

    expect(parseDelegation('@rc2 do something')).toEqual({
      agentId: 'rc2',
      prompt: 'do something',
    });
  });

  it('returns null for plain messages', () => {
    expect(parseDelegation('hello world')).toBeNull();
    expect(parseDelegation('/help')).toBeNull();
    expect(parseDelegation('@')).toBeNull();
  });
});

describe('initOrchestrator + getAvailableAgents', () => {
  it('builds the registry from listAgentIds + loadAgentConfig', () => {
    mockedListAgentIds.mockReturnValue(['rc2', 'comms']);
    mockedLoadAgentConfig.mockImplementation((id: string) => fakeAgentConfig(id));

    initOrchestrator();
    const agents = getAvailableAgents();

    expect(agents.map((a) => a.id)).toEqual(['rc2', 'comms']);
    expect(agents[0].name).toBe('Agent rc2');
  });

  it('skips agents whose config fails to load', () => {
    mockedListAgentIds.mockReturnValue(['ok', 'broken']);
    mockedLoadAgentConfig.mockImplementation((id: string) => {
      if (id === 'broken') throw new Error('missing token');
      return fakeAgentConfig(id);
    });

    initOrchestrator();
    expect(getAvailableAgents().map((a) => a.id)).toEqual(['ok']);
  });

  it('returns a defensive copy of the registry', () => {
    mockedListAgentIds.mockReturnValue(['rc2']);
    mockedLoadAgentConfig.mockImplementation((id: string) => fakeAgentConfig(id));
    initOrchestrator();

    const a = getAvailableAgents();
    a.push({ id: 'evil', name: 'evil', description: '' });

    expect(getAvailableAgents().map((x) => x.id)).toEqual(['rc2']);
  });
});

describe('delegateToAgent', () => {
  beforeEach(() => {
    mockedListAgentIds.mockReturnValue(['rc2']);
    mockedLoadAgentConfig.mockImplementation((id: string) => fakeAgentConfig(id));
    initOrchestrator();
  });

  it('runs the target agent and returns the result on success', async () => {
    mockedRunAgent.mockResolvedValue({
      text: 'task done',
      usage: null,
      sessionId: 's1',
      aborted: false,
    } as unknown as Awaited<ReturnType<typeof agent.runAgent>>);

    const result = await delegateToAgent('rc2', 'do X', 'chat-1', 'main');

    expect(result.agentId).toBe('rc2');
    expect(result.text).toBe('task done');
    expect(typeof result.taskId).toBe('string');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    expect(mockedRunAgent).toHaveBeenCalledOnce();
    expect(mockedCreateInterAgentTask).toHaveBeenCalledWith(
      result.taskId,
      'main',
      'rc2',
      'chat-1',
      'do X',
    );
    expect(mockedCompleteInterAgentTask).toHaveBeenCalledWith(
      result.taskId,
      'completed',
      'task done',
    );
    expect(mockedLogToHiveMind).toHaveBeenCalledWith(
      'main',
      'chat-1',
      'delegate',
      expect.stringContaining('Delegated to rc2'),
    );
    expect(mockedLogToHiveMind).toHaveBeenCalledWith(
      'rc2',
      'chat-1',
      'delegate_result',
      expect.stringContaining('Completed delegation'),
    );
  });

  it('throws a helpful error when target agent is unknown', async () => {
    await expect(
      delegateToAgent('ghost', 'hi', 'chat-1', 'main'),
    ).rejects.toThrow(/Agent "ghost" not found.*Available: rc2/);

    expect(mockedRunAgent).not.toHaveBeenCalled();
    expect(mockedCreateInterAgentTask).not.toHaveBeenCalled();
  });

  it('marks the task failed and logs to hive_mind when runAgent throws', async () => {
    mockedRunAgent.mockRejectedValue(new Error('claude crashed'));

    await expect(
      delegateToAgent('rc2', 'do X', 'chat-1', 'main'),
    ).rejects.toThrow('claude crashed');

    const taskId = mockedCreateInterAgentTask.mock.calls[0]?.[0];
    expect(taskId).toBeDefined();
    expect(mockedCompleteInterAgentTask).toHaveBeenCalledWith(
      taskId,
      'failed',
      'claude crashed',
    );
    expect(mockedLogToHiveMind).toHaveBeenCalledWith(
      'rc2',
      'chat-1',
      'delegate_error',
      expect.stringContaining('failed'),
    );
  });

  it('emits onProgress callbacks for start and completion', async () => {
    mockedRunAgent.mockResolvedValue({
      text: 'ok',
      usage: null,
      sessionId: 's1',
      aborted: false,
    } as unknown as Awaited<ReturnType<typeof agent.runAgent>>);

    const progress: string[] = [];
    await delegateToAgent('rc2', 'do X', 'chat-1', 'main', (m) => progress.push(m));

    expect(progress.length).toBe(2);
    expect(progress[0]).toMatch(/Delegating to/);
    expect(progress[1]).toMatch(/completed/);
  });
});
