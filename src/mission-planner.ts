/**
 * Mission Planner — LLM-powered task decomposition with contract-first verification.
 *
 * Uses Gemini Flash to decompose a high-level goal into concrete subtasks,
 * each with an assigned agent (or worker type), dependencies, and verification criteria.
 *
 * Inspired by Tomašev et al. "Intelligent AI Delegation" (DeepMind, Feb 2026):
 * subtasks must have explicit, verifiable success criteria. If a task is too
 * vague to verify, the planner must decompose further or flag for clarification.
 */

import crypto from 'crypto';

import { AgentCard } from './agent-card.js';
import { generateContent, parseJsonResponse } from './gemini.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface PlannedSubtask {
  id: string;
  prompt: string;
  agentId: string | null;
  agentType: 'named' | 'worker';
  verification: string;
  dependsOn: string[];
}

export interface MissionPlan {
  reasoning: string;
  subtasks: PlannedSubtask[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

interface RawPlanResponse {
  reasoning: string;
  subtasks: Array<{
    prompt: string;
    agent_id: string | null;
    agent_type: 'named' | 'worker';
    verification: string;
    depends_on: number[];
  }>;
  needs_clarification: boolean;
  clarification_question?: string;
}

// ── Planner ──────────────────────────────────────────────────────────

export async function planMission(
  goal: string,
  availableAgents: AgentCard[],
): Promise<MissionPlan> {
  const agentSummary = availableAgents.length > 0
    ? availableAgents.map((a) => {
        const skills = a.skills.map((s) => s.name).join(', ');
        return `- ${a.id} (${a.type}): ${a.description}${skills !== 'default' ? ` [skills: ${skills}]` : ''} [tags: ${a.tags.join(', ') || 'none'}]`;
      }).join('\n')
    : '(No agents configured. All subtasks will use generic worker agents.)';

  const prompt = `You are a mission planner for an AI agent orchestration system. Your job is to decompose a goal into concrete, executable subtasks.

## Available Agents
${agentSummary}

## Rules (Contract-First Decomposition)
1. Each subtask MUST have a "verification" field describing how to objectively verify success. If you cannot define verification for a subtask, either decompose it further or set needs_clarification to true.
2. Each subtask should be self-contained — the executing agent receives only the prompt and verification criteria.
3. Assign subtasks to specific agents when their skills match. Use agent_type "worker" and agent_id null for generic tasks.
4. Use depends_on (array of subtask indices, 0-based) to express ordering constraints. Subtasks without dependencies run in parallel.
5. Keep subtasks focused — prefer 3-6 subtasks over 1-2 overly broad ones.
6. Do NOT create subtasks for things the user hasn't asked for (no over-engineering).

## Goal
${goal}

## Response Format (JSON)
{
  "reasoning": "Brief explanation of your decomposition strategy",
  "subtasks": [
    {
      "prompt": "Clear instruction for the executing agent",
      "agent_id": "agent-id or null for generic worker",
      "agent_type": "named or worker",
      "verification": "How to verify this subtask succeeded",
      "depends_on": [0, 1]
    }
  ],
  "needs_clarification": false,
  "clarification_question": "Only if needs_clarification is true"
}`;

  const raw = await generateContent(prompt);
  const parsed = parseJsonResponse<RawPlanResponse>(raw);

  if (!parsed) {
    logger.error({ raw: raw.slice(0, 500) }, 'Mission planner returned unparseable response');
    // Fallback: single subtask with the original goal
    const fallbackId = crypto.randomUUID();
    return {
      reasoning: 'Planner failed to decompose. Falling back to single task.',
      subtasks: [{
        id: fallbackId,
        prompt: goal,
        agentId: null,
        agentType: 'worker',
        verification: 'Task completed without errors',
        dependsOn: [],
      }],
      needsClarification: false,
    };
  }

  // Assign UUIDs and resolve dependency indices to IDs
  const ids = parsed.subtasks.map(() => crypto.randomUUID());

  const subtasks: PlannedSubtask[] = parsed.subtasks.map((raw, i) => ({
    id: ids[i],
    prompt: raw.prompt,
    agentId: raw.agent_id,
    agentType: raw.agent_type ?? 'worker',
    verification: raw.verification || 'Task completed without errors',
    dependsOn: (raw.depends_on ?? [])
      .filter((idx) => idx >= 0 && idx < ids.length && idx !== i)
      .map((idx) => ids[idx]),
  }));

  const plan: MissionPlan = {
    reasoning: parsed.reasoning ?? '',
    subtasks,
    needsClarification: parsed.needs_clarification ?? false,
    clarificationQuestion: parsed.clarification_question,
  };

  logger.info(
    {
      goal: goal.slice(0, 80),
      subtasks: subtasks.length,
      needsClarification: plan.needsClarification,
    },
    'Mission planned',
  );

  return plan;
}
