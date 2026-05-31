// Token + chatId come from the URL query string (set by the Telegram deep
// link or by a saved bookmark). We persist both to localStorage AND to a
// cookie so the token survives across browser sessions (mobile Safari ITP
// aggressively clears localStorage after 7 days of inactivity, which breaks
// the dashboard on phones). The cookie is the authoritative fallback:
//   URL param  →  save to localStorage + cookie
//   localStorage  →  use it (also refresh cookie)
//   cookie  →  final fallback (covers cleared localStorage, private browsing)
//
// The backend accepts the token via query param, Authorization header, or
// the same cookie — whichever arrives first.

const COOKIE_NAME = 'claw_token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function readCookie(name: string): string {
  try {
    for (const part of document.cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      if (part.slice(0, eq).trim() === name) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
  } catch {}
  return '';
}

function persistToken(token: string): void {
  try { localStorage.setItem('claudeclaw.token', token); } catch {}
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`;
  } catch {}
}

const url = new URL(window.location.href);

let cachedToken = url.searchParams.get('token') || '';
if (cachedToken) {
  persistToken(cachedToken);
} else {
  try { cachedToken = localStorage.getItem('claudeclaw.token') || ''; } catch {}
  if (!cachedToken) cachedToken = readCookie(COOKIE_NAME);
  // Refresh cookie expiry on every load so it stays alive as long as the
  // user visits the dashboard at least once every 30 days.
  if (cachedToken) persistToken(cachedToken);
}

let cachedChatId = url.searchParams.get('chatId') || '';
if (cachedChatId) {
  try { localStorage.setItem('claudeclaw.chatId', cachedChatId); } catch {}
} else {
  try { cachedChatId = localStorage.getItem('claudeclaw.chatId') || ''; } catch {}
}

export const dashboardToken = cachedToken;
export const chatId = cachedChatId;

function withToken(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${encodeURIComponent(dashboardToken)}`;
}

// Auth headers sent with every API request. The backend accepts the token
// from the query param (backward-compat), Authorization header, or cookie.
// Sending it in the header means the cookie alone is enough for auth even
// when the query-param token is empty (cleared localStorage + no URL token).
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (dashboardToken) h['Authorization'] = `Bearer ${dashboardToken}`;
  return h;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(withToken(path), { method: 'GET', headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body, `GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(withToken(path), {
    method: 'POST',
    headers: authHeaders(body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody, `POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(withToken(path), {
    method: 'PATCH',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody, `PATCH ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(withToken(path), {
    method: 'PUT',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody, `PUT ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await fetch(withToken(path), { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body, `DELETE ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function tokenizedSseUrl(path: string): string {
  return withToken(path);
}

// Vite dev runs on :5173 and proxies /api/* and /warroom/text to the
// backend on :3141. The legacy voice room at /warroom?mode=voice can't
// be proxied (it shares a path prefix with the v2 SPA route), so links
// that go to legacy pages must point at the backend origin in dev.
const BACKEND_ORIGIN = (import.meta as any).env?.DEV ? 'http://localhost:3141' : '';

export function legacyUrl(path: string): string {
  return BACKEND_ORIGIN + path;
}
