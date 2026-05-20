#!/usr/bin/env node
/**
 * ClaudeClaw Meet CLI
 *
 * Wraps the Pika pikastream-video-meeting skill so agents can send
 * themselves (or another agent) into a Google Meet / Zoom call as a
 * real-time AI avatar. Resolves each agent's avatar from warroom/avatars
 * and their voice_id / bot name from agent.yaml.
 *
 * Usage:
 *   node dist/meet-cli.js join --agent main --meet-url <url> [--brief <file>] [--bot-name <name>]
 *   node dist/meet-cli.js leave --session-id <id>
 *   node dist/meet-cli.js list [--active]
 *   node dist/meet-cli.js show --session-id <id>
 *
 * On join success, the CLI prints JSON:
 *   {"ok": true, "session_id": "...", "agent": "main", "meet_url": "...", "status": "live"}
 *
 * On join failure:
 *   {"ok": false, "error": "..."}
 *
 * Requires PIKA_DEV_KEY in the environment (or project .env).
 * Spawns the vendored Python script at skills/pikastream-video-meeting/scripts/pikastreaming_videomeeting.py
 * using the warroom venv's Python interpreter (the only venv we know has
 * requests installed).
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import {
  initDatabase,
  createMeetSession,
  markMeetSessionLive,
  markMeetSessionLeft,
  markMeetSessionFailed,
  getMeetSession,
  listActiveMeetSessions,
  listRecentMeetSessions,
  type MeetSession,
} from './db.js';
import { loadAgentConfig, listAgentIds } from './agent-config.js';
import { readEnvFile } from './env.js';
import { createRoom as dailyCreateRoom, deleteRoom as dailyDeleteRoom, DailyApiError } from './daily-client.js';

initDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const PIKA_SCRIPT = path.join(
  PROJECT_ROOT,
  'skills',
  'pikastream-video-meeting',
  'scripts',
  'pikastreaming_videomeeting.py',
);
const WARROOM_VENV_PY = path.join(PROJECT_ROOT, 'warroom', '.venv', 'bin', 'python');
const VOICE_BRIDGE_JS = path.join(PROJECT_ROOT, 'dist', 'agent-voice-bridge.js');
const DAILY_AGENT_PY = path.join(PROJECT_ROOT, 'warroom', 'daily_agent.py');
const DAILY_AGENT_LOG_DIR = '/tmp';
const AVATARS_DIR = path.join(PROJECT_ROOT, 'warroom', 'avatars');
const DEFAULT_VOICE_ID = 'English_radiant_girl'; // Pika preset, per SKILL.md

// How long we're willing to wait for the briefing to complete before
// falling back to a minimal brief. Briefing runs through the full Claude
// Code stack with MCP + skills (gmail, calendar, obsidian) so it needs
// more than the ANSWER_TIMEOUT from warroom. 75s is the hard ceiling.
const BRIEF_TIMEOUT_SEC = Number(process.env.MEET_BRIEF_TIMEOUT ?? '75');

function die(msg: string, code = 1): never {
  console.log(JSON.stringify({ ok: false, error: msg }));
  process.exit(code);
}

function fail(obj: Record<string, unknown>): never {
  console.log(JSON.stringify({ ok: false, ...obj }));
  process.exit(1);
}

function ok(obj: Record<string, unknown>): void {
  console.log(JSON.stringify({ ok: true, ...obj }));
}

// Parse a --flag value pair out of argv, returning the value or undefined.
function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

// Boolean flag (present = true)
function boolFlag(name: string): boolean {
  return process.argv.includes(name);
}

function resolveAvatarPath(agentId: string): string | null {
  // Prefer a meet-specific variant (e.g. main-meet.png) so each agent
  // can have a human-looking face for Pika calls separate from its
  // stylized warroom sidebar avatar. Falls back to the generic avatar
  // if no -meet variant exists.
  const candidates = [
    path.join(AVATARS_DIR, `${agentId}-meet.png`),
    path.join(AVATARS_DIR, `${agentId}-meet.jpg`),
    path.join(AVATARS_DIR, `${agentId}-meet.jpeg`),
    path.join(AVATARS_DIR, `${agentId}.png`),
    path.join(AVATARS_DIR, `${agentId}.jpg`),
    path.join(AVATARS_DIR, `${agentId}.jpeg`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const st = fs.statSync(p);
        if (st.size > 1024) return p;
      } catch { /* fall through */ }
    }
  }
  return null;
}

function resolvePikaDevKey(): string | null {
  // Environment wins. Fall back to project .env so the CLI works when
  // invoked by a bare agent subprocess that hasn't inherited the main
  // process env.
  if (process.env.PIKA_DEV_KEY) return process.env.PIKA_DEV_KEY;
  const fromEnv = readEnvFile(['PIKA_DEV_KEY', 'PIKA_API_KEY']);
  return fromEnv.PIKA_DEV_KEY || fromEnv.PIKA_API_KEY || null;
}

interface AgentResolved {
  agentId: string;
  botName: string;
  voiceId: string;
  imagePath: string | null;
}

function resolveAgent(agentId: string): AgentResolved {
  // "main" is a pseudo-agent that uses the project root, not an
  // agents/ dir. It has no agent.yaml but the other defaults still apply.
  let botName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
  let voiceId = DEFAULT_VOICE_ID;

  if (agentId !== 'main') {
    try {
      const cfg = loadAgentConfig(agentId);
      if (cfg.meetBotName) botName = cfg.meetBotName;
      else if (cfg.name) botName = cfg.name;
      if (cfg.meetVoiceId) voiceId = cfg.meetVoiceId;
    } catch (err) {
      // Non-fatal: use defaults. Logged to stderr so the user can debug.
      process.stderr.write(`[meet-cli] loadAgentConfig(${agentId}) failed: ${err}\n`);
    }
  }

  const imagePath = resolveAvatarPath(agentId);
  return { agentId, botName, voiceId, imagePath };
}

// Run the Pika Python script and return its parsed stdout JSON.
async function runPikaScript(args: string[], timeoutSec = 90): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  parsed: Record<string, unknown> | null;
}> {
  if (!fs.existsSync(PIKA_SCRIPT)) {
    throw new Error(`Pika script not found at ${PIKA_SCRIPT}`);
  }
  if (!fs.existsSync(WARROOM_VENV_PY)) {
    throw new Error(
      `Warroom venv python not found at ${WARROOM_VENV_PY}. Create it with: ` +
      `python3 -m venv warroom/.venv && warroom/.venv/bin/pip install -r warroom/requirements.txt`,
    );
  }

  const devKey = resolvePikaDevKey();
  if (!devKey) {
    throw new Error('PIKA_DEV_KEY not set. Get one at https://www.pika.me/dev/ and add to .env');
  }

  // Strip CLAUDECODE* env vars so the Pika subprocess doesn't inherit
  // a wrapping Claude Code session's env (same pitfall that bit the
  // voice bridge — documented in feedback_warroom_pitfalls.md #2).
  const env: Record<string, string | undefined> = { ...process.env, PIKA_DEV_KEY: devKey };
  for (const k of [
    'CLAUDECODE',
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_EXECPATH',
    'CLAUDE_CODE_SSE_PORT',
    'CLAUDE_CODE_IPC_PORT',
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  ]) {
    delete env[k];
  }

  return await new Promise((resolve) => {
    const proc = spawn(WARROOM_VENV_PY, [PIKA_SCRIPT, ...args], {
      cwd: PROJECT_ROOT,
      env: env as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    const killTimer = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* ok */ }
    }, timeoutSec * 1000);

    proc.on('close', (code: number | null) => {
      clearTimeout(killTimer);
      let parsed: Record<string, unknown> | null = null;
      // The Pika script prints a JSON object on the LAST line of stdout
      // when it succeeds. Older/errored runs may print nothing parseable.
      const lines = stdout.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(lines[i]);
          break;
        } catch { /* keep searching */ }
      }
      resolve({ code: code ?? 1, stdout, stderr, parsed });
    });
  });
}

// Hard-coded speaking rules appended to every brief (both rich and
// minimal). These drive the single biggest latency lever: LLM output
// length. Pika's pipeline runs STT → LLM → TTS → avatar video render on
// every turn; shorter outputs cut TTS + render time proportionally.
// Keeping this under ~450 chars so it doesn't bloat the system prompt.
const SPEAKING_RULES_FOOTER = [
  '',
  '---',
  'SPEAKING RULES (never break):',
  '- ONE sentence per response. TWO sentences maximum, ever.',
  '- No preamble. No "let me check", "great question", "absolutely", "certainly".',
  '- No em dashes. No AI cliches.',
  '- If asked something you need to research, say "one sec" and stop talking.',
  '- If asked for a long answer or detailed list, say "I will follow up with details after the call" and stop.',
  '- Conversational, warm, direct. Never formal.',
  '- If you do not know, say "I do not know" plainly. Do not invent.',
].join('\n');

// Synthesize a rich pre-flight brief for a meeting by delegating to the
// agent's full Claude Code stack (MCP, skills, memory) via the existing
// agent-voice-bridge. Returns the path to the brief file, or a minimal
// fallback brief if the deep research times out.
async function synthesizeBrief(params: {
  agentId: string;
  meetUrl: string;
  contextHint?: string;
  briefId: string;
}): Promise<{ path: string; fallback: boolean; content: string }> {
  const briefPath = `/tmp/meeting_brief_${params.briefId}.txt`;

  if (!fs.existsSync(VOICE_BRIDGE_JS)) {
    const fallback = buildMinimalBrief(params);
    fs.writeFileSync(briefPath, fallback, 'utf-8');
    return { path: briefPath, fallback: true, content: fallback };
  }

  // The briefing prompt. Tight and aggressive because every character
  // in the output becomes part of the system prompt Pika's LLM processes
  // on every single conversation turn. The whole card must stay under
  // ~800 chars for decent response latency.
  const briefingPrompt = [
    `You are building the pre-flight reference card for a live video meeting. The agent will be a video avatar in the call, so EVERY EXTRA CHARACTER in your output costs real-time latency on every turn. Be ruthlessly concise.`,
    ``,
    `Meeting URL: ${params.meetUrl}`,
    params.contextHint ? `Context hint from the user: ${params.contextHint}` : '',
    ``,
    `Quick research (use your tools, do not invent facts):`,
    `1. Calendar: today + next 24h, find event matching this URL, capture attendees + title.`,
    `2. Gmail: for each non-owner attendee, skim last 30 days of messages. Note the gist.`,
    `3. Memory/vault: pull any salient facts about attendees or topic. Skip if nothing found.`,
    ``,
    `Write the reference card in EXACTLY this format. No other text. Stay under 800 characters total:`,
    ``,
    `**Meeting**: [one sentence]`,
    `**Attendees**: [name - one fact each, max 3 people]`,
    `**Context**: [1-3 bullets, concrete only]`,
    `**User wants**: [one sentence]`,
    ``,
    `If you find nothing for a field, omit it. No padding, no "likely questions", no "response guidelines" (those get appended separately). Return ONLY the card.`,
  ].filter(Boolean).join('\n');

  try {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn(process.execPath, [VOICE_BRIDGE_JS, '--agent', params.agentId, '--chat-id', `meet-brief-${params.briefId}`, '--message', briefingPrompt], {
        cwd: PROJECT_ROOT,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      const killTimer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* ok */ }
      }, BRIEF_TIMEOUT_SEC * 1000);
      proc.on('close', (code: number | null) => {
        clearTimeout(killTimer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });

    if (result.code === 0) {
      try {
        // Voice bridge emits one JSON object on stdout. Parse it and
        // extract the response field.
        const lines = result.stdout.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (parsed && typeof parsed.response === 'string' && parsed.response.trim()) {
              // Append the hard-coded speaking rules so Pika's LLM sees
              // them on every turn regardless of how the briefing agent
              // formatted the card.
              const content = parsed.response.trim() + SPEAKING_RULES_FOOTER;
              fs.writeFileSync(briefPath, content, 'utf-8');
              return { path: briefPath, fallback: false, content };
            }
            break;
          } catch { /* try earlier line */ }
        }
      } catch (err) {
        process.stderr.write(`[meet-cli] brief parse failed: ${err}\n`);
      }
    } else {
      process.stderr.write(`[meet-cli] voice bridge exited ${result.code}: ${result.stderr.slice(0, 300)}\n`);
    }
  } catch (err) {
    process.stderr.write(`[meet-cli] brief synthesis failed: ${err}\n`);
  }

  // Fallback: minimal brief so the meeting can still start. Speaking
  // rules are baked into buildMinimalBrief so the footer is already
  // part of the content — no double-append needed.
  const fallback = buildMinimalBrief(params);
  fs.writeFileSync(briefPath, fallback, 'utf-8');
  return { path: briefPath, fallback: true, content: fallback };
}

function buildMinimalBrief(params: { agentId: string; meetUrl: string; contextHint?: string }): string {
  // Kept tiny on purpose. Speaking rules footer carries the real
  // instructions; this is just the scene-setting. Total ~200 chars
  // before the footer.
  const lines = [
    `**Meeting**: Ad-hoc call, ${params.agentId} agent representing the user.`,
  ];
  if (params.contextHint) {
    lines.push(`**Context from user**: ${params.contextHint}`);
  }
  return lines.join('\n') + SPEAKING_RULES_FOOTER;
}

// ── Subcommands ──────────────────────────────────────────────────────

async function cmdBrief(): Promise<void> {
  const agentId = flag('--agent') ?? 'main';
  const meetUrl = flag('--meet-url');
  const contextHint = flag('--context');
  if (!meetUrl) die('--meet-url required');

  const knownAgents = new Set(['main', ...listAgentIds()]);
  if (!knownAgents.has(agentId)) {
    die(`unknown agent: ${agentId}. Known: ${[...knownAgents].join(', ')}`);
  }

  const briefId = `${agentId}_${Date.now()}`;
  const result = await synthesizeBrief({ agentId, meetUrl, contextHint, briefId });

  ok({
    agent: agentId,
    meet_url: meetUrl,
    brief_path: result.path,
    fallback: result.fallback,
    length: result.content.length,
  });
}

async function cmdJoin(): Promise<void> {
  const agentId = flag('--agent') ?? 'main';
  const meetUrl = flag('--meet-url');
  let briefPath = flag('--brief');
  const overrideBotName = flag('--bot-name');
  const overrideVoiceId = flag('--voice-id');
  const meetingPassword = flag('--meeting-password');
  const autoBrief = boolFlag('--auto-brief');
  const contextHint = flag('--context');

  if (!meetUrl) die('--meet-url required');

  const knownAgents = new Set(['main', ...listAgentIds()]);
  if (!knownAgents.has(agentId)) {
    die(`unknown agent: ${agentId}. Known: ${[...knownAgents].join(', ')}`);
  }

  const resolved = resolveAgent(agentId);
  const botName = overrideBotName ?? resolved.botName;
  const voiceId = overrideVoiceId ?? resolved.voiceId;

  if (!resolved.imagePath) {
    die(
      `No avatar found for agent '${agentId}'. Expected one of: ` +
      `${AVATARS_DIR}/${agentId}.png|jpg|jpeg (must be > 1KB)`,
    );
  }

  // --auto-brief runs the pre-flight briefing pipeline inline before
  // the join. We stay silent on stdout because the final join result
  // is what matters; briefing telemetry goes to stderr for debugging.
  if (autoBrief && !briefPath) {
    const briefId = `auto_${agentId}_${Date.now()}`;
    process.stderr.write(`[meet-cli] auto-brief: synthesizing pre-flight brief (budget ${BRIEF_TIMEOUT_SEC}s)\n`);
    const briefResult = await synthesizeBrief({ agentId, meetUrl, contextHint, briefId });
    briefPath = briefResult.path;
    process.stderr.write(
      `[meet-cli] auto-brief: ${briefResult.fallback ? 'FALLBACK minimal brief' : 'full brief'} ` +
      `(${briefResult.content.length} chars) at ${briefPath}\n`,
    );
  }

  if (briefPath && !fs.existsSync(briefPath)) {
    die(`brief file not found: ${briefPath}`);
  }

  const pikaArgs: string[] = [
    'join',
    '--meet-url', meetUrl,
    '--bot-name', botName,
    '--image', resolved.imagePath,
    '--voice-id', voiceId,
  ];
  if (briefPath) pikaArgs.push('--system-prompt-file', briefPath);
  if (meetingPassword) pikaArgs.push('--meeting-password', meetingPassword);

  // Pika's default join timeout is 90s. We give subprocess 120s total.
  const result = await runPikaScript(pikaArgs, 120);

  if (result.code !== 0) {
    // Funding insufficient (exit 6) carries a checkout_url in the JSON.
    if (result.code === 6 && result.parsed && typeof result.parsed['checkout_url'] === 'string') {
      fail({
        error: 'insufficient Pika credits',
        checkout_url: result.parsed['checkout_url'],
        message: 'Top up your Pika account at the checkout URL, then retry.',
      });
    }
    const errMsg = result.stderr.trim().split('\n').pop() || `pika script exited ${result.code}`;
    fail({ error: errMsg.slice(0, 500), code: result.code });
  }

  const sessionId = result.parsed && typeof result.parsed['session_id'] === 'string'
    ? (result.parsed['session_id'] as string)
    : null;

  if (!sessionId) {
    fail({ error: 'pika script returned no session_id', stdout: result.stdout.slice(-300) });
  }

  try {
    createMeetSession({
      id: sessionId!,
      agentId,
      meetUrl,
      botName,
      voiceId,
      imagePath: resolved.imagePath,
      briefPath: briefPath ?? null,
    });
    markMeetSessionLive(sessionId!);
  } catch (err) {
    // DB logging failure should not fail the whole join — the bot is
    // already in the meeting. Log to stderr and continue.
    process.stderr.write(`[meet-cli] db insert failed: ${err}\n`);
  }

  ok({
    session_id: sessionId,
    agent: agentId,
    meet_url: meetUrl,
    bot_name: botName,
    voice_id: voiceId,
    status: 'live',
  });
}

async function cmdJoinDaily(): Promise<void> {
  // Daily.co mode. Creates a fresh Daily room via REST, spawns the
  // Pipecat daily_agent.py process to join that room, returns the room
  // URL so the caller can share it with whoever they want to meet. The
  // bot runs its own process per meeting and self-terminates when the
  // room empties or expires.
  const agentId = flag('--agent') ?? 'main';
  let briefPath = flag('--brief');
  const overrideBotName = flag('--bot-name');
  const mode = flag('--mode') ?? 'direct';
  const autoBrief = boolFlag('--auto-brief');
  const contextHint = flag('--context');
  const roomName = flag('--room-name'); // optional custom name, otherwise Daily auto-generates
  const ttlSec = flag('--ttl-sec') ? parseInt(flag('--ttl-sec')!, 10) : undefined;

  const knownAgents = new Set(['main', ...listAgentIds()]);
  if (!knownAgents.has(agentId)) {
    die(`unknown agent: ${agentId}. Known: ${[...knownAgents].join(', ')}`);
  }
  if (mode !== 'direct' && mode !== 'auto') {
    die(`invalid mode: ${mode}. Expected direct or auto.`);
  }

  // Check GOOGLE_API_KEY so we fail fast before spawning the Python
  // process. The Daily agent needs Gemini Live.
  const env = readEnvFile(['GOOGLE_API_KEY']);
  if (!process.env.GOOGLE_API_KEY && !env.GOOGLE_API_KEY) {
    die('GOOGLE_API_KEY not set. Gemini Live is required for the Daily agent pipeline.');
  }

  const resolved = resolveAgent(agentId);
  const botName = overrideBotName ?? resolved.botName;

  if (!fs.existsSync(DAILY_AGENT_PY)) {
    die(`daily_agent.py not found at ${DAILY_AGENT_PY}`);
  }
  if (!fs.existsSync(WARROOM_VENV_PY)) {
    die(
      `warroom venv python not found at ${WARROOM_VENV_PY}. Create it with: ` +
      `python3 -m venv warroom/.venv && warroom/.venv/bin/pip install -r warroom/requirements.txt`,
    );
  }

  // Optional pre-flight brief. Same code path as Pika cmdJoin.
  if (autoBrief && !briefPath) {
    const briefId = `daily_${agentId}_${Date.now()}`;
    process.stderr.write(`[meet-cli] auto-brief: synthesizing pre-flight brief (budget ${BRIEF_TIMEOUT_SEC}s)\n`);
    const briefResult = await synthesizeBrief({
      agentId,
      meetUrl: 'pending-daily-room',
      contextHint,
      briefId,
    });
    briefPath = briefResult.path;
    process.stderr.write(
      `[meet-cli] auto-brief: ${briefResult.fallback ? 'FALLBACK minimal brief' : 'full brief'} ` +
      `(${briefResult.content.length} chars) at ${briefPath}\n`,
    );
  }

  if (briefPath && !fs.existsSync(briefPath)) {
    die(`brief file not found: ${briefPath}`);
  }

  // Create the Daily room via REST
  let room;
  try {
    room = await dailyCreateRoom({
      name: roomName,
      ttlSec,
    });
  } catch (err) {
    if (err instanceof DailyApiError) {
      fail({ error: err.message, status: err.status });
    }
    fail({ error: err instanceof Error ? err.message : String(err) });
  }

  process.stderr.write(`[meet-cli] Created Daily room: ${room!.url}\n`);

  // Insert the session row BEFORE spawning the agent. The id is
  // Daily's room id so we can cross-reference.
  try {
    createMeetSession({
      id: room!.id,
      agentId,
      meetUrl: room!.url,
      botName,
      platform: 'daily',
      provider: 'daily',
      briefPath: briefPath ?? null,
    });
    markMeetSessionLive(room!.id);
  } catch (err) {
    process.stderr.write(`[meet-cli] db insert failed: ${err}\n`);
  }

  // Spawn the Python agent detached so this CLI can exit cleanly
  // while the meeting continues. Log stdout+stderr to a per-session
  // file so the user can tail it when debugging.
  const logPath = path.join(DAILY_AGENT_LOG_DIR, `daily-agent-${room!.id}.log`);
  let logFd: number | null = null;
  try { logFd = fs.openSync(logPath, 'a'); } catch { /* non-fatal */ }

  const agentArgs = [
    DAILY_AGENT_PY,
    '--room-url', room!.url,
    '--agent', agentId,
    '--mode', mode,
    '--bot-name', botName,
  ];
  if (briefPath) agentArgs.push('--brief', briefPath);

  // Strip CLAUDECODE* env vars so the Pipecat python subprocess doesn't
  // inherit a wrapping Claude Code session's env.
  const subEnv: Record<string, string | undefined> = { ...process.env };
  for (const k of [
    'CLAUDECODE',
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_EXECPATH',
    'CLAUDE_CODE_SSE_PORT',
    'CLAUDE_CODE_IPC_PORT',
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  ]) {
    delete subEnv[k];
  }

  const child = spawn(WARROOM_VENV_PY, agentArgs, {
    cwd: PROJECT_ROOT,
    env: subEnv as NodeJS.ProcessEnv,
    detached: true,
    stdio: ['ignore', logFd ?? 'ignore', logFd ?? 'ignore'],
  });
  child.unref();

  process.stderr.write(`[meet-cli] Spawned daily_agent pid=${child.pid}, log=${logPath}\n`);

  ok({
    session_id: room!.id,
    room_name: room!.name,
    room_url: room!.url,
    agent: agentId,
    mode,
    bot_name: botName,
    status: 'live',
    log_path: logPath,
    expires_at: room!.config.exp ?? null,
  });
}

async function cmdLeave(): Promise<void> {
  const sessionId = flag('--session-id');
  if (!sessionId) die('--session-id required');

  const existing = getMeetSession(sessionId);
  if (!existing) die(`no session found: ${sessionId}`);

  // Daily.co sessions are created via daily-client.createRoom and run as
  // a detached Python Pipecat subprocess inside a Daily room. Leaving
  // must delete the room via the Daily API -- the old code unconditionally
  // routed through the Pika leave script, so Daily rooms leaked until
  // their TTL expired (up to 2 hours) and kept billing the account.
  if (existing.provider === 'daily') {
    try {
      await dailyDeleteRoom(existing.id);
      markMeetSessionLeft(sessionId, null);
      ok({ session_id: sessionId, status: 'left', provider: 'daily' });
      return;
    } catch (err) {
      const errMsg = err instanceof DailyApiError || err instanceof Error
        ? err.message
        : String(err);
      markMeetSessionFailed(sessionId, errMsg);
      fail({ error: errMsg.slice(0, 500), provider: 'daily' });
    }
  }

  const result = await runPikaScript(['leave', '--session-id', sessionId], 30);
  if (result.code !== 0) {
    const errMsg = result.stderr.trim().split('\n').pop() || `pika script exited ${result.code}`;
    markMeetSessionFailed(sessionId, errMsg);
    fail({ error: errMsg.slice(0, 500), code: result.code });
  }

  // Pika may include post-meeting notes in the leave response on newer
  // versions. Capture them if present.
  const postNotes = result.parsed && typeof result.parsed['notes'] === 'string'
    ? (result.parsed['notes'] as string)
    : null;
  markMeetSessionLeft(sessionId, postNotes);

  ok({ session_id: sessionId, status: 'left', notes: postNotes });
}

function cmdList(): void {
  const activeOnly = boolFlag('--active');
  const sessions: MeetSession[] = activeOnly
    ? listActiveMeetSessions()
    : listRecentMeetSessions(20);

  if (sessions.length === 0) {
    ok({ sessions: [], count: 0 });
    return;
  }

  ok({
    count: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      agent: s.agent_id,
      bot_name: s.bot_name,
      meet_url: s.meet_url,
      status: s.status,
      created_at: s.created_at,
      joined_at: s.joined_at,
      left_at: s.left_at,
      error: s.error,
    })),
  });
}

function cmdShow(): void {
  const sessionId = flag('--session-id');
  if (!sessionId) die('--session-id required');
  const s = getMeetSession(sessionId);
  if (!s) die(`no session found: ${sessionId}`);
  ok({ session: s });
}

// ── Dispatcher ───────────────────────────────────────────────────────

const command = process.argv[2];

function printHelp(): void {
  process.stderr.write(`ClaudeClaw Meet CLI

Commands:
  join        Pika avatar mode. Bot joins with a real-time AI avatar.
              --agent <id> --meet-url <url> [--brief <file>] [--auto-brief]
              [--context <hint>] [--bot-name <name>] [--voice-id <id>]
              [--meeting-password <pw>]
  join-daily  Daily.co mode. Creates a new Daily.co room, spawns a
              Pipecat agent in it, returns the room URL to share.
              Full speech-to-speech via Gemini Live, tool calling via
              answer_as_agent. Fastest path, no tunnel needed.
              --agent <id> [--mode direct|auto] [--brief <file>]
              [--auto-brief] [--context <hint>] [--bot-name <name>]
              [--room-name <slug>] [--ttl-sec <seconds>]
              (Requires DAILY_API_KEY and GOOGLE_API_KEY in .env)
  brief       Pre-flight research pipeline. Writes a system prompt file
              to /tmp/meeting_brief_*.txt using the agent's full stack.
              --agent <id> --meet-url <url> [--context <hint>]
  leave       --session-id <id>
  list        [--active]
  show        --session-id <id>

Pika avatar files: warroom/avatars/<agent>-meet.(png|jpg|jpeg), falling
back to <agent>.png. voice_id defaults to the Pika preset ${DEFAULT_VOICE_ID}
if agent.yaml has no meet_voice_id field. Briefing budget: ${BRIEF_TIMEOUT_SEC}s.
`);
}

(async () => {
  try {
    switch (command) {
      case 'join':
        await cmdJoin();
        break;
      case 'join-daily':
        await cmdJoinDaily();
        break;
      case 'brief':
        await cmdBrief();
        break;
      case 'leave':
        await cmdLeave();
        break;
      case 'list':
        cmdList();
        break;
      case 'show':
        cmdShow();
        break;
      case '--help':
      case '-h':
      case undefined:
        printHelp();
        process.exit(command ? 0 : 1);
        break;
      default:
        die(`unknown command: ${command}. Run --help for usage.`);
    }
  } catch (err) {
    fail({ error: err instanceof Error ? err.message : String(err) });
  }
})();
