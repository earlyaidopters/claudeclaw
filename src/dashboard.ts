import { Api, RawApi } from 'grammy';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';

import fs from 'fs';
import path from 'path';
import { AGENT_ID, ALLOWED_CHAT_ID, DASHBOARD_PORT, DASHBOARD_TOKEN, DASHBOARD_URL, MESSENGER_TYPE, PROJECT_ROOT, STORE_DIR, WHATSAPP_ENABLED, SLACK_USER_TOKEN, CONTEXT_LIMIT, agentDefaultModel } from './config.js';
import crypto from 'crypto';
import {
  getAllScheduledTasks,
  deleteScheduledTask,
  pauseScheduledTask,
  resumeScheduledTask,
  getConversationPage,
  getDashboardMemoryStats,
  getDashboardPinnedMemories,
  getDashboardLowSalienceMemories,
  getDashboardTopAccessedMemories,
  getDashboardMemoryTimeline,
  getDashboardConsolidations,
  getDashboardMemoriesList,
  getDashboardTokenStats,
  getDashboardCostTimeline,
  getDashboardRecentTokenUsage,
  getSession,
  getSessionTokenUsage,
  getHiveMindEntries,
  getAgentTokenStats,
  getAgentRecentConversation,
  getMissionTasks,
  getMissionTask,
  createMissionTask,
  cancelMissionTask,
  deleteMissionTask,
  reassignMissionTask,
  assignMissionTask,
  updateMissionTaskTimeout,
  getUnassignedMissionTasks,
  getMissionTaskHistory,
  getAuditLog,
  getAuditLogCount,
  getRecentBlockedActions,
  listActiveMeetSessions,
  listRecentMeetSessions,
  getMeetSession,
  type MeetSession,
  createWarRoomMeeting,
  endWarRoomMeeting,
  addWarRoomTranscript,
  getWarRoomMeetings,
  getWarRoomTranscript,
  createTextMeeting,
  getTextMeeting,
  setMeetingPin,
  getOpenTextMeetingIds,
  getTextMeetings,
  clearMeetingSessions,
  setDashboardSetting,
  getAllDashboardSettings,
  insertAgentSuggestion,
  listActiveAgentSuggestions,
  dismissAgentSuggestion,
  markAgentSuggestionActed,
  getRecentlySuggestedSplits,
  insertAuditLog,
} from './db.js';
import * as killSwitches from './kill-switches.js';
import { getWarRoomTextHtml } from './warroom-text-html.js';
import { handleTextTurn, cancelMeetingTurns, getRoster, warmupMeeting, isWarmupDone, getActiveTurnIds, waitForMeetingTurnsIdle } from './warroom-text-orchestrator.js';
import { getChannel, closeChannel, startChannelSweeper } from './warroom-text-events.js';
import { messageQueue } from './message-queue.js';
import { extractViaClaude } from './memory-ingest.js';
const WARROOM_TEXT_ID_RE = /^wr_[a-z0-9_]{4,64}$/i;
const CLIENT_MSG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import { generateContent, parseJsonResponse } from './gemini.js';
import { getSecurityStatus } from './security.js';
import {
  listAgentIds,
  loadAgentConfig,
  setAgentModel,
  setAgentDescription,
  getMainDescription,
  setMainDescription,
} from './agent-config.js';
import {
  listTemplates,
  validateAgentId,
  validateBotToken,
  createAgent,
  activateAgent,
  deactivateAgent,
  restartAgent,
  deleteAgent,
  suggestBotNames,
  isAgentRunning,
} from './agent-create.js';
import { dispatchDashboardChatToAgent, processMessageFromDashboard } from './bot.js';
import { getDashboardHtml } from './dashboard-html.js';
import { getWarRoomHtml } from './warroom-html.js';
import { WARROOM_ENABLED, WARROOM_PORT } from './config.js';
import { logger } from './logger.js';
import { getTelegramConnected, getBotInfo, chatEvents, getIsProcessing, abortActiveQuery, ChatEvent, readAgentConnState } from './state.js';

async function classifyTaskAgent(prompt: string): Promise<string | null> {
  try {
    const agentIds = listAgentIds();
    const agentDescriptions = agentIds.map((id) => {
      try {
        const config = loadAgentConfig(id);
        return `- ${id}: ${config.description}`;
      } catch { return `- ${id}: (no description)`; }
    });

    const classificationPrompt = `Given these agents and their roles:
- main: Primary assistant, general tasks, anything that doesn't clearly fit another agent
${agentDescriptions.join('\n')}

Which ONE agent is best suited for this task?
Task: "${prompt.slice(0, 500)}"

Reply with JSON: {"agent": "agent_id"}`;

    const response = await generateContent(classificationPrompt);
    const parsed = parseJsonResponse<{ agent: string }>(response);
    if (parsed?.agent) {
      const validAgents = ['main', ...agentIds];
      if (validAgents.includes(parsed.agent)) return parsed.agent;
    }
    return 'main'; // fallback
  } catch (err) {
    logger.error({ err }, 'Auto-assign classification failed');
    return null;
  }
}

// Constant-time token comparison (audit fix A4E-1, ported from osrepo PR #51).
// Plain `===` leaks timing info that lets a remote attacker recover the token
// one byte at a time. timingSafeEqual takes O(n) regardless of where the
// mismatch occurs. Length pre-check prevents a panic on differing buffers.
function safeTokenEqual(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

// Inline token check for handlers that USED to rely on the global middleware
// but now serve the public SPA shell on the same Hono app. Legacy HTML routes
// that embed DASHBOARD_TOKEN in their response body still require this.
function requireToken(c: { req: { query: (k: string) => string | undefined } }): Response | null {
  const token = c.req.query('token');
  if (!safeTokenEqual(token, DASHBOARD_TOKEN)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export function startDashboard(botApi?: Api<RawApi>): void {
  if (!DASHBOARD_TOKEN) {
    logger.info('DASHBOARD_TOKEN not set, dashboard disabled');
    return;
  }

  const app = new Hono();

  // CORS headers for cross-origin access (Cloudflare tunnel, mobile browsers).
  // Reflect Origin only when it matches a known-good host (audit fix A4E-3,
  // ported from osrepo PR #51). Wildcard `*` is functionally equivalent to
  // "trust anyone" for credentialed reads of authenticated endpoints; pinning
  // to an allowlist closes that surface.
  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin) {
      try {
        const host = new URL(origin).hostname;
        const dashHost = DASHBOARD_URL ? new URL(DASHBOARD_URL).hostname : '';
        const allowed =
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '[::1]' ||
          (!!dashHost && host === dashHost) ||
          host.endsWith('.trycloudflare.com');
        if (allowed) {
          c.header('Access-Control-Allow-Origin', origin);
          c.header('Vary', 'Origin');
        }
      } catch { /* malformed Origin — emit no header */ }
    }
    c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await next();
  });

  // Global error handler — prevents unhandled throws from killing the server
  app.onError((err, c) => {
    logger.error({ err: err.message }, 'Dashboard request error');
    return c.json({ error: 'Internal server error' }, 500);
  });

  // Token auth middleware — gates ONLY /api/*. The SPA shell at `/` and the
  // Vite-built static assets under `/assets/*` are served unauthenticated so
  // a token-stripped URL still loads the app instead of returning raw 401
  // JSON. The SPA reads ?token= from window.location and includes it in
  // every API request. Legacy HTML routes that embed DASHBOARD_TOKEN in the
  // page source call requireToken() inline.
  app.use('*', async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (!pathname.startsWith('/api/')) {
      await next();
      return;
    }
    const token = c.req.query('token');
    if (!safeTokenEqual(token, DASHBOARD_TOKEN)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  // Serve dashboard.
  // Default: the new Vite-built Mission Control SPA at dist/web/index.html.
  // Fallback: set DASHBOARD_LEGACY=true in .env to revert to the legacy
  // single-file template HTML. Also falls back automatically if the SPA
  // hasn't been built yet (dist/web/index.html missing).
  const legacyMode = (process.env.DASHBOARD_LEGACY || '').toLowerCase() === 'true';
  const newDashboardIndex = path.join(PROJECT_ROOT, 'dist', 'web', 'index.html');
  app.get('/', (c) => {
    const chatId = c.req.query('chatId') || '';
    if (legacyMode || !fs.existsSync(newDashboardIndex)) {
      // Legacy path interpolates DASHBOARD_TOKEN into the HTML, so it MUST
      // require the token. SPA path doesn't.
      const denied = requireToken(c); if (denied) return denied;
      return c.html(getDashboardHtml(DASHBOARD_TOKEN, chatId, WARROOM_ENABLED));
    }
    // SPA shell. Read fresh on each request so dev rebuilds appear without
    // restart. The frontend reads ?token= and ?chatId= from window.location,
    // falling back to localStorage. Serving this unauthenticated means a
    // token-stripped URL still loads the app instead of showing raw 401.
    return c.html(fs.readFileSync(newDashboardIndex, 'utf-8'));
  });

  // SPA history fallback. Client-side routes (/mission, /usage, /settings,
  // /agents, etc.) have no matching server route, so a hard refresh or a
  // direct bookmark to a sub-page would 404. Serve the SPA shell for any
  // unmatched non-API GET and let the frontend router resolve it. Unknown
  // /api and /ws paths still return a real 404 instead of HTML.
  app.notFound((c) => {
    const pathname = new URL(c.req.url).pathname;
    const isApiOrWs =
      pathname.startsWith('/api/') ||
      pathname.startsWith('/ws/') ||
      pathname.startsWith('/warroom');
    if (
      c.req.method === 'GET' &&
      !isApiOrWs &&
      !legacyMode &&
      fs.existsSync(newDashboardIndex)
    ) {
      return c.html(fs.readFileSync(newDashboardIndex, 'utf-8'));
    }
    return c.text('Not Found', 404);
  });

  // Static asset serving for the Vite-built frontend.
  // Vite emits hashed JS/CSS/source-maps under dist/web/assets/.
  app.get('/assets/*', (c) => {
    const url = new URL(c.req.url);
    const rel = url.pathname.replace(/^\//, '');
    const filePath = path.join(PROJECT_ROOT, 'dist', 'web', rel);
    // Defense in depth: ensure the resolved path stays inside dist/web/.
    const root = path.join(PROJECT_ROOT, 'dist', 'web');
    if (!filePath.startsWith(root + path.sep)) return c.text('', 403);
    if (!fs.existsSync(filePath)) return c.text('', 404);
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ctype = ext === '.js' ? 'application/javascript'
      : ext === '.css' ? 'text/css'
      : ext === '.map' ? 'application/json'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.woff2' ? 'font/woff2'
      : ext === '.woff' ? 'font/woff'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': ctype, 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  });

  // Top-level static files copied from web/public/ at Vite build time
  // (e.g. /brain.glb for the 3D Hive Mind view). Stable filenames so they
  // sit at the root, not under /assets/.
  app.get('/:filename{.+\\.(glb|gltf|bin|ktx2|wasm|svg|png|webp|ico)}', (c) => {
    const filename = c.req.param('filename');
    const filePath = path.join(PROJECT_ROOT, 'dist', 'web', filename);
    const root = path.join(PROJECT_ROOT, 'dist', 'web');
    if (!filePath.startsWith(root + path.sep)) return c.text('', 403);
    if (!fs.existsSync(filePath)) return c.text('', 404);
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ctype = ext === '.glb' ? 'model/gltf-binary'
      : ext === '.gltf' ? 'model/gltf+json'
      : ext === '.wasm' ? 'application/wasm'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : ext === '.ico' ? 'image/x-icon'
      : 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': ctype, 'Cache-Control': 'public, max-age=86400' },
    });
  });

  // War Room page (legacy voice UI). The SPA has its own WarRoom view under
  // /warroom in v2 routing, but the original /warroom HTML is preserved for
  // direct access and for clients that haven't loaded the SPA. This embeds
  // DASHBOARD_TOKEN in the HTML so it MUST require the token.
  app.get('/warroom', (c) => {
    const denied = requireToken(c); if (denied) return denied;
    const chatId = c.req.query('chatId') || '';
    return c.html(getWarRoomHtml(DASHBOARD_TOKEN, chatId, WARROOM_PORT));
  });

  // Serve War Room background music (user's custom music.mp3 first, then bundled entrance.mp3)
  app.get('/warroom-music', (c) => {
    const musicPath = path.join(PROJECT_ROOT, 'warroom', 'music.mp3');
    if (!fs.existsSync(musicPath)) return c.text('', 404);
    const data = fs.readFileSync(musicPath);
    return new Response(data, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    });
  });

  // Upload custom War Room entrance music from the dashboard
  app.post('/warroom-music-upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || typeof file === 'string') return c.json({ error: 'No file uploaded' }, 400);
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) return c.json({ error: 'File too large (max 20MB)' }, 400);
    fs.writeFileSync(path.join(PROJECT_ROOT, 'warroom', 'music.mp3'), buf);
    return c.json({ ok: true });
  });

  // Serve War Room test audio for the browser-side autotest harness.
  // Used by the mock microphone in warroom browser tests; served only
  // when the dashboard token matches so it's not a public endpoint.
  app.get('/warroom-test-audio', (c) => {
    const audioPath = path.join(PROJECT_ROOT, 'warroom', 'test-audio.wav');
    if (!fs.existsSync(audioPath)) return c.text('', 404);
    const data = fs.readFileSync(audioPath);
    return new Response(data, {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
    });
  });

  // Serve War Room Pipecat client bundle
  app.get('/warroom-client.js', (c) => {
    const bundlePath = path.join(PROJECT_ROOT, 'warroom', 'client.bundle.js');
    if (!fs.existsSync(bundlePath)) return c.text('// bundle not built', 404);
    const data = fs.readFileSync(bundlePath, 'utf-8');
    return new Response(data, {
      headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600' },
    });
  });

  // Serve War Room agent avatars
  app.get('/warroom-avatar/:id', (c) => {
    const agentId = c.req.param('id').replace(/[^a-z0-9_-]/g, '');
    const avatarPath = path.join(PROJECT_ROOT, 'warroom', 'avatars', `${agentId}.png`);
    if (!fs.existsSync(avatarPath)) return c.text('', 404);
    const data = fs.readFileSync(avatarPath);
    return new Response(data, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  });

  // War Room API: meeting state management.
  // We deliberately do NOT return a ws_url here. Older versions of this
  // route sent `ws://localhost:${WARROOM_PORT}`, which broke any
  // Cloudflare-tunneled access since the browser would try to connect to
  // its own localhost instead of the tunnel host. The client-side code
  // in src/warroom-html.ts always has a `window.location.hostname`
  // fallback, so just returning {ok:true} lets the browser build the
  // right WS url on its own.
  app.post('/api/warroom/start', async (c) => {
    if (!WARROOM_ENABLED) {
      return c.json({ error: 'War Room not enabled. Set WARROOM_ENABLED=true in .env with GOOGLE_API_KEY (for live mode) or DEEPGRAM_API_KEY + CARTESIA_API_KEY (for legacy mode).' }, 400);
    }
    // If the pin file was updated recently (agent switch while no meeting
    // was active), the running server has the wrong agent. Kill it so it
    // restarts with the correct persona/voice before we probe readiness.
    try {
      const pinStat = fs.statSync(WARROOM_PIN_PATH);
      const pinAge = Date.now() - pinStat.mtimeMs;
      if (pinAge < 30000) {
        // Pin changed in the last 30 seconds. Kill the server so it
        // picks up the new pin, then poll until it's ready.
        await killWarroomAsync('pin changed recently, restarting for Start Meeting');
        const net = await import('net');
        let serverReady = false;
        for (let attempt = 0; attempt < 15 && !serverReady; attempt++) {
          await new Promise((r) => setTimeout(r, 1000));
          serverReady = await new Promise<boolean>((resolve) => {
            const sock = new net.Socket();
            const t = setTimeout(() => { sock.destroy(); resolve(false); }, 1000);
            sock.connect(WARROOM_PORT, '127.0.0.1', () => { clearTimeout(t); sock.destroy(); resolve(true); });
            sock.on('error', () => { clearTimeout(t); sock.destroy(); resolve(false); });
          });
        }
        if (serverReady) {
          await new Promise((r) => setTimeout(r, 200));
          return c.json({ ok: true, status: 'ready' });
        }
        return c.json({ ok: false, status: 'starting', error: 'War Room server restarting, try again' }, 503);
      }
    } catch { /* pin file might not exist yet, that's fine */ }

    // Probe the Python WebSocket server to verify it's actually accepting
    // connections. Without this, the browser connects before the server is
    // ready and gets silent failures or "only one client allowed" errors.
    try {
      const net = await import('net');
      const ready = await new Promise<boolean>((resolve) => {
        const sock = new net.Socket();
        const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 3000);
        sock.connect(WARROOM_PORT, '127.0.0.1', () => {
          clearTimeout(timer);
          sock.destroy();
          resolve(true);
        });
        sock.on('error', () => { clearTimeout(timer); sock.destroy(); resolve(false); });
      });
      if (!ready) {
        return c.json({ ok: false, status: 'starting', error: 'War Room server not ready yet' }, 503);
      }
      // Small delay after TCP success: the socket may be bound but the
      // Pipecat WebSocket upgrade handler might not be fully initialized.
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      return c.json({ ok: false, status: 'starting', error: 'Could not probe War Room server' }, 503);
    }
    return c.json({ ok: true, status: 'ready' });
  });

  // Return the dynamic agent list for the War Room UI to render cards.
  // Includes main + all configured agents with their display names.
  app.get('/api/warroom/agents', (c) => {
    const ids = ['main', ...listAgentIds().filter((id) => id !== 'main')];
    const agents = ids.map((id) => {
      try {
        const cfg = loadAgentConfig(id);
        return { id, name: cfg.name || id, description: cfg.description || '' };
      } catch {
        // No agent.yaml — use a capitalised fallback (e.g. "main" → "Main")
        const fallbackName = id.charAt(0).toUpperCase() + id.slice(1);
        return { id, name: fallbackName, description: '' };
      }
    });
    return c.json({ agents });
  });

  // ── War Room meeting history & transcript persistence ──────────────
  app.post('/api/warroom/meeting/start', async (c) => {
    const body: { id?: string; mode?: string; agent?: string } = await c.req.json().catch(() => ({}));
    const id = body.id || crypto.randomUUID();
    createWarRoomMeeting(id, body.mode || 'direct', body.agent || 'main');
    return c.json({ ok: true, meetingId: id });
  });

  app.post('/api/warroom/meeting/end', async (c) => {
    const body: { id?: string; entryCount?: number } = await c.req.json().catch(() => ({}));
    if (body.id) endWarRoomMeeting(body.id, body.entryCount || 0);
    return c.json({ ok: true });
  });

  app.post('/api/warroom/meeting/transcript', async (c) => {
    const body: { meetingId?: string; speaker?: string; text?: string } = await c.req.json().catch(() => ({}));
    if (body.meetingId && body.speaker && body.text) {
      addWarRoomTranscript(body.meetingId, body.speaker, body.text);
    }
    return c.json({ ok: true });
  });

  app.get('/api/warroom/meetings', (c) => {
    const limit = parseInt(c.req.query('limit') || '20');
    return c.json({ meetings: getWarRoomMeetings(limit) });
  });

  app.get('/api/warroom/meeting/:id/transcript', (c) => {
    return c.json({ transcript: getWarRoomTranscript(c.req.param('id')) });
  });

  // ── War Room pin: route all voice utterances to a specific agent ──
  // Lives in /tmp so the Python Pipecat server (a separate process) can
  // read the state without needing an IPC bus. router.py checks this
  // file's mtime and reloads only when it changes. Spoken agent prefixes
  // (e.g. "research, find X") still take precedence over the pin.
  const WARROOM_PIN_PATH = '/tmp/warroom-pin.json';
  const VALID_PIN_AGENTS = new Set(['main', ...listAgentIds()]);
  const VALID_PIN_MODES = new Set(['direct', 'auto']);

  // Read current pin state from disk. Returns normalized defaults for
  // missing fields so callers can rely on both agent and mode being set.
  function readPinState(): { agent: string | null; mode: string } {
    try {
      if (fs.existsSync(WARROOM_PIN_PATH)) {
        const raw = JSON.parse(fs.readFileSync(WARROOM_PIN_PATH, 'utf-8'));
        const agent = (raw && typeof raw.agent === 'string' && VALID_PIN_AGENTS.has(raw.agent)) ? raw.agent : null;
        const mode = (raw && typeof raw.mode === 'string' && VALID_PIN_MODES.has(raw.mode)) ? raw.mode : 'direct';
        return { agent, mode };
      }
    } catch { /* fall through to defaults */ }
    return { agent: null, mode: 'direct' };
  }

  app.get('/api/warroom/pin', (c) => {
    const { agent, mode } = readPinState();
    return c.json({ ok: true, agent, mode });
  });

  // Kill the warroom Python subprocess so main's respawn logic in
  // src/index.ts brings up a fresh one with whatever config files
  // (voices.json, pin file, etc.) we just wrote. Runs in the background
  // so the HTTP response doesn't block on the respawn.
  async function killWarroomAsync(reason: string): Promise<number[]> {
    try {
      const { spawn } = await import('child_process');
      const pids: number[] = await new Promise((resolve) => {
        const p = spawn('pgrep', ['-f', 'warroom/server.py']);
        let out = '';
        p.stdout.on('data', (chunk) => { out += chunk.toString(); });
        p.on('close', () => {
          resolve(out.trim().split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)));
        });
        p.on('error', () => resolve([]));
      });
      for (const pid of pids) {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
      }
      if (pids.length > 0) {
        logger.info({ pids, reason }, 'Killed warroom subprocess for respawn');
      }
      return pids;
    } catch (err) {
      logger.warn({ err, reason }, 'killWarroomAsync failed');
      return [];
    }
  }

  app.post('/api/warroom/pin', async (c) => {
    let body: { agent?: string; mode?: string; restart?: boolean } = {};
    try { body = await c.req.json(); } catch { /* empty body */ }

    // Pin can update agent, mode, or both. Missing fields preserve
    // the current pin file value. An empty body is a noop but still
    // respawns so the caller can force a reload.
    const current = readPinState();
    const nextAgent = body.agent !== undefined ? body.agent : (current.agent ?? 'main');
    const nextMode = body.mode !== undefined ? body.mode : current.mode;

    if (!VALID_PIN_AGENTS.has(nextAgent)) {
      return c.json({ ok: false, error: 'invalid agent; must be one of main, research, comms, content, ops' }, 400);
    }
    if (!VALID_PIN_MODES.has(nextMode)) {
      return c.json({ ok: false, error: 'invalid mode; must be one of direct, auto' }, 400);
    }

    try {
      fs.writeFileSync(
        WARROOM_PIN_PATH,
        JSON.stringify({ agent: nextAgent, mode: nextMode, pinnedAt: Date.now() }),
        'utf-8',
      );
      // Only respawn the server if the caller says a meeting is active.
      // When no meeting is active, the server picks up the new pin on
      // the next Start Meeting click (the health probe triggers it).
      const needsRestart = body.restart !== false;
      if (needsRestart) {
        killWarroomAsync(`pin changed to agent=${nextAgent} mode=${nextMode}`);
      }
      return c.json({ ok: true, agent: nextAgent, mode: nextMode, respawning: needsRestart });
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  });

  app.post('/api/warroom/unpin', async (c) => {
    try {
      if (fs.existsSync(WARROOM_PIN_PATH)) fs.unlinkSync(WARROOM_PIN_PATH);
      killWarroomAsync('unpin');
      return c.json({ ok: true, agent: null, mode: 'direct', respawning: true });
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  });

  // ── War Room voice configuration ──
  // warroom/voices.json carries two voice identifiers per agent:
  //   - gemini_voice:     Gemini Live's built-in voice name (used in live mode)
  //   - voice_id:         Cartesia voice id (used in legacy stitched mode)
  // The Python server reads this file on startup. After editing via the
  // dashboard, POST /api/warroom/voices/apply kickstarts the main agent so
  // its child warroom process respawns with the new config.
  const WARROOM_VOICES_PATH = path.join(PROJECT_ROOT, 'warroom', 'voices.json');

  // Full Gemini Live voice catalog with one-word style descriptors. Matches
  // the 30 voices supported by the gemini-2.5-flash-native-audio-preview model
  // (and other Gemini TTS-capable models). Sourced from Google's docs.
  const GEMINI_VOICE_CATALOG: Array<{ name: string; style: string }> = [
    { name: 'Zephyr', style: 'Bright' },
    { name: 'Puck', style: 'Upbeat' },
    { name: 'Charon', style: 'Informative' },
    { name: 'Kore', style: 'Firm' },
    { name: 'Fenrir', style: 'Excitable' },
    { name: 'Leda', style: 'Youthful' },
    { name: 'Orus', style: 'Firm' },
    { name: 'Aoede', style: 'Breezy' },
    { name: 'Callirrhoe', style: 'Easy-going' },
    { name: 'Autonoe', style: 'Bright' },
    { name: 'Enceladus', style: 'Breathy' },
    { name: 'Iapetus', style: 'Clear' },
    { name: 'Umbriel', style: 'Easy-going' },
    { name: 'Algieba', style: 'Smooth' },
    { name: 'Despina', style: 'Smooth' },
    { name: 'Erinome', style: 'Clear' },
    { name: 'Algenib', style: 'Gravelly' },
    { name: 'Rasalgethi', style: 'Informative' },
    { name: 'Laomedeia', style: 'Upbeat' },
    { name: 'Achernar', style: 'Soft' },
    { name: 'Alnilam', style: 'Firm' },
    { name: 'Schedar', style: 'Even' },
    { name: 'Gacrux', style: 'Mature' },
    { name: 'Pulcherrima', style: 'Forward' },
    { name: 'Achird', style: 'Friendly' },
    { name: 'Zubenelgenubi', style: 'Casual' },
    { name: 'Vindemiatrix', style: 'Gentle' },
    { name: 'Sadachbia', style: 'Lively' },
    { name: 'Sadaltager', style: 'Knowledgeable' },
    { name: 'Sulafat', style: 'Warm' },
  ];
  const GEMINI_VOICE_NAMES = new Set(GEMINI_VOICE_CATALOG.map((v) => v.name));

  // Default voice assignments for agents that don't have an entry yet.
  // This is how a newly-spawned sub-agent gets a voice without any extra
  // setup. We skip Charon (reserved for main) so new agents always sound
  // distinct from the main voice.
  const NEW_AGENT_VOICE_POOL = [
    'Kore', 'Aoede', 'Leda', 'Alnilam', 'Puck',
    'Fenrir', 'Laomedeia', 'Achird', 'Sulafat', 'Vindemiatrix',
  ];

  function readVoicesFile(): Record<string, { voice_id?: string; gemini_voice?: string; name?: string }> {
    try {
      return JSON.parse(fs.readFileSync(WARROOM_VOICES_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }

  function writeVoicesFile(obj: Record<string, unknown>) {
    fs.writeFileSync(WARROOM_VOICES_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  }

  function pickDefaultGeminiVoice(used: Set<string>): string {
    for (const v of NEW_AGENT_VOICE_POOL) {
      if (!used.has(v)) return v;
    }
    return NEW_AGENT_VOICE_POOL[0];
  }

  app.get('/api/warroom/voices', (c) => {
    const configured = readVoicesFile();
    // Return one row per known agent. Agents missing from voices.json get
    // a default Gemini voice suggestion from the pool so the UI can show
    // something reasonable without requiring the user to save first.
    const knownAgents = ['main', ...listAgentIds().filter((id) => id !== 'main')];
    const usedGeminiVoices = new Set(
      Object.values(configured)
        .map((v) => v && typeof v === 'object' ? (v as { gemini_voice?: string }).gemini_voice : undefined)
        .filter((v): v is string => typeof v === 'string'),
    );
    const rows = knownAgents.map((agent) => {
      const entry = configured[agent] || {};
      let geminiVoice = entry.gemini_voice;
      let isDefault = false;
      if (!geminiVoice) {
        geminiVoice = agent === 'main' ? 'Charon' : pickDefaultGeminiVoice(usedGeminiVoices);
        usedGeminiVoices.add(geminiVoice);
        isDefault = true;
      }
      return {
        agent,
        gemini_voice: geminiVoice,
        voice_id: entry.voice_id || '',
        name: entry.name || '',
        is_default: isDefault,
      };
    });
    return c.json({
      ok: true,
      voices: rows,
      gemini_catalog: GEMINI_VOICE_CATALOG,
    });
  });

  app.post('/api/warroom/voices', async (c) => {
    let body: { updates?: Array<{ agent: string; gemini_voice?: string; voice_id?: string; name?: string }> } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const updates = body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return c.json({ ok: false, error: 'updates must be a non-empty array of {agent, gemini_voice?, voice_id?, name?}' }, 400);
    }

    const configured = readVoicesFile();
    const errors: string[] = [];
    for (const u of updates) {
      if (!u.agent || typeof u.agent !== 'string') {
        errors.push('each update must have an agent id');
        continue;
      }
      const entry = configured[u.agent] || {};
      if (u.gemini_voice !== undefined) {
        if (typeof u.gemini_voice !== 'string' || !GEMINI_VOICE_NAMES.has(u.gemini_voice)) {
          errors.push(`${u.agent}: invalid gemini_voice '${u.gemini_voice}' (must be one of the 30 Gemini voices)`);
          continue;
        }
        entry.gemini_voice = u.gemini_voice;
      }
      if (u.voice_id !== undefined) {
        if (typeof u.voice_id !== 'string') {
          errors.push(`${u.agent}: voice_id must be a string`);
          continue;
        }
        entry.voice_id = u.voice_id;
      }
      if (u.name !== undefined) {
        if (typeof u.name !== 'string') {
          errors.push(`${u.agent}: name must be a string`);
          continue;
        }
        entry.name = u.name;
      }
      configured[u.agent] = entry;
    }
    if (errors.length > 0) {
      return c.json({ ok: false, error: errors.join('; ') }, 400);
    }
    try {
      writeVoicesFile(configured);
      return c.json({ ok: true, voices: configured, applied: false });
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  });

  app.post('/api/warroom/voices/apply', async (c) => {
    // Kill the warroom Python subprocess so main's respawn logic in
    // src/index.ts picks up a fresh one that re-reads voices.json.
    // IMPORTANT: we do NOT kickstart the main launchd service here,
    // because that would kill the dashboard process we're currently
    // running inside — the HTTP response would never be delivered.
    try {
      const { spawn } = await import('child_process');
      // pgrep is simpler than parsing ps. Matches any python process
      // whose command line includes "warroom/server.py".
      const pids: number[] = await new Promise((resolve) => {
        const p = spawn('pgrep', ['-f', 'warroom/server.py']);
        let out = '';
        p.stdout.on('data', (chunk) => { out += chunk.toString(); });
        p.on('close', () => {
          resolve(out.trim().split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)));
        });
        p.on('error', () => resolve([]));
      });
      if (pids.length === 0) {
        return c.json({ ok: false, error: 'no warroom server process found' }, 500);
      }
      for (const pid of pids) {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
      }
      logger.info({ pids }, 'Killed warroom subprocess for voice config reload');
      return c.json({
        ok: true,
        applied: true,
        killed_pids: pids,
        note: 'warroom server will be respawned by the main agent in ~0.5s with fresh voices.json',
      });
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  });

  // Scheduled tasks
  app.get('/api/tasks', (c) => {
    const tasks = getAllScheduledTasks();
    return c.json({ tasks });
  });

  // Delete a scheduled task
  app.delete('/api/tasks/:id', (c) => {
    const id = c.req.param('id');
    deleteScheduledTask(id);
    return c.json({ ok: true });
  });

  // Pause a scheduled task
  app.post('/api/tasks/:id/pause', (c) => {
    const id = c.req.param('id');
    pauseScheduledTask(id);
    return c.json({ ok: true });
  });

  // Resume a scheduled task
  app.post('/api/tasks/:id/resume', (c) => {
    const id = c.req.param('id');
    resumeScheduledTask(id);
    return c.json({ ok: true });
  });

  // ── Mission Control endpoints ────────────────────────────────────────

  app.get('/api/mission/tasks', (c) => {
    const agentId = c.req.query('agent') || undefined;
    const status = c.req.query('status') || undefined;
    const tasks = getMissionTasks(agentId, status);
    return c.json({ tasks });
  });

  app.get('/api/mission/tasks/:id', (c) => {
    const id = c.req.param('id');
    const task = getMissionTask(id);
    if (!task) return c.json({ error: 'Not found' }, 404);
    return c.json({ task });
  });

  app.post('/api/mission/tasks', async (c) => {
    const body = await c.req.json<{
      title?: string;
      prompt?: string;
      assigned_agent?: string;
      priority?: number;
      timeout_ms?: number;
    }>();

    const title = body?.title?.trim();
    const prompt = body?.prompt?.trim();
    const assignedAgent = body?.assigned_agent?.trim() || null;
    const priority = Math.max(0, Math.min(10, body?.priority ?? 0));
    const timeoutMs = body?.timeout_ms ? Math.max(60_000, body.timeout_ms) : null;

    if (!title || title.length > 200) return c.json({ error: 'title required (max 200 chars)' }, 400);
    if (!prompt || prompt.length > 10000) return c.json({ error: 'prompt required (max 10000 chars)' }, 400);

    // Validate agent if provided
    if (assignedAgent) {
      const validAgents = ['main', ...listAgentIds()];
      if (!validAgents.includes(assignedAgent)) {
        return c.json({ error: `Unknown agent: ${assignedAgent}. Valid: ${validAgents.join(', ')}` }, 400);
      }
    }

    const id = crypto.randomBytes(4).toString('hex');
    createMissionTask(id, title, prompt, assignedAgent, 'dashboard', priority, timeoutMs);

    const task = getMissionTask(id);
    return c.json({ task }, 201);
  });

  app.post('/api/mission/tasks/:id/cancel', (c) => {
    const id = c.req.param('id');
    const ok = cancelMissionTask(id);
    return c.json({ ok });
  });

  // Auto-assign a single task via Gemini classification
  app.post('/api/mission/tasks/:id/auto-assign', async (c) => {
    const id = c.req.param('id');
    const task = getMissionTask(id);
    if (!task) return c.json({ error: 'Not found' }, 404);
    if (task.assigned_agent) return c.json({ error: 'Already assigned' }, 400);

    const agent = await classifyTaskAgent(task.prompt);
    if (!agent) return c.json({ error: 'Classification failed' }, 500);

    assignMissionTask(id, agent);
    return c.json({ ok: true, assigned_agent: agent });
  });

  // Auto-assign all unassigned tasks
  app.post('/api/mission/tasks/auto-assign-all', async (c) => {
    const tasks = getUnassignedMissionTasks();
    if (tasks.length === 0) return c.json({ assigned: 0 });

    const results: Array<{ id: string; agent: string }> = [];
    for (const task of tasks) {
      const agent = await classifyTaskAgent(task.prompt);
      if (agent && assignMissionTask(task.id, agent)) {
        results.push({ id: task.id, agent });
      }
    }
    return c.json({ assigned: results.length, results });
  });

  app.patch('/api/mission/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ assigned_agent?: string; timeout_ms?: number }>();

    if (body?.timeout_ms !== undefined) {
      const task = getMissionTask(id);
      if (!task) return c.json({ error: 'Not found' }, 404);
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        return c.json({ error: 'Cannot change timeout on a finished task' }, 422);
      }
      const newTimeout = Math.max(60_000, body.timeout_ms);
      const changed = updateMissionTaskTimeout(id, newTimeout);
      if (!changed) return c.json({ error: 'Task is no longer running' }, 422);
      if (!body?.assigned_agent) return c.json({ ok: true, timeout_ms: newTimeout });
    }

    const newAgent = body?.assigned_agent?.trim();
    if (!newAgent) return c.json({ error: 'assigned_agent required' }, 400);
    const validAgents = ['main', ...listAgentIds()];
    if (!validAgents.includes(newAgent)) return c.json({ error: 'Unknown agent' }, 400);
    const ok = reassignMissionTask(id, newAgent);
    return c.json({ ok });
  });

  app.delete('/api/mission/tasks/:id', (c) => {
    const id = c.req.param('id');
    const ok = deleteMissionTask(id);
    return c.json({ ok });
  });

  app.get('/api/mission/history', (c) => {
    const limit = parseInt(c.req.query('limit') || '30', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    return c.json(getMissionTaskHistory(limit, offset));
  });

  // ── Live Meetings (Pika meet-cli wrapper) ──────────────────────────
  // Three endpoints that shell out to dist/meet-cli.js. Actual join/leave
  // logic lives there so Telegram triggers and the dashboard go through
  // the same code path.

  const MEET_CLI = path.join(PROJECT_ROOT, 'dist', 'meet-cli.js');
  const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+/i;

  // Run meet-cli as a subprocess and parse its final JSON line from stdout.
  async function runMeetCli(args: string[], timeoutMs: number): Promise<{
    ok: boolean;
    data: Record<string, unknown>;
    stderr: string;
    code: number;
  }> {
    if (!fs.existsSync(MEET_CLI)) {
      return { ok: false, data: { error: 'meet-cli not built; run npm run build' }, stderr: '', code: -1 };
    }
    const { spawn } = await import('child_process');
    const proc = spawn(process.execPath, [MEET_CLI, ...args], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    return await new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* ok */ }
      }, timeoutMs);

      proc.on('close', (code: number | null) => {
        clearTimeout(killTimer);
        // meet-cli emits one JSON object on its final stdout line
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
            resolve({ ok: parsed.ok === true, data: parsed, stderr, code: code ?? 1 });
            return;
          } catch { /* try earlier line */ }
        }
        resolve({ ok: false, data: { error: 'no parseable output from meet-cli', stderr: stderr.slice(-400) }, stderr, code: code ?? 1 });
      });
    });
  }

  app.get('/api/meet/sessions', (c) => {
    const active = listActiveMeetSessions();
    const recent = listRecentMeetSessions(15).filter(
      (s: MeetSession) => s.status !== 'joining' && s.status !== 'live',
    );
    return c.json({ ok: true, active, recent });
  });

  app.post('/api/meet/join', async (c) => {
    let body: { agent?: string; meet_url?: string; auto_brief?: boolean; context?: string } = {};
    try { body = await c.req.json(); } catch { /* empty body */ }

    const agent = body.agent?.trim();
    const meetUrl = body.meet_url?.trim();
    const autoBrief = body.auto_brief !== false; // default true
    const context = body.context?.trim();

    if (!agent) return c.json({ ok: false, error: 'agent required' }, 400);
    if (!meetUrl || !MEET_URL_RE.test(meetUrl)) {
      return c.json({ ok: false, error: 'invalid meet_url (must match https://meet.google.com/...)' }, 400);
    }
    const validAgents = new Set(['main', ...listAgentIds()]);
    if (!validAgents.has(agent)) {
      return c.json({ ok: false, error: `unknown agent: ${agent}` }, 400);
    }

    const args = ['join', '--agent', agent, '--meet-url', meetUrl];
    if (autoBrief) args.push('--auto-brief');
    if (context) args.push('--context', context);

    // Budget: auto-brief (up to 75s) + Pika join (up to 120s) + slack = 220s
    const result = await runMeetCli(args, 220_000);
    return c.json(result.data, result.ok ? 200 : 500);
  });

  app.post('/api/meet/join-voice', async (c) => {
    let body: { agent?: string; meet_url?: string; auto_brief?: boolean; context?: string } = {};
    try { body = await c.req.json(); } catch { /* empty body */ }

    const agent = body.agent?.trim();
    const meetUrl = body.meet_url?.trim();
    const autoBrief = body.auto_brief !== false; // default true
    const context = body.context?.trim();

    if (!agent) return c.json({ ok: false, error: 'agent required' }, 400);
    if (!meetUrl || !MEET_URL_RE.test(meetUrl)) {
      return c.json({ ok: false, error: 'invalid meet_url (must match https://meet.google.com/...)' }, 400);
    }
    const validAgents = new Set(['main', ...listAgentIds()]);
    if (!validAgents.has(agent)) {
      return c.json({ ok: false, error: `unknown agent: ${agent}` }, 400);
    }

    const args = ['join-voice', '--agent', agent, '--meet-url', meetUrl];
    if (autoBrief) args.push('--auto-brief');
    if (context) args.push('--context', context);

    // Shorter budget than the avatar path since voice-only skips the
    // Pika upload + worker warmup. Still allows auto-brief to run.
    const result = await runMeetCli(args, 120_000);
    return c.json(result.data, result.ok ? 200 : 500);
  });

  app.post('/api/meet/join-daily', async (c) => {
    let body: { agent?: string; mode?: string; auto_brief?: boolean; context?: string; ttl_sec?: number } = {};
    try { body = await c.req.json(); } catch { /* empty body */ }

    const agent = body.agent?.trim();
    const mode = body.mode?.trim() || 'direct';
    const autoBrief = body.auto_brief !== false; // default true
    const context = body.context?.trim();
    const ttlSec = body.ttl_sec;

    if (!agent) return c.json({ ok: false, error: 'agent required' }, 400);
    if (mode !== 'direct' && mode !== 'auto') {
      return c.json({ ok: false, error: 'mode must be direct or auto' }, 400);
    }
    const validAgents = new Set(['main', ...listAgentIds()]);
    if (!validAgents.has(agent)) {
      return c.json({ ok: false, error: `unknown agent: ${agent}` }, 400);
    }

    const args = ['join-daily', '--agent', agent, '--mode', mode];
    if (autoBrief) args.push('--auto-brief');
    if (context) args.push('--context', context);
    if (typeof ttlSec === 'number' && ttlSec > 0) args.push('--ttl-sec', String(ttlSec));

    // Budget: briefing (~75s) + room creation (~2s) + agent spawn (~3s) = ~90s
    const result = await runMeetCli(args, 120_000);
    return c.json(result.data, result.ok ? 200 : 500);
  });

  app.post('/api/meet/leave', async (c) => {
    let body: { session_id?: string } = {};
    try { body = await c.req.json(); } catch { /* empty body */ }
    const sessionId = body.session_id?.trim();
    if (!sessionId) return c.json({ ok: false, error: 'session_id required' }, 400);
    if (!getMeetSession(sessionId)) {
      return c.json({ ok: false, error: 'session not found' }, 404);
    }
    const result = await runMeetCli(['leave', '--session-id', sessionId], 45_000);
    return c.json(result.data, result.ok ? 200 : 500);
  });

  // Memory stats
  app.get('/api/memories', (c) => {
    const chatId = c.req.query('chatId') || '';
    const stats = getDashboardMemoryStats(chatId);
    const fading = getDashboardLowSalienceMemories(chatId, 10);
    const topAccessed = getDashboardTopAccessedMemories(chatId, 5);
    const timeline = getDashboardMemoryTimeline(chatId, 30);
    const consolidations = getDashboardConsolidations(chatId, 5);
    return c.json({ stats, fading, topAccessed, timeline, consolidations });
  });

  // Memory list (for drill-down drawer)
  app.get('/api/memories/pinned', (c) => {
    const chatId = c.req.query('chatId') || '';
    const memories = getDashboardPinnedMemories(chatId);
    return c.json({ memories });
  });

  app.get('/api/memories/list', (c) => {
    const chatId = c.req.query('chatId') || '';
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const sortBy = (c.req.query('sort') || 'importance') as 'importance' | 'salience' | 'recent';
    const result = getDashboardMemoriesList(chatId, limit, offset, sortBy);
    return c.json(result);
  });

  // System health
  app.get('/api/health', (c) => {
    const chatId = c.req.query('chatId') || '';
    const sessionId = getSession(chatId);
    let contextPct = 0;
    let turns = 0;
    let compactions = 0;
    let sessionAge = '-';

    if (sessionId) {
      const summary = getSessionTokenUsage(sessionId);
      if (summary) {
        turns = summary.turns;
        compactions = summary.compactions;
        const contextTokens = (summary.lastContextTokens || 0) + (summary.lastCacheRead || 0);
        contextPct = contextTokens > 0 ? Math.round((contextTokens / CONTEXT_LIMIT) * 100) : 0;
        const ageSec = Math.floor(Date.now() / 1000) - summary.firstTurnAt;
        if (ageSec < 3600) sessionAge = Math.floor(ageSec / 60) + 'm';
        else if (ageSec < 86400) sessionAge = Math.floor(ageSec / 3600) + 'h';
        else sessionAge = Math.floor(ageSec / 86400) + 'd';
      }
    }

    return c.json({
      contextPct,
      turns,
      compactions,
      sessionAge,
      model: agentDefaultModel || 'sonnet-4-6',
      messengerType: MESSENGER_TYPE,
      messengerConnected: getTelegramConnected(),
      // Back-compat alias — pre-Signal clients still read telegramConnected.
      telegramConnected: getTelegramConnected(),
      waConnected: WHATSAPP_ENABLED,
      slackConnected: !!SLACK_USER_TOKEN,
      // SPA v2 expects this map (Usage/Settings/Sidebar pages call
      // Object.entries on it). Snapshot doesn't have kill-switches.ts yet,
      // so emit an empty object — the pages render nothing under "Kill
      // switches" instead of crashing on Object.entries(undefined).
      killSwitches: {},
    });
  });

  // Token / cost stats
  app.get('/api/tokens', (c) => {
    const chatId = c.req.query('chatId') || '';
    const stats = getDashboardTokenStats(chatId);
    const costTimeline = getDashboardCostTimeline(chatId, 30);
    const recentUsage = getDashboardRecentTokenUsage(chatId, 20);
    return c.json({ stats, costTimeline, recentUsage });
  });

  // Bot info (name, PID, chatId) — reads dynamically from state
  app.get('/api/info', (c) => {
    const chatId = c.req.query('chatId') || '';
    const info = getBotInfo();
    return c.json({
      botName: info.name || 'ClaudeClaw',
      botUsername: info.username || '',
      pid: process.pid,
      chatId: chatId || null,
    });
  });

  // ── Agent endpoints ──────────────────────────────────────────────────

  const agentOrderFile = path.join(STORE_DIR, 'agent-order.json');
  const loadAgentOrder = (): string[] => {
    try {
      const raw = fs.readFileSync(agentOrderFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  };
  const saveAgentOrder = (order: string[]) => {
    fs.writeFileSync(agentOrderFile, JSON.stringify(order, null, 2));
  };
  const applyAgentOrder = (ids: string[]): string[] => {
    const saved = loadAgentOrder();
    const present = new Set(ids);
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const id of saved) {
      if (present.has(id) && !seen.has(id)) { ordered.push(id); seen.add(id); }
    }
    for (const id of ids) {
      if (!seen.has(id)) { ordered.push(id); seen.add(id); }
    }
    return ordered;
  };

  // Persist the visual order of secondary agents (main is always pinned first)
  app.post('/api/agents/order', async (c) => {
    const body = await c.req.json<{ order?: string[] }>();
    const order = body?.order;
    if (!Array.isArray(order) || !order.every((x) => typeof x === 'string')) {
      return c.json({ error: 'order must be an array of agent ids' }, 400);
    }
    const valid = new Set(listAgentIds());
    const filtered = order.filter((id) => id !== 'main' && valid.has(id));
    saveAgentOrder(filtered);
    return c.json({ ok: true, order: filtered });
  });

  // List all configured agents with status
  app.get('/api/agents', (c) => {
    const agentIds = applyAgentOrder(listAgentIds());
    const agents = agentIds.map((id) => {
      try {
        const config = loadAgentConfig(id);
        // Check if agent process is alive via PID file
        // Main agent uses 'claudeclaw.pid'; others use 'agent-<id>.pid'
        const pidFile = path.join(STORE_DIR, id === 'main' ? 'claudeclaw.pid' : `agent-${id}.pid`);
        let running = false;
        if (fs.existsSync(pidFile)) {
          try {
            const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
            process.kill(pid, 0); // signal 0 = check if alive
            running = true;
          } catch { /* process not running */ }
        }
        const stats = getAgentTokenStats(id);
        // Per-agent Telegram state: read from the conn file the agent
        // process writes on setTelegramConnected. Falls back to false
        // when the agent isn't running or hasn't emitted state yet.
        const connState = running ? readAgentConnState(id) : null;
        const telegramConnected = connState?.telegram ?? false;
        return {
          id,
          name: config.name,
          description: config.description,
          model: config.model ?? 'claude-opus-4-6',
          running,
          todayTurns: stats.todayTurns,
          todayCost: stats.todayCost,
          telegramConnected,
        };
      } catch {
        const fallbackName = id.charAt(0).toUpperCase() + id.slice(1);
        return { id, name: fallbackName, description: '', model: 'unknown', running: false, todayTurns: 0, todayCost: 0, telegramConnected: false };
      }
    });

    // Ensure main is first and not duplicated.
    // main-config.json is the source of truth for main's description (editable via dashboard),
    // so override whatever came from agent.yaml or the fallback with getMainDescription().
    const hasMain = agentIds.includes('main');
    let allAgents = agents;
    if (!hasMain) {
      const mainPidFile = path.join(STORE_DIR, 'claudeclaw.pid');
      let mainRunning = false;
      if (fs.existsSync(mainPidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(mainPidFile, 'utf-8').trim(), 10);
          process.kill(pid, 0);
          mainRunning = true;
        } catch { /* not running */ }
      }
      const mainStats = getAgentTokenStats('main');
      // Main runs the dashboard — in-process getTelegramConnected() is
      // authoritative; no need to go through the conn file for main itself.
      const mainTelegramConnected = mainRunning ? getTelegramConnected() : false;
      allAgents = [
        { id: 'main', name: 'Main', description: getMainDescription(), model: 'claude-opus-4-6', running: mainRunning, todayTurns: mainStats.todayTurns, todayCost: mainStats.todayCost, telegramConnected: mainTelegramConnected },
        ...agents,
      ];
    } else {
      // Main was in listAgentIds; its entry came from the loop above and
      // already has a telegramConnected field. Same for sub-agents.
      // Override main's description and — since main runs the dashboard —
      // its telegramConnected from the in-process getter rather than the
      // conn file (which main also writes, but in-process is zero-latency).
      const mainFromLoop = agents.find((a) => a.id === 'main');
      const mainTelegramConnected = mainFromLoop?.running ? getTelegramConnected() : false;
      allAgents = [
        ...agents
          .filter((a) => a.id === 'main')
          .map((a) => ({ ...a, description: getMainDescription(), telegramConnected: mainTelegramConnected })),
        ...agents.filter((a) => a.id !== 'main'),
      ];
    }

    return c.json({ agents: allAgents });
  });

  // Agent-specific recent conversation
  app.get('/api/agents/:id/conversation', (c) => {
    const agentId = c.req.param('id');
    const chatId = c.req.query('chatId') || ALLOWED_CHAT_ID || '';
    const limit = parseInt(c.req.query('limit') || '4', 10);
    const turns = getAgentRecentConversation(agentId, chatId, limit);
    return c.json({ turns });
  });

  // Agent-specific tasks
  app.get('/api/agents/:id/tasks', (c) => {
    const agentId = c.req.param('id');
    const tasks = getAllScheduledTasks(agentId);
    return c.json({ tasks });
  });

  // Agent-specific token stats
  app.get('/api/agents/:id/tokens', (c) => {
    const agentId = c.req.param('id');
    const stats = getAgentTokenStats(agentId);
    return c.json(stats);
  });

  // Update agent description
  app.patch('/api/agents/:id/description', async (c) => {
    const agentId = c.req.param('id');
    const body = await c.req.json<{ description?: string }>();
    const description = body?.description?.trim();
    if (!description) return c.json({ error: 'description required' }, 400);
    if (description.length > 500) return c.json({ error: 'description too long (max 500)' }, 400);

    try {
      if (agentId === 'main') {
        setMainDescription(description);
      } else {
        setAgentDescription(agentId, description);
      }
      return c.json({ ok: true, agent: agentId, description });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to update description' }, 500);
    }
  });

  // Update ALL agent models at once. MUST be registered before the
  // parameterized /:id variant below: Hono matches routes first-win, so
  // if this came second, a PATCH /api/agents/model would match the
  // parameterized route with id="model" and the bulk endpoint would be
  // unreachable (the dashboard "Set all" button was silently a no-op).
  app.patch('/api/agents/model', async (c) => {
    const body = await c.req.json<{ model?: string }>();
    const model = body?.model?.trim();
    if (!model) return c.json({ error: 'model required' }, 400);

    const validModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    if (!validModels.includes(model)) return c.json({ error: `Invalid model` }, 400);

    const agentIds = listAgentIds();
    const updated: string[] = [];
    for (const id of agentIds) {
      try { setAgentModel(id, model); updated.push(id); } catch {}
    }
    return c.json({ ok: true, model, updated });
  });

  // Update agent model
  app.patch('/api/agents/:id/model', async (c) => {
    const agentId = c.req.param('id');
    const body = await c.req.json<{ model?: string }>();
    const model = body?.model?.trim();
    if (!model) return c.json({ error: 'model required' }, 400);

    const validModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    if (!validModels.includes(model)) return c.json({ error: `Invalid model. Valid: ${validModels.join(', ')}` }, 400);

    try {
      if (agentId === 'main') {
        // Main agent uses in-memory override (same as /model command)
        const { setMainModelOverride } = await import('./bot.js');
        setMainModelOverride(model);
      } else {
        setAgentModel(agentId, model);
      }
      return c.json({ ok: true, agent: agentId, model });
    } catch (err) {
      return c.json({ error: 'Failed to update model' }, 500);
    }
  });

  // ── Agent Creation & Management ──────────────────────────────────────

  // List available agent templates
  app.get('/api/agents/templates', (c) => {
    return c.json({ templates: listTemplates() });
  });

  // Validate an agent ID (before creation)
  app.get('/api/agents/validate-id', (c) => {
    const id = c.req.query('id') || '';
    const result = validateAgentId(id);
    const suggestions = id ? suggestBotNames(id) : null;
    return c.json({ ...result, suggestions });
  });

  // Validate a bot token
  app.post('/api/agents/validate-token', async (c) => {
    const body = await c.req.json<{ token?: string }>();
    const token = body?.token?.trim();
    if (!token) return c.json({ ok: false, error: 'token required' }, 400);
    const result = await validateBotToken(token);
    return c.json(result);
  });

  // Create a new agent
  app.post('/api/agents/create', async (c) => {
    const body = await c.req.json<{
      id?: string;
      name?: string;
      description?: string;
      model?: string;
      template?: string;
      botToken?: string;
    }>();

    const id = body?.id?.trim();
    const name = body?.name?.trim();
    const description = body?.description?.trim();
    const botToken = body?.botToken?.trim();

    if (!id) return c.json({ error: 'id required' }, 400);
    if (!name) return c.json({ error: 'name required' }, 400);
    if (!description) return c.json({ error: 'description required' }, 400);
    if (!botToken) return c.json({ error: 'botToken required' }, 400);

    try {
      const result = await createAgent({
        id,
        name,
        description,
        model: body?.model?.trim() || undefined,
        template: body?.template?.trim() || undefined,
        botToken,
      });
      return c.json({ ok: true, ...result }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  // Activate an agent (install service + start)
  app.post('/api/agents/:id/activate', (c) => {
    const agentId = c.req.param('id');
    if (agentId === 'main') return c.json({ error: 'Cannot activate main via this endpoint' }, 400);
    const result = activateAgent(agentId);
    return c.json(result);
  });

  // Deactivate an agent (stop + uninstall service)
  app.post('/api/agents/:id/deactivate', (c) => {
    const agentId = c.req.param('id');
    if (agentId === 'main') return c.json({ error: 'Cannot deactivate main via this endpoint' }, 400);
    const result = deactivateAgent(agentId);
    return c.json(result);
  });

  // Restart an agent (kill + relaunch service)
  app.post('/api/agents/:id/restart', (c) => {
    const agentId = c.req.param('id');
    if (agentId === 'main') return c.json({ error: 'Cannot restart main via this endpoint. Restart the main process manually.' }, 400);
    const result = restartAgent(agentId);
    if (result.ok) {
      return c.json({ ok: true, message: `Agent ${agentId} restarted` });
    }
    return c.json({ error: result.error }, 500);
  });

  // Delete an agent entirely
  app.delete('/api/agents/:id/full', (c) => {
    const agentId = c.req.param('id');
    if (agentId === 'main') return c.json({ error: 'Cannot delete main' }, 400);
    const result = deleteAgent(agentId);
    if (result.ok) {
      return c.json({ ok: true });
    }
    return c.json({ error: result.error }, 500);
  });

  // Check if a specific agent is running
  app.get('/api/agents/:id/status', (c) => {
    const agentId = c.req.param('id');
    return c.json({ running: isAgentRunning(agentId) });
  });

  // ── Security & Audit ─────────────────────────────────────────────────

  app.get('/api/security/status', (c) => {
    return c.json(getSecurityStatus());
  });

  app.get('/api/audit', (c) => {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const agentId = c.req.query('agent') || undefined;
    const entries = getAuditLog(limit, offset, agentId);
    const total = getAuditLogCount(agentId);
    return c.json({ entries, total });
  });

  app.get('/api/audit/blocked', (c) => {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    return c.json({ entries: getRecentBlockedActions(limit) });
  });

  // Hive mind feed
  app.get('/api/hive-mind', (c) => {
    const agentId = c.req.query('agent');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const entries = getHiveMindEntries(limit, agentId || undefined);
    return c.json({ entries });
  });

  // ── Chat endpoints ─────────────────────────────────────────────────

  // SSE stream for real-time chat updates
  app.get('/api/chat/stream', (c) => {
    return streamSSE(c, async (stream) => {
      // Send initial processing state
      const state = getIsProcessing();
      await stream.writeSSE({
        event: 'processing',
        data: JSON.stringify({ processing: state.processing, chatId: state.chatId }),
      });

      // Forward chat events to SSE client
      const handler = async (event: ChatEvent) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        } catch {
          // Client disconnected
        }
      };

      chatEvents.on('chat', handler);

      // Keepalive ping every 30s
      const pingInterval = setInterval(async () => {
        try {
          await stream.writeSSE({ event: 'ping', data: '' });
        } catch {
          clearInterval(pingInterval);
        }
      }, 30_000);

      // Wait until the client disconnects
      try {
        await new Promise<void>((_, reject) => {
          stream.onAbort(() => reject(new Error('aborted')));
        });
      } catch {
        // Expected: client disconnected
      } finally {
        clearInterval(pingInterval);
        chatEvents.off('chat', handler);
      }
    });
  });

  // Chat history (paginated)
  app.get('/api/chat/history', (c) => {
    const chatId = c.req.query('chatId') || '';
    if (!chatId) return c.json({ error: 'chatId required' }, 400);
    const limit = parseInt(c.req.query('limit') || '40', 10);
    const beforeId = c.req.query('beforeId');
    const turns = getConversationPage(chatId, limit, beforeId ? parseInt(beforeId, 10) : undefined);
    return c.json({ turns });
  });

  // Send message from dashboard.
  // If agent_id is omitted or matches the hosting process, run in-process.
  // Otherwise route via the mission-task queue to that agent's process.
  app.post('/api/chat/send', async (c) => {
    if (!botApi) return c.json({ error: 'Bot API not available' }, 503);
    const body = await c.req.json<{ message?: string; agent_id?: string }>();
    const message = body?.message?.trim();
    if (!message) return c.json({ error: 'message required' }, 400);

    const targetAgent = body?.agent_id?.trim() || AGENT_ID;

    // Fire-and-forget: response comes via SSE
    if (targetAgent === AGENT_ID) {
      void processMessageFromDashboard(botApi, message);
    } else {
      dispatchDashboardChatToAgent(message, targetAgent);
    }
    return c.json({ ok: true, agent_id: targetAgent });
  });

  // Abort current processing
  app.post('/api/chat/abort', (c) => {
    const { chatId } = getIsProcessing();
    if (!chatId) return c.json({ ok: false, reason: 'not_processing' });
    const aborted = abortActiveQuery(chatId);
    return c.json({ ok: aborted });
  });


  // ----- parity helper functions (ported from osrepo/main) -----
  function pickerRedirect(chatId: string) {
    const q = new URLSearchParams({ token: DASHBOARD_TOKEN });
    if (chatId) q.set('chatId', chatId);
    return '/warroom?' + q.toString();
  }

  function requireOpenMeeting(meetingId: string) {
    const meeting = getTextMeeting(meetingId);
    if (!meeting) return { error: 'meeting_not_found' as const, status: 404 as const };
    if (meeting.ended_at !== null) return { error: 'meeting_ended' as const, status: 410 as const };
    return { meeting };
  }

  function requireChatMatches(
    meeting: { chat_id: string },
    requestChatId: string,
  ): { ok: true } | { ok: false; error: string; status: 403 } {
    if (meeting.chat_id === '') return { ok: true };
    if (meeting.chat_id === requestChatId) return { ok: true };
    return { ok: false, error: 'chat_mismatch', status: 403 };
  }

  async function endTextMeeting(meetingId: string): Promise<{ alreadyEnded: boolean; entryCount: number }> {
    const meeting = getTextMeeting(meetingId);
    if (!meeting || meeting.ended_at !== null) {
      const rows = meeting ? getWarRoomTranscript(meetingId) : [];
      return { alreadyEnded: true, entryCount: rows.length };
    }
    const rows = getWarRoomTranscript(meetingId);
    endWarRoomMeeting(meetingId, rows.length);
    if (getActiveTurnIds(meetingId).length > 0) {
      cancelMeetingTurns(meetingId);
      await waitForMeetingTurnsIdle(meetingId, 3000);
    }
    // Clear the SDK sessions tied to this meeting. Without this, every
    // meeting leaves orphan rows in the `sessions` table keyed on
    // warroom-text:<meetingId>:<agentId>; the rows can't be looked up
    // again (UUID-fresh meetingIds) but they accumulate forever. Mirror
    // the /clear endpoint's behavior so /end is a true cleanup.
    try {
      const agents = getRoster().map((a) => a.id);
      clearMeetingSessions(meetingId, agents);
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err, meetingId },
        'clearMeetingSessions failed during endTextMeeting (non-fatal)',
      );
    }
    // Notify every connected tab BEFORE we close the channel so they can
    // disable their composers and show the "meeting ended" state.
    const channel = getChannel(meetingId);
    channel.emit({
      type: 'meeting_ended',
      meetingId,
      at: Math.floor(Date.now() / 1000),
    });
    // Close the channel after a short grace period so in-flight SSE
    // writes finish draining to clients.
    setTimeout(() => closeChannel(meetingId), 1500);
    return { alreadyEnded: false, entryCount: rows.length };
  }

  function validateStandupConfigJson(value: string): string | null {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { return 'standup_config: value must be valid JSON'; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'standup_config: value must be a JSON object';
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.agents)) {
      return 'standup_config: agents must be an array';
    }
    for (const a of obj.agents) {
      if (!a || typeof a !== 'object' || typeof (a as { id?: unknown }).id !== 'string') {
        return 'standup_config: each agent entry must be { id: string, enabled?: boolean }';
      }
      const enabled = (a as { enabled?: unknown }).enabled;
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return 'standup_config: agent.enabled must be boolean when present';
      }
    }
    if (typeof obj.maxSpeakers !== 'number' || !Number.isFinite(obj.maxSpeakers)
        || !Number.isInteger(obj.maxSpeakers) || obj.maxSpeakers < 1 || obj.maxSpeakers > 8) {
      return 'standup_config: maxSpeakers must be an integer in [1, 8]';
    }
    return null;
  }

  const ALLOWED_SETTING_KEYS = new Set([
    'workspace_name',
    'hotkey_mod', // 'meta' | 'ctrl' | 'auto'
    'sidebar_collapsed_sections', // JSON array of section ids
    'mission_column_order', // JSON array of agent ids
    'mission_column_widths', // JSON object { id: px }
    // JSON {agents: [{id, enabled}], maxSpeakers}. Drives /standup
    // and /discuss in the text War Room — the user picks who's in,
    // their order, and the cap. Read by pickSlashRoster() in
    // src/warroom-text-orchestrator.ts. UI: web/src/pages/StandupConfig.tsx.
    'standup_config',
  ]);

  const SETTING_VALUE_MAX_BYTES = 4 * 1024;

  const ALLOWED_KILL_SWITCHES = new Set([
    'WARROOM_TEXT_ENABLED',
    'WARROOM_VOICE_ENABLED',
    'LLM_SPAWN_ENABLED',
    'DASHBOARD_MUTATIONS_ENABLED',
    'MISSION_AUTO_ASSIGN_ENABLED',
    'SCHEDULER_ENABLED',
  ]);

  // ===== parity routes ported from osrepo/main (settings, kill-switch, suggestions, war room text) =====
  app.get('/warroom/text', (c) => {
    // Legacy HTML embeds DASHBOARD_TOKEN — gate it inline since the
    // global middleware now only protects /api/*.
    const denied = requireToken(c); if (denied) return denied;
    const chatId = c.req.query('chatId') || '';
    const meetingId = (c.req.query('meetingId') || '').trim();
    const archive = c.req.query('archive') === '1';
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) {
      return c.redirect(pickerRedirect(chatId));
    }
    const existing = getTextMeeting(meetingId);
    if (!existing) {
      return c.redirect(pickerRedirect(chatId));
    }
    if (existing.ended_at !== null && !archive) {
      return c.redirect(pickerRedirect(chatId));
    }
    // Chat-id mismatch: don't render the page (would let a stale meetingId
    // from chat A render under chat B's session). Send them back to the
    // picker for their actual chat. Legacy meetings with chat_id='' bypass
    // this since they pre-date the migration.
    if (existing.chat_id !== '' && existing.chat_id !== chatId) {
      return c.redirect(pickerRedirect(chatId));
    }
    return c.html(getWarRoomTextHtml(DASHBOARD_TOKEN, chatId, meetingId));
  });

  app.get('/api/warroom/text/list', (c) => {
    const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '20', 10) || 20));
    // Optional chat-scope: if the picker passes its current chatId, return
    // only meetings for that chat. Picker without chatId (admin/debug or
    // legacy clients) sees everything.
    const chatIdRaw = c.req.query('chatId');
    const chatId = chatIdRaw !== undefined ? chatIdRaw : undefined;
    return c.json({ ok: true, meetings: getTextMeetings(limit, chatId) });
  });

  app.post('/api/warroom/text/new', async (c) => {
    let body: { chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const chatId = (body.chatId || '').trim();
    const id = `wr_${Math.floor(Date.now() / 1000).toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    createTextMeeting(id, chatId);
    // Prime the channel so the SSE emit for meeting_state has a target.
    getChannel(id);
    // Force-end any prior open text meetings IN THE SAME CHAT so a refresh
    // / new visit starts clean WITHOUT clobbering meetings from other
    // chats sharing the box. Fire-and-forget — DB update is synchronous,
    // only the SSE-emit + cancel-turns wait is async, and the response
    // shouldn't block on those.
    const stale = getOpenTextMeetingIds(id, chatId);
    if (stale.length > 0) {
      logger.info({ closing: stale, newMeetingId: id, chatId }, 'auto-ending stale text meetings on /new');
      for (const sid of stale) {
        void endTextMeeting(sid).catch((err) => {
          logger.warn({
            err: err instanceof Error ? err.message : err,
            staleMeetingId: sid,
          }, 'auto-end of stale meeting failed (non-fatal)');
        });
      }
    }
    return c.json({ ok: true, meetingId: id, autoEnded: stale });
  });

  app.post('/api/warroom/text/warmup', async (c) => {
    if (isWarmupDone()) return c.json({ ok: true, already: true });
    // Don't await — the client doesn't need the result, it just wants
    // the server to have started. The promise resolves in the background.
    void warmupMeeting();
    return c.json({ ok: true, started: true });
  });

  app.get('/api/warroom/text/history', (c) => {
    const meetingId = (c.req.query('meetingId') || '').trim();
    const reqChatId = (c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const meeting = getTextMeeting(meetingId);
    if (!meeting) return c.json({ error: 'meeting_not_found' }, 404);
    const chatGate = requireChatMatches(meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    const limit = Math.max(1, Math.min(500, parseInt(c.req.query('limit') || '200', 10) || 200));
    const beforeTsRaw = c.req.query('beforeTs');
    const beforeIdRaw = c.req.query('beforeId');
    const beforeTs = beforeTsRaw ? parseInt(beforeTsRaw, 10) : undefined;
    const beforeId = beforeIdRaw ? parseInt(beforeIdRaw, 10) : undefined;
    // Capture latestSeq BEFORE the transcript query. If a new row is
    // persisted + emits between these two reads, the transcript query
    // sees the row, and the client connects SSE from a seq that still
    // covers the emit — seenSeqs dedup takes care of duplicates.
    // Reverse order (seq-first, then rows) avoids the opposite race where
    // a row emits after the transcript read but before the seq read,
    // causing the client to advance past a row it never received.
    const latestSeq = getChannel(meetingId).latestSeq();
    const rows = getWarRoomTranscript(meetingId, { limit, beforeTs, beforeId }).reverse();
    return c.json({
      ok: true,
      meetingId,
      transcript: rows,
      pinnedAgent: meeting.pinned_agent,
      meetingStartedAt: meeting.started_at,
      endedAt: meeting.ended_at,
      agents: getRoster(),
      latestSeq,
    });
  });

  app.get('/api/warroom/text/stream', (c) => {
    const meetingId = (c.req.query('meetingId') || '').trim();
    const reqChatId = (c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const meeting = getTextMeeting(meetingId);
    if (!meeting) return c.json({ error: 'meeting_not_found' }, 404);
    const chatGate = requireChatMatches(meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    // Clients that reconnect to an already-ended meeting still get a
    // stream — we emit a meeting_ended event immediately then close. This
    // lets the UI show the ended state instead of silently hanging.
    const sinceSeq = Math.max(0, parseInt(c.req.query('sinceSeq') || '0', 10) || 0);

    return streamSSE(c, async (stream) => {
      const channel = getChannel(meetingId);

      // 1. Send meeting_state snapshot with the current roster + pin so
      //    the client can render without waiting for the next real event.
      const stateEvent = {
        type: 'meeting_state' as const,
        meetingId,
        pinnedAgent: meeting.pinned_agent,
        agents: getRoster(),
        isFresh: meeting.ended_at === null && meeting.entry_count === 0,
      };
      await stream.writeSSE({
        event: 'message',
        data: JSON.stringify({ seq: 0, event: stateEvent }),
      });

      // If the meeting already ended when the client connects, tell them
      // immediately so they can render the ended state instead of hanging.
      if (meeting.ended_at !== null) {
        await stream.writeSSE({
          event: 'message',
          data: JSON.stringify({ seq: 0, event: { type: 'meeting_ended', meetingId, at: meeting.ended_at } }),
        });
        return;
      }

      // 2. Subscribe FIRST so events emitted concurrently with the replay
      //    drain aren't lost in the gap between since() and subscribe().
      //    Writes are serialized through a tiny async queue so rapid
      //    chunks can't reorder (EventEmitter.emit doesn't await our
      //    async handler otherwise).
      const seenSeqs = new Set<number>();
      let writeChain: Promise<void> = Promise.resolve();
      const writeOrdered = (seq: number, event: unknown) => {
        if (seenSeqs.has(seq)) return;
        seenSeqs.add(seq);
        writeChain = writeChain.then(async () => {
          try {
            await stream.writeSSE({
              event: 'message',
              data: JSON.stringify({ seq, event }),
            });
          } catch { /* client disconnected */ }
        });
      };

      const unsub = channel.subscribe((entry) => {
        writeOrdered(entry.seq, entry.event);
      });

      // 3. Detect replay gaps. If the client's sinceSeq is older than the
      //    oldest event we still have in the ring buffer, the replay
      //    would silently drop everything between (sinceSeq, oldestSeq).
      //    Tell the client so it can hard-reload the transcript via
      //    /history instead of rendering an inconsistent stream.
      const oldest = channel.oldestSeq();
      const latest = channel.latestSeq();
      if (sinceSeq > 0 && oldest > 0 && sinceSeq < oldest - 1) {
        await stream.writeSSE({
          event: 'message',
          data: JSON.stringify({
            seq: 0,
            event: { type: 'replay_gap', sinceSeq, oldestSeq: oldest, latestSeq: latest },
          }),
        });
      }

      // 4. Drain the replay window AFTER subscribing. The seenSeqs dedup
      //    set guarantees we never duplicate an event that the live
      //    subscription also caught.
      const missed = channel.since(sinceSeq);
      for (const entry of missed) {
        writeOrdered(entry.seq, entry.event);
      }

      const ping = setInterval(async () => {
        try { await stream.writeSSE({ event: 'ping', data: '' }); }
        catch { clearInterval(ping); }
      }, 30_000);

      try {
        await new Promise<void>((_, reject) => {
          stream.onAbort(() => reject(new Error('aborted')));
        });
      } catch {
        // expected: client disconnected
      } finally {
        clearInterval(ping);
        unsub();
      }
    });
  });

  app.post('/api/warroom/text/send', async (c) => {
    let body: { meetingId?: string; text?: string; clientMsgId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const text = (body.text || '').trim();
    const clientMsgId = (body.clientMsgId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    // DASHBOARD_MUTATIONS_ENABLED + LLM_SPAWN_ENABLED are enforced by
    // global middlewares (mutation middleware above; LLM-spawn refusal
    // happens inside runAgentTurn). Only WARROOM_TEXT_ENABLED is
    // feature-specific and remains here.
    if (!killSwitches.isEnabled('WARROOM_TEXT_ENABLED')) {
      return c.json({ error: 'text war room disabled' }, 503);
    }
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    if (!text) return c.json({ error: 'empty text' }, 400);
    if (text.length > 8000) return c.json({ error: 'text too long (max 8000 chars)' }, 400);
    if (!CLIENT_MSG_ID_RE.test(clientMsgId)) return c.json({ error: 'invalid clientMsgId' }, 400);
    const gate = requireOpenMeeting(meetingId);
    if (gate.error) return c.json({ error: gate.error }, gate.status);
    const chatGate = requireChatMatches(gate.meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);

    // Fire-and-forget through the per-meeting queue. The client learns
    // about progress via SSE. The handleTextTurn call is wrapped in a
    // hard watchdog: if the whole turn takes longer than TURN_BUDGET_MS,
    // we force the queue to unblock so subsequent sends aren't held
    // hostage by a single hung SDK subprocess. The watchdog fires at
    // the queue level (not inside the orchestrator) so even if the
    // orchestrator never returns, the FIFO drains.
    //
    // Budget derivation:
    //   router (20s) + primary (75s)
    //   + 2 × ( intervention gate (25s) + intervener (45s) )
    //   = 235s of agent work,
    //   + ~30s for SDK cold-start + transcript I/O + queue overhead
    //   = ~265s realistic worst case for a healthy long turn.
    // Set TURN_BUDGET_MS to 300_000 so the budget actually clears the
    // worst case by a comfortable margin. The previous 240s was 5s over
    // the bare math, which meant healthy long turns were getting cut
    // off as "took too long".
    const TURN_BUDGET_MS = 300_000;
    messageQueue.enqueue(`warroom-text:${meetingId}`, async () => {
      let finished = false;
      const turnPromise = handleTextTurn(meetingId, text, clientMsgId).finally(() => { finished = true; });
      await Promise.race([
        turnPromise,
        new Promise<void>((resolve) => {
          setTimeout(() => {
            if (finished) return;
            // Timed out. Emit a user-visible error via the channel so the
            // UI unfreezes. Use turn_aborted scoped to the actual active
            // turnId(s) — turn_complete with a synthetic 'watchdog' id
            // can't drive turnId-scoped UI cleanup correctly.
            const ch = getChannel(meetingId);
            ch.emit({
              type: 'system_note',
              text: 'That turn took too long to complete and was interrupted. Send again, or end and restart the meeting if this keeps happening.',
              tone: 'warn',
              dismissable: true,
            });
            const activeTurns = getActiveTurnIds(meetingId);
            for (const tid of activeTurns) {
              ch.emit({ type: 'turn_aborted', turnId: tid, clearedAgents: [] });
              // Mark finalized AFTER emitting turn_aborted so the abort
              // event itself reaches the client. From here on, late SDK
              // chunks/agent_done/transcript writes for this turnId are
              // dropped by the channel — they can't leak into the next
              // queued turn's bubbles.
              ch.markTurnFinalized(tid);
            }
            cancelMeetingTurns(meetingId);
            resolve();
          }, TURN_BUDGET_MS);
        }),
      ]);
      // After the race settles (whether the turn finished cleanly or the
      // watchdog fired), give the orchestrator a brief grace window to
      // finish its async cleanup before we let the next queued turn run.
      // This prevents a half-aborted turn's late agent_done from racing
      // with a freshly-started turn's bubbles.
      if (!finished) {
        await Promise.race([
          turnPromise,
          new Promise<void>((r) => setTimeout(r, 2000)),
        ]);
      }
    });
    return c.json({ ok: true, queued: true });
  });

  app.post('/api/warroom/text/abort', async (c) => {
    let body: { meetingId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const meeting = getTextMeeting(meetingId);
    if (!meeting) return c.json({ error: 'meeting_not_found' }, 404);
    const chatGate = requireChatMatches(meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    const count = cancelMeetingTurns(meetingId);
    return c.json({ ok: true, cancelled: count });
  });

  app.post('/api/warroom/text/pin', async (c) => {
    let body: { meetingId?: string; agentId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const agentId = (body.agentId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const rosterIds = new Set(getRoster().map((a) => a.id));
    if (!rosterIds.has(agentId)) return c.json({ error: 'unknown agent' }, 400);
    const gate = requireOpenMeeting(meetingId);
    if (gate.error) return c.json({ error: gate.error }, gate.status);
    const chatGate = requireChatMatches(gate.meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    setMeetingPin(meetingId, agentId);
    // Tell every connected tab so the pin indicator stays in sync
    // without a reload. Without this, tabs that didn't initiate the
    // pin click rendered the wrong roster state until they reconnected.
    getChannel(meetingId).emit({ type: 'meeting_state_update', pinnedAgent: agentId });
    return c.json({ ok: true, meetingId, pinnedAgent: agentId });
  });

  app.post('/api/warroom/text/unpin', async (c) => {
    let body: { meetingId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const gate = requireOpenMeeting(meetingId);
    if (gate.error) return c.json({ error: gate.error }, gate.status);
    const chatGate = requireChatMatches(gate.meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    setMeetingPin(meetingId, null);
    getChannel(meetingId).emit({ type: 'meeting_state_update', pinnedAgent: null });
    return c.json({ ok: true, meetingId, pinnedAgent: null });
  });

  app.post('/api/warroom/text/clear', async (c) => {
    let body: { meetingId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const gate = requireOpenMeeting(meetingId);
    if (gate.error) return c.json({ error: gate.error }, gate.status);
    const chatGate = requireChatMatches(gate.meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    // Cancel any in-flight turn FIRST and wait for it to exit before we
    // wipe sessions. Otherwise runAgentTurn's setSession() can land after
    // clearMeetingSessions() and resurrect the cleared session id, leaving
    // the user with "memory cleared" UX but the agent still resuming the
    // prior thread.
    if (getActiveTurnIds(meetingId).length > 0) {
      cancelMeetingTurns(meetingId);
      await waitForMeetingTurnsIdle(meetingId, 5000);
    }
    const agents = getRoster().map((a) => a.id);
    const cleared = clearMeetingSessions(meetingId, agents);
    // Persist the divider so reload still shows the marker. Speaker
    // __divider__ is handled client-side to render as a dashed divider.
    addWarRoomTranscript(meetingId, '__divider__', 'Memory cleared — agents start fresh from here');
    const channel = getChannel(meetingId);
    channel.emit({
      type: 'divider',
      kind: 'memory_cleared',
      text: 'Memory cleared — agents start fresh from here',
    });
    channel.emit({
      type: 'system_note',
      text: 'Sessions cleared. Next message starts fresh.',
      tone: 'info',
      dismissable: true,
    });
    return c.json({ ok: true, cleared });
  });

  app.post('/api/warroom/text/end', async (c) => {
    let body: { meetingId?: string; chatId?: string } = {};
    try { body = await c.req.json(); } catch { /* empty */ }
    const meetingId = (body.meetingId || '').trim();
    const reqChatId = (body.chatId || c.req.query('chatId') || '').trim();
    if (!WARROOM_TEXT_ID_RE.test(meetingId)) return c.json({ error: 'invalid meetingId' }, 400);
    const meeting = getTextMeeting(meetingId);
    if (!meeting) return c.json({ error: 'meeting_not_found' }, 404);
    const chatGate = requireChatMatches(meeting, reqChatId);
    if (!chatGate.ok) return c.json({ error: chatGate.error }, chatGate.status);
    const result = await endTextMeeting(meetingId);
    if (result.alreadyEnded) {
      return c.json({ ok: true, meetingId, alreadyEnded: true });
    }
    return c.json({ ok: true, meetingId, entryCount: result.entryCount });
  });

  app.get('/api/agents/suggestions', (c) => {
    return c.json({ suggestions: listActiveAgentSuggestions() });
  });

  app.post('/api/agents/suggestions/refresh', async (c) => {
    const liveAgents = ['main', ...listAgentIds()];
    const agentMeta: Array<{ id: string; description: string; rawCount: number; recentSummaries: string[] }> = [];
    for (const id of liveAgents) {
      let description = '';
      if (id !== 'main') {
        try { description = loadAgentConfig(id).description || ''; } catch { /* skip */ }
      } else {
        description = 'Primary ClaudeClaw bot — general triage and routing';
      }
      const entries = getHiveMindEntries(200, id);
      const allFiltered = entries
        .map((e) => `[${e.action}] ${e.summary}`)
        .filter((s) => s.length > 0);
      // Sample evenly across the agent's last 200 entries, picking 12
      // representative summaries. We want diversity (different domains,
      // not just the latest cluster) without bloating the prompt past
      // Haiku's comfort zone — total prompt with 6 agents × 12
      // summaries × ~80 chars stays under ~2 KB and typically completes
      // in 15–25s.
      const target = 12;
      const recentSummaries = allFiltered.length <= target
        ? allFiltered
        : allFiltered.filter((_, i) => i % Math.ceil(allFiltered.length / target) === 0).slice(0, target);
      agentMeta.push({ id, description, rawCount: allFiltered.length, recentSummaries });
    }

    // Skip agents with too little signal — splitting an agent that's
    // done 5 things isn't useful, and Haiku will hallucinate splits.
    const eligible = agentMeta.filter((a) => a.rawCount >= 20);
    if (eligible.length === 0) {
      return c.json({ ok: true, suggestions: [], reason: 'not enough hive_mind activity to analyze' });
    }

    const recentlySuggested = new Set(
      getRecentlySuggestedSplits(30).map((r) => `${r.from_agent}::${r.suggested_id}`),
    );

    // Prompt: "for each agent, is one doing many distinct domains?"
    // Constrain the model to suggest AT MOST one split per agent and
    // require activity_share_pct so the user knows whether the
    // suggestion is meaningful (a 5%-share split isn't worth doing).
    const promptParts = [
      'You analyze a multi-agent system to spot when an agent has drifted into doing many distinct things and should be split.',
      '',
      'For each agent below, decide: is there ONE coherent sub-domain handling >= 25% of their recent activity that would benefit from being its own specialized agent? Only suggest a split when the new agent would have a clean scope and the parent agent would be more focused after the split.',
      '',
      'Return JSON with this exact shape:',
      '{ "suggestions": [{ "from_agent": "<id>", "suggested_id": "<lowercase-id>", "suggested_name": "<Title Case>", "suggested_description": "<one-sentence scope, 80 chars max>", "reasoning": "<why now, 200 chars max>", "activity_share_pct": <integer 0-100> }] }',
      '',
      'Rules:',
      '- suggested_id must be lowercase letters, numbers, hyphens; not match an existing agent.',
      '- Suggest at most one split per from_agent.',
      '- Skip suggestions where activity_share_pct < 25.',
      '- If no agent needs splitting, return { "suggestions": [] }.',
      '',
      'Agents:',
    ];
    for (const a of eligible) {
      promptParts.push('');
      promptParts.push(`AGENT: ${a.id}`);
      promptParts.push(`DESCRIPTION: ${a.description || '(no description)'}`);
      promptParts.push('RECENT ACTIVITY:');
      for (const s of a.recentSummaries) {
        promptParts.push(`  - ${s}`);
      }
    }
    const existingIds = new Set(liveAgents);

    let raw = '';
    const promptStr = promptParts.join('\n');
    logger.info({ promptBytes: promptStr.length, agentCount: eligible.length }, 'agent suggestion: starting analysis');
    const t0 = Date.now();
    try {
      // 120s timeout — the dashboard process spawns the SDK subprocess
      // alongside its own busy event loop (war-room polling, memory
      // ingest, scheduler). Cold-starts under load have measured up to
      // 90s in practice, vs 4–5s for a standalone CLI call with the
      // same prompt size. Better to wait than fail spuriously.
      raw = await extractViaClaude(promptStr, 120_000);
      logger.info({ elapsedMs: Date.now() - t0, responseBytes: raw.length }, 'agent suggestion: Haiku replied');
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : err, elapsedMs: Date.now() - t0 }, 'agent suggestion analysis failed');
      return c.json({ error: 'analysis failed (Haiku unavailable)' }, 503);
    }
    const parsed = parseJsonResponse<{ suggestions: any[] }>(raw);
    const list = Array.isArray(parsed?.suggestions) ? parsed!.suggestions : [];

    let inserted = 0;
    let skipped = 0;
    for (const s of list) {
      if (!s || typeof s !== 'object') { skipped++; continue; }
      const fromAgent = String(s.from_agent || '').trim();
      const suggestedId = String(s.suggested_id || '').trim().toLowerCase();
      const suggestedName = String(s.suggested_name || '').trim();
      const suggestedDescription = String(s.suggested_description || '').trim();
      const reasoning = String(s.reasoning || '').trim();
      const sharePct = Math.max(0, Math.min(100, Math.round(Number(s.activity_share_pct) || 0)));

      if (!fromAgent || !existingIds.has(fromAgent)) { skipped++; continue; }
      if (!/^[a-z0-9-]{2,32}$/.test(suggestedId)) { skipped++; continue; }
      if (existingIds.has(suggestedId)) { skipped++; continue; }
      if (!suggestedName || !suggestedDescription || !reasoning) { skipped++; continue; }
      if (sharePct < 25) { skipped++; continue; }
      // Don't re-suggest the exact same split we already proposed in
      // the last 30 days (whether dismissed or still active).
      if (recentlySuggested.has(`${fromAgent}::${suggestedId}`)) { skipped++; continue; }

      insertAgentSuggestion({
        from_agent: fromAgent,
        suggested_id: suggestedId,
        suggested_name: suggestedName,
        suggested_description: suggestedDescription.slice(0, 200),
        reasoning: reasoning.slice(0, 500),
        activity_share_pct: sharePct,
      });
      inserted++;
    }
    insertAuditLog('main', '', 'agent_suggestion_refresh', `inserted=${inserted} skipped=${skipped}`, false);
    return c.json({ ok: true, inserted, skipped, suggestions: listActiveAgentSuggestions() });
  });

  app.post('/api/agents/suggestions/:id/dismiss', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);
    const ok = dismissAgentSuggestion(id);
    if (!ok) return c.json({ error: 'not found or already dismissed' }, 404);
    insertAuditLog('main', '', 'agent_suggestion_dismiss', `id=${id}`, false);
    return c.json({ ok: true });
  });

  app.post('/api/agents/suggestions/:id/acted', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);
    const ok = markAgentSuggestionActed(id);
    if (!ok) return c.json({ error: 'not found or already acted' }, 404);
    insertAuditLog('main', '', 'agent_suggestion_acted', `id=${id}`, false);
    return c.json({ ok: true });
  });

  app.get('/api/dashboard/settings', (c) => {
    return c.json(getAllDashboardSettings());
  });

  app.patch('/api/dashboard/settings', async (c) => {
    const body = await c.req.json().catch(() => null) as { key?: string; value?: string } | null;
    if (!body || typeof body.key !== 'string' || typeof body.value !== 'string') {
      return c.json({ error: 'expected { key: string, value: string }' }, 400);
    }
    if (!ALLOWED_SETTING_KEYS.has(body.key)) {
      return c.json({ error: `unknown setting key: ${body.key}` }, 400);
    }
    if (Buffer.byteLength(body.value, 'utf8') > SETTING_VALUE_MAX_BYTES) {
      return c.json({ error: `value exceeds ${SETTING_VALUE_MAX_BYTES} bytes` }, 400);
    }
    if (body.key === 'standup_config') {
      const err = validateStandupConfigJson(body.value);
      if (err) return c.json({ error: err }, 400);
    }
    // Workspace name has its own length cap so the sidebar layout stays
    // sane. Strip control chars + zero-width joiners; trim whitespace.
    let value = body.value;
    if (body.key === 'workspace_name') {
      value = value.replace(/[\u0000-\u001f\u200b-\u200d\ufeff]/g, '').trim();
      if (value.length > 32) value = value.slice(0, 32);
    }
    setDashboardSetting(body.key, value);
    insertAuditLog('main', '', 'dashboard_setting_change', `${body.key}=${value.slice(0, 80)}`, false);
    return c.json({ ok: true, key: body.key, value });
  });

  app.post('/api/security/kill-switch', async (c) => {
    const body = await c.req.json<{ key?: string; enabled?: boolean }>();
    const key = body?.key;
    const enabled = body?.enabled;
    if (!key || typeof enabled !== 'boolean') {
      return c.json({ error: 'key (string) and enabled (boolean) required' }, 400);
    }
    if (!ALLOWED_KILL_SWITCHES.has(key)) {
      return c.json({ error: 'unknown kill switch: ' + key }, 400);
    }
    try {
      const envPath = path.join(PROJECT_ROOT, '.env');
      const { setEnvKey } = await import('./env-write.js');
      setEnvKey(envPath, key, enabled ? 'true' : 'false');
      logger.info({ key, enabled }, 'Kill switch toggled via dashboard');
      return c.json({ ok: true, key, enabled });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'Failed to write .env: ' + msg }, 500);
    }
  });

  startChannelSweeper();

  let server: ReturnType<typeof serve>;
  try {
    server = serve({ fetch: app.fetch, port: DASHBOARD_PORT }, () => {
      logger.info({ port: DASHBOARD_PORT }, 'Dashboard server running');
    });
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      logger.error({ port: DASHBOARD_PORT }, 'Dashboard port already in use. Change DASHBOARD_PORT in .env or kill the process using port %d.', DASHBOARD_PORT);
    } else {
      logger.error({ err }, 'Dashboard server failed to start');
    }
    return;
  }

  // ── WebSocket proxy: /ws/warroom → localhost:WARROOM_PORT ──────────
  // Allows the War Room to work through a single Cloudflare tunnel on
  // the dashboard port. Without this, remote/mobile users can't reach
  // the Python WebSocket server on port 7860.
  if (WARROOM_ENABLED) {
    void import('ws').then((wsModule: any) => {
    const WS = wsModule.default?.WebSocket ?? wsModule.WebSocket;
    const WSServer = wsModule.default?.WebSocketServer ?? wsModule.WebSocketServer;

    if (WSServer) {
      const wss = new WSServer({ noServer: true });

      (server as unknown as import('http').Server).on('upgrade', (
        req: import('http').IncomingMessage,
        socket: import('stream').Duplex,
        head: Buffer,
      ) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        if (url.pathname !== '/ws/warroom') return;

        // Token-gate the War Room WebSocket upgrade (audit fix, ported from
        // osrepo PR #51). Without this, anyone who can reach the dashboard
        // port could proxy into the local Pipecat War Room socket with no
        // auth and burn Gemini Live credits or eavesdrop on transcripts.
        const token = url.searchParams.get('token');
        if (!safeTokenEqual(token, DASHBOARD_TOKEN)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (clientWs: any) => {
          const remote = new WS(`ws://127.0.0.1:${WARROOM_PORT}`);
          let remoteReady = false;
          const buffered: (Buffer | ArrayBuffer | string)[] = [];

          remote.on('open', () => {
            remoteReady = true;
            for (const msg of buffered) remote.send(msg);
            buffered.length = 0;
          });
          remote.on('message', (data: Buffer | ArrayBuffer | string) => {
            if (clientWs.readyState === 1) clientWs.send(data);
          });
          remote.on('close', () => clientWs.close());
          remote.on('error', (err: Error) => {
            logger.warn({ err }, 'War Room WS proxy: remote error');
            try { clientWs.close(1011, 'War Room server error'); } catch { /* ok */ }
          });

          clientWs.on('message', (data: Buffer | ArrayBuffer | string) => {
            if (remoteReady) remote.send(data);
            else buffered.push(data);
          });
          clientWs.on('close', () => {
            if (remote.readyState <= 1) remote.close();
          });
        });
      });

      logger.info('War Room WebSocket proxy active at /ws/warroom');
    }
    }).catch((err: unknown) => {
      logger.warn({ err }, 'Could not set up War Room WS proxy');
    });
  }
}
