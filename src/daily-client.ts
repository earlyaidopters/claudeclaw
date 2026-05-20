/**
 * Daily.co REST API wrapper.
 *
 * Thin client for the endpoints meet-cli needs to spin up voice-only
 * meeting rooms. We intentionally keep this minimal: create a room with
 * a short TTL, optionally delete it, maybe generate a meeting token.
 * All the real work (audio pipeline, agent brain) lives inside the
 * Pipecat daily_agent.py process that joins the room we create here.
 *
 * Docs: https://docs.daily.co/reference/rest-api
 */

import { readEnvFile } from './env.js';

const DAILY_API_BASE = process.env.DAILY_API_BASE_URL || 'https://api.daily.co/v1';

export class DailyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'DailyApiError';
  }
}

function resolveKey(): string {
  if (process.env.DAILY_API_KEY) return process.env.DAILY_API_KEY;
  const fromEnv = readEnvFile(['DAILY_API_KEY']);
  if (fromEnv.DAILY_API_KEY) return fromEnv.DAILY_API_KEY;
  throw new DailyApiError(
    'DAILY_API_KEY not set. Sign up at https://dashboard.daily.co/signup and drop the key in project .env.',
    0,
    null,
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = resolveKey();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${DAILY_API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body as { info?: string; error?: string } | null)?.info
      || (body as { info?: string; error?: string } | null)?.error
      || `HTTP ${res.status}`;
    throw new DailyApiError(`Daily API ${path}: ${msg}`, res.status, body);
  }
  return body as T;
}

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  api_created: boolean;
  privacy: 'public' | 'private';
  created_at: string;
  config: {
    exp?: number;
    eject_at_room_exp?: boolean;
    enable_prejoin_ui?: boolean;
    start_audio_off?: boolean;
    start_video_off?: boolean;
    [k: string]: unknown;
  };
}

/**
 * Create a short-lived Daily.co room for an agent meeting session.
 *
 * Defaults are tuned for the meet-bot use case: 2-hour TTL, auto-close
 * when expired, no prejoin UI so the host can drop in instantly, both
 * audio and video allowed so the human can choose.
 */
export async function createRoom(opts: {
  name?: string;
  ttlSec?: number;
  enablePrejoinUi?: boolean;
} = {}): Promise<DailyRoom> {
  const ttl = opts.ttlSec ?? 2 * 60 * 60; // 2 hours default
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const body: Record<string, unknown> = {
    properties: {
      exp,
      eject_at_room_exp: true,
      enable_prejoin_ui: opts.enablePrejoinUi ?? false,
      start_audio_off: false,
      start_video_off: false,
    },
  };
  if (opts.name) body.name = opts.name;
  return await request<DailyRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteRoom(name: string): Promise<void> {
  await request<{ deleted: boolean }>(`/rooms/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function getRoom(name: string): Promise<DailyRoom> {
  return await request<DailyRoom>(`/rooms/${encodeURIComponent(name)}`);
}

/**
 * Create a meeting token. Lets us restrict who can join, name the bot,
 * and grant owner permissions to specific participants. For v1 the bot
 * itself doesn't need a token (public rooms work), but we mint one for
 * the agent so it appears with the right display name in the Daily UI.
 */
export async function createToken(opts: {
  roomName: string;
  userName: string;
  isOwner?: boolean;
  expSec?: number;
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (opts.expSec ?? 2 * 60 * 60);
  const res = await request<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_name: opts.userName,
        is_owner: opts.isOwner ?? false,
        exp,
      },
    }),
  });
  return res.token;
}
