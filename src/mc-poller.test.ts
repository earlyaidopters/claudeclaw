import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock db.js -- must be before any import that uses it
vi.mock('./db.js', () => ({
  createScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
  getAllScheduledTasks: vi.fn(() => []),
}));

// Mock messaging.js
vi.mock('./messaging.js', () => ({
  isAgentAlive: vi.fn(() => false),
  nudgeAgent: vi.fn(() => false),
}));

// Mock env.js
vi.mock('./env.js', () => ({
  readEnvFile: vi.fn(() => ({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-key',
  })),
}));

// Mock logger.js
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createScheduledTask, getAllScheduledTasks } from './db.js';
import { pollAllReviewTasks, handleBuildReviewTasks, handleContentReviewTasks } from './mc-poller.js';
import type { MCTask } from './mc-poller.js';

// Set env vars before import (mc-poller reads them at module level)
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';

function makeMCTask(overrides: Partial<MCTask> = {}): MCTask {
  return {
    id: 'uuid-' + Math.random().toString(36).slice(2, 10),
    task_number: Math.floor(Math.random() * 10000),
    title: 'Test task',
    description: 'Test description',
    updated_at: new Date().toISOString(),
    assignee_agent_id: 'agent-uuid-123',
    department: 'build',
    status: 'review',
    ...overrides,
  };
}

describe('pollAllReviewTasks', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('fetches review tasks WITHOUT a department filter in the URL', async () => {
    // Mock fetch to return empty array (no tasks)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await pollAllReviewTasks();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;

    // Verify URL params include status=eq.review
    expect(calledUrl).toContain('status=eq.review');
    // Verify URL params do NOT include department filter -- this is the A1 regression test
    expect(calledUrl).not.toContain('department=');
  });

  it('routes department=build tasks to handleBuildReviewTasks (Codex review)', async () => {
    const buildTask = makeMCTask({ department: 'build', task_number: 100 });

    // First call: review tasks fetch
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [buildTask],
    });
    // Second call: agent map fetch
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'agent-uuid-123', name: 'jarvis' }],
    });

    // getAllScheduledTasks returns empty (no dedup collisions)
    vi.mocked(getAllScheduledTasks).mockReturnValue([]);

    await pollAllReviewTasks();

    // Build task should create a verify-{N}-poll scheduled task (Codex review)
    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    expect(callArgs[0]).toBe(`verify-${buildTask.task_number}-poll`);
    expect(callArgs[1]).toContain('CODEX REVIEW REQUIRED');
  });

  it('routes department=content tasks to handleContentReviewTasks (quality review)', async () => {
    const contentTask = makeMCTask({ department: 'content', task_number: 200 });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [contentTask],
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'agent-uuid-123', name: 'jean' }],
    });

    vi.mocked(getAllScheduledTasks).mockReturnValue([]);

    await pollAllReviewTasks();

    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    expect(callArgs[0]).toBe(`content-review-${contentTask.id.slice(0, 8)}`);
    expect(callArgs[1]).toContain('quality review');
  });

  it('routes department=null tasks to handleContentReviewTasks (NOT dropped)', async () => {
    const nullDeptTask = makeMCTask({ department: null, task_number: 300 });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [nullDeptTask],
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'agent-uuid-123', name: 'jarvis' }],
    });

    vi.mocked(getAllScheduledTasks).mockReturnValue([]);

    await pollAllReviewTasks();

    // Should create a content-review task, NOT be silently dropped
    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    expect(callArgs[0]).toBe(`content-review-${nullDeptTask.id.slice(0, 8)}`);
    expect(callArgs[1]).toContain('quality review');
  });

  it('handles tasks with null assignee_agent_id without crashing', async () => {
    const nullAssigneeTask = makeMCTask({
      department: 'build',
      assignee_agent_id: null,
      task_number: 400,
    });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [nullAssigneeTask],
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'agent-uuid-123', name: 'jarvis' }],
    });

    vi.mocked(getAllScheduledTasks).mockReturnValue([]);

    // Should not throw
    await expect(pollAllReviewTasks()).resolves.not.toThrow();

    // Should still create the verification task (builder shown as 'Unknown builder')
    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    expect(callArgs[1]).toContain('Unknown builder');
  });
});

describe('handleBuildReviewTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(getAllScheduledTasks).mockReturnValue([]);
  });

  it('guards nullable assignee_agent_id', async () => {
    const agentMap = new Map([['uuid-1', 'jarvis']]);
    const task = makeMCTask({ assignee_agent_id: null, task_number: 500 });

    // Should not throw with null assignee
    await expect(handleBuildReviewTasks([task], agentMap)).resolves.not.toThrow();
  });
});

describe('handleContentReviewTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllScheduledTasks).mockReturnValue([]);
  });

  it('guards nullable assignee_agent_id', async () => {
    const agentMap = new Map([['uuid-1', 'jarvis']]);
    const task = makeMCTask({ assignee_agent_id: null, department: 'content', task_number: 600 });

    await expect(handleContentReviewTasks([task], agentMap)).resolves.not.toThrow();

    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    // Builder name should be 'unknown agent' (not a TypeError from null lookup)
    expect(callArgs[1]).toContain('unknown agent');
  });

  it('shows department as (unset) for null department tasks', async () => {
    const agentMap = new Map([['agent-uuid-123', 'jarvis']]);
    const task = makeMCTask({ department: null, task_number: 700 });

    await handleContentReviewTasks([task], agentMap);

    expect(createScheduledTask).toHaveBeenCalled();
    const callArgs = vi.mocked(createScheduledTask).mock.calls[0];
    expect(callArgs[1]).toContain('Department: (unset)');
  });
});
