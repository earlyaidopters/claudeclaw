import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { AGENT_ID, STORE_DIR } from './config.js';
import { logger } from './logger.js';

// ── Bot info (set once from onStart, read by dashboard) ─────────────

let _botUsername = '';
let _botName = '';

export function setBotInfo(username: string, name: string): void {
  _botUsername = username;
  _botName = name;
}

export function getBotInfo(): { username: string; name: string } {
  return { username: _botUsername, name: _botName };
}

// ── Per-agent connection state (cross-process, file-backed) ─────────
// Each agent process writes its own connection state to
// store/agent-<id>-conn.json so the main process's dashboard can
// aggregate per-agent status. Main runs the dashboard; sub-agents
// live in their own node processes and can't share in-memory state
// with main directly, hence the file bridge. Writes are best-effort —
// we swallow errors rather than crash an agent on a disk hiccup.

interface AgentConnState {
  telegram?: boolean;
  updatedAt: number;
}

function connStatePath(agentId: string = AGENT_ID): string {
  return path.join(STORE_DIR, `agent-${agentId}-conn.json`);
}

function persistAgentConnState(fields: Omit<AgentConnState, 'updatedAt'>): void {
  try {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
    const p = connStatePath();
    let current: Partial<AgentConnState> = {};
    if (fs.existsSync(p)) {
      try { current = JSON.parse(fs.readFileSync(p, 'utf-8')) as Partial<AgentConnState>; } catch (err) {
        logger.warn({ err, path: p }, 'agent conn-state file is corrupt, overwriting');
      }
    }
    const next: AgentConnState = { ...current, ...fields, updatedAt: Date.now() };
    fs.writeFileSync(p, JSON.stringify(next), 'utf-8');
  } catch (err) {
    // Non-fatal: disk-full or perms issue shouldn't crash a bot, but don't
    // hide it entirely either — the pill will just go out-of-date.
    logger.warn({ err, agentId: AGENT_ID }, 'could not persist agent conn-state');
  }
}

/**
 * Read an agent's persisted connection state. Returns null if the file
 * doesn't exist (agent hasn't run since this was introduced, or hasn't
 * emitted a state update yet). Called by dashboard aggregation.
 */
export function readAgentConnState(agentId: string): AgentConnState | null {
  try {
    const p = connStatePath(agentId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as AgentConnState;
  } catch {
    return null;
  }
}

// ── Telegram connection state ────────────────────────────────────────

let _telegramConnected = false;

export function getTelegramConnected(): boolean {
  return _telegramConnected;
}

export function setTelegramConnected(v: boolean): void {
  _telegramConnected = v;
  persistAgentConnState({ telegram: v });
}

// ── Chat event bus (SSE broadcasting) ────────────────────────────────

export interface ChatEvent {
  type: 'user_message' | 'assistant_message' | 'processing' | 'progress' | 'error' | 'hive_mind' | 'mission_update';
  chatId: string;
  agentId?: string;
  content?: string;
  source?: 'telegram' | 'dashboard' | 'signal';
  description?: string;
  processing?: boolean;
  timestamp: number;
}

export const chatEvents = new EventEmitter();
chatEvents.setMaxListeners(20);

export function emitChatEvent(event: Omit<ChatEvent, 'timestamp'>): void {
  const full: ChatEvent = { ...event, timestamp: Date.now() };
  chatEvents.emit('chat', full);
}

// ── Processing state ─────────────────────────────────────────────────

let _processing = false;
let _processingChatId = '';

export function setProcessing(chatId: string, v: boolean, agentId?: string): void {
  _processing = v;
  _processingChatId = v ? chatId : '';
  emitChatEvent({ type: 'processing', chatId, agentId, processing: v });
}

export function getIsProcessing(): { processing: boolean; chatId: string } {
  return { processing: _processing, chatId: _processingChatId };
}

// ── Active query abort ──────────────────────────────────────────────

const _activeAbort = new Map<string, AbortController>();

export function setActiveAbort(chatId: string, ctrl: AbortController | null): void {
  if (ctrl) _activeAbort.set(chatId, ctrl);
  else _activeAbort.delete(chatId);
}

export function abortActiveQuery(chatId: string): boolean {
  const ctrl = _activeAbort.get(chatId);
  if (ctrl) {
    ctrl.abort();
    _activeAbort.delete(chatId);
    return true;
  }
  return false;
}
