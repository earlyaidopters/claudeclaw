import { EventEmitter } from 'node:events';

import { contextKey } from './config.js';

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

// ── Telegram connection state ────────────────────────────────────────

let _telegramConnected = false;

export function getTelegramConnected(): boolean {
  return _telegramConnected;
}

export function setTelegramConnected(v: boolean): void {
  _telegramConnected = v;
}

// ── Chat event bus (SSE broadcasting) ────────────────────────────────

export interface ChatEvent {
  type: 'user_message' | 'assistant_message' | 'processing' | 'progress' | 'error' | 'hive_mind';
  chatId: string;
  topicId?: string | null;
  agentId?: string;
  content?: string;
  source?: 'telegram' | 'dashboard';
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

const _processingKeys = new Set<string>();

export function setProcessing(chatId: string, v: boolean, topicId?: string | null): void {
  const key = contextKey(chatId, topicId);
  if (v) {
    _processingKeys.add(key);
  } else {
    _processingKeys.delete(key);
  }
  emitChatEvent({ type: 'processing', chatId, topicId, processing: v });
}

export function getIsProcessing(chatId?: string, topicId?: string | null): { processing: boolean; chatId: string } {
  if (chatId) {
    const key = contextKey(chatId, topicId);
    return { processing: _processingKeys.has(key), chatId };
  }
  // Backward compat: if no chatId given, return true if anything is processing
  if (_processingKeys.size > 0) {
    const first = _processingKeys.values().next().value as string;
    return { processing: true, chatId: first };
  }
  return { processing: false, chatId: '' };
}

// ── Active query abort ──────────────────────────────────────────────

const _activeAbort = new Map<string, AbortController>();

export function setActiveAbort(chatId: string, ctrl: AbortController | null, topicId?: string | null): void {
  const key = contextKey(chatId, topicId);
  if (ctrl) _activeAbort.set(key, ctrl);
  else _activeAbort.delete(key);
}

export function abortActiveQuery(chatId: string, topicId?: string | null): boolean {
  const key = contextKey(chatId, topicId);
  const ctrl = _activeAbort.get(key);
  if (ctrl) {
    ctrl.abort();
    _activeAbort.delete(key);
    return true;
  }
  return false;
}

// ── Active mission abort (separate lifecycle from per-message abort) ──

const _activeMissionAbort = new Map<string, { missionId: string; ctrl: AbortController }>();

export function setActiveMissionAbort(
  chatId: string, missionId: string, ctrl: AbortController | null, topicId?: string | null,
): void {
  const key = contextKey(chatId, topicId);
  if (ctrl && missionId) _activeMissionAbort.set(key, { missionId, ctrl });
  else _activeMissionAbort.delete(key);
}

export function abortActiveMission(chatId: string, topicId?: string | null): boolean {
  const key = contextKey(chatId, topicId);
  const entry = _activeMissionAbort.get(key);
  if (entry) {
    entry.ctrl.abort();
    _activeMissionAbort.delete(key);
    return true;
  }
  return false;
}

export function getActiveMissionId(chatId: string, topicId?: string | null): string | null {
  const key = contextKey(chatId, topicId);
  return _activeMissionAbort.get(key)?.missionId ?? null;
}
