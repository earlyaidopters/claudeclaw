/**
 * Agent Cards — structured capability manifests for agent discovery and task matching.
 *
 * Inspired by Google's A2A protocol Agent Cards, adapted for local ClaudeClaw use.
 * Agent Cards are generated from enhanced agent.yaml configs and used by Mission Control
 * to decide which agent to assign subtasks to.
 */

import { listAgentIds, loadAgentConfig, resolveAgentDir } from './agent-config.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────

/** A discrete capability an agent can perform. */
export interface AgentSkill {
  name: string;
  description: string;
  /** Examples of prompts this skill can handle. */
  examples?: string[];
  /** How to verify successful completion. */
  verification?: string;
}

/** The full capability manifest for an agent. */
export interface AgentCard {
  id: string;
  name: string;
  description: string;
  type: 'named' | 'worker';
  /** Default model for this agent. */
  model?: string;
  /** Structured skills this agent can perform. */
  skills: AgentSkill[];
  /** Tags for coarse-grained matching (e.g., 'social-media', 'engineering', 'research'). */
  tags: string[];
}

// ── Card Loading ─────────────────────────────────────────────────────

/**
 * Build an AgentCard from an agent's config.
 *
 * Reads `agent.yaml` for core fields. Skills and tags come from the
 * optional `skills` and `tags` arrays in the YAML. Falls back to a
 * single skill derived from the description if none are declared.
 */
export function loadAgentCard(agentId: string): AgentCard | null {
  try {
    const config = loadAgentConfig(agentId);

    return {
      id: agentId,
      name: config.name,
      description: config.description,
      type: config.type,
      model: config.model,
      skills: config.skills.map((s) => ({
        name: s.name,
        description: s.description,
        examples: s.examples,
        verification: s.verification,
      })),
      tags: config.tags,
    };
  } catch (err) {
    logger.warn({ agentId, err }, 'Failed to load agent card');
    return null;
  }
}

/**
 * Load all available agent cards.
 * Skips agents whose config fails to load.
 */
export function loadAllAgentCards(): AgentCard[] {
  const ids = listAgentIds();
  const cards: AgentCard[] = [];

  for (const id of ids) {
    const card = loadAgentCard(id);
    if (card) cards.push(card);
  }

  return cards;
}

/**
 * Find agents whose skills or tags match a query.
 * Returns cards sorted by relevance (tag match > skill match > description match).
 */
export function matchAgents(query: string, cards: AgentCard[]): AgentCard[] {
  const lower = query.toLowerCase();
  const scored: Array<{ card: AgentCard; score: number }> = [];

  for (const card of cards) {
    let score = 0;

    // Tag match (highest weight)
    for (const tag of card.tags) {
      if (lower.includes(tag.toLowerCase())) score += 3;
    }

    // Skill name/description match
    for (const skill of card.skills) {
      if (lower.includes(skill.name.toLowerCase())) score += 2;
      if (skill.description.toLowerCase().split(/\s+/).some((w) => lower.includes(w) && w.length > 3)) {
        score += 1;
      }
    }

    // Description match (lowest weight)
    if (card.description.toLowerCase().split(/\s+/).some((w) => lower.includes(w) && w.length > 3)) {
      score += 1;
    }

    if (score > 0) scored.push({ card, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.card);
}
