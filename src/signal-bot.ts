import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

import { runAgentWithRetry, AgentProgressEvent } from './agent.js';
import { AgentError } from './errors.js';
import {
  AGENT_ID,
  AGENT_TIMEOUT_MS,
  DASHBOARD_PORT,
  DASHBOARD_TOKEN,
  DASHBOARD_URL,
  EXFILTRATION_GUARD_ENABLED,
  MODEL_FALLBACK_CHAIN,
  PROJECT_ROOT,
  PROTECTED_ENV_VARS,
  SHOW_COST_FOOTER,
  SIGNAL_AUTHORIZED_RECIPIENTS,
  SIGNAL_PHONE_NUMBER,
  SIGNAL_RPC_HOST,
  SIGNAL_RPC_PORT,
  SMART_ROUTING_CHEAP_MODEL,
  SMART_ROUTING_ENABLED,
  agentDefaultModel,
  agentMcpAllowlist,
  agentSystemPrompt,
} from './config.js';
import { buildCostFooter } from './cost-footer.js';
import {
  clearSession,
  getRecentMemories,
  getRecentTaskOutputs,
  getSession,
  pinMemory,
  setSession,
  unpinMemory,
} from './db.js';
import { scanForSecrets, redactSecrets } from './exfiltration-guard.js';
import { logger } from './logger.js';
import {
  MEMORY_NUDGE_TEXT,
  buildMemoryContext,
  evaluateMemoryRelevance,
  saveConversationTurn,
  shouldNudgeMemory,
} from './memory.js';
import { classifyMessageComplexity } from './message-classifier.js';
import { messageQueue } from './message-queue.js';
import { delegateToAgent, parseDelegation } from './orchestrator.js';
import {
  audit,
  checkKillPhrase,
  executeEmergencyKill,
  getSecurityStatus,
  isLocked,
  lock,
  touchActivity,
  unlock,
} from './security.js';
import { SignalIncomingMessage, SignalRpcClient } from './signal-rpc.js';
import { emitChatEvent, setActiveAbort, setProcessing } from './state.js';
import { synthesizeSpeech, transcribeAudio, voiceCapabilities } from './voice.js';

// Signal has no hard upper bound like Telegram's 4096, but very long single
// messages render poorly on mobile. Split at this size.
const SIGNAL_MAX_MESSAGE_LENGTH = 4000;

// Typing indicators on Signal expire after ~15s.
const SIGNAL_TYPING_REFRESH_MS = 10_000;

// Per-chat model override, same pattern as bot.ts. Signal only has one
// authorized sender in personal-use mode, but the map is future-proof.
const chatModelOverride = new Map<string, string>();

// Per-chat voice-reply preference. Three states:
//   'on'    → always reply as TTS, even for typed prompts
//   'off'   → never reply as TTS, even for voice notes (hard-mute)
//   unset   → default: mirror the incoming modality — voice-in ⇒ voice-out,
//             text-in ⇒ text-out
// Toggled via /voice on|off. Resets on bot restart.
const voiceMode = new Map<string, 'on' | 'off'>();

/**
 * Write a Buffer to a temp file with the given suffix and return its path.
 * Caller is responsible for cleanup.
 */
function writeTempFile(buffer: Buffer, suffix: string): string {
  const p = path.join(os.tmpdir(), `claudeclaw-signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}`);
  fs.writeFileSync(p, buffer);
  return p;
}

/** Best-effort unlink — logs warnings instead of throwing. */
function tryUnlink(p: string): void {
  try { fs.unlinkSync(p); } catch (err) { logger.warn({ err, path: p }, 'tmp unlink failed'); }
}

/** Map a signal-cli audio contentType to its on-disk file extension. */
function audioExtFromContentType(contentType: string | undefined): string {
  if (!contentType) return '';
  if (contentType.includes('aac')) return '.aac';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return '.mp3';
  if (contentType.includes('ogg') || contentType.includes('opus')) return '.ogg';
  if (contentType.includes('wav')) return '.wav';
  if (contentType.includes('m4a') || contentType.includes('mp4')) return '.m4a';
  return '';
}

/**
 * Groq Whisper's /audio/transcriptions only accepts
 *   flac, mp3, mp4, mpeg, mpga, m4a, ogg, opus, wav, webm
 * Signal voice notes arrive as raw AAC (.aac). AAC is the native codec for
 * .m4a containers, so we just wrap (no re-encode, ~lossless + milliseconds)
 * via `ffmpeg -i in.aac -c copy out.m4a` and feed the m4a to Groq.
 *
 * Returns the path to a transcription-ready file. If conversion fails or
 * the input is already a Groq-friendly format, returns the input path.
 */
async function ensureTranscribableAudio(inputPath: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  const groqFriendly = new Set(['.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.opus', '.wav', '.webm']);
  if (groqFriendly.has(ext)) return inputPath;

  const outputPath = path.join(os.tmpdir(), `claudeclaw-signal-audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.m4a`);
  try {
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inputPath, '-c', 'copy', outputPath]);
    return outputPath;
  } catch (err) {
    logger.warn({ err, inputPath }, 'ffmpeg copy-to-m4a failed, falling back to original path');
    return inputPath;
  }
}

/**
 * Resolve a signal-cli attachment to its on-disk path. Daemon versions
 * that don't surface the `path` field in the receive envelope still
 * write blobs to `$XDG_DATA_HOME/signal-cli/attachments/<id>[.ext]`.
 * Returns the first candidate that actually exists on disk, or null.
 */
function resolveSignalAttachmentPath(att: { id: string; contentType?: string }): string | null {
  const xdgHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const dir = path.join(xdgHome, 'signal-cli', 'attachments');
  const ext = audioExtFromContentType(att.contentType);
  const candidates = [
    path.join(dir, att.id + ext),
    path.join(dir, att.id),
    // Older signal-cli layouts used ~/.config/signal-cli instead.
    path.join(os.homedir(), '.config', 'signal-cli', 'attachments', att.id + ext),
    path.join(os.homedir(), '.config', 'signal-cli', 'attachments', att.id),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Is this sender allowed to talk to the bot? */
function isAuthorised(sourceNumber: string): boolean {
  if (SIGNAL_AUTHORIZED_RECIPIENTS.length === 0) {
    // No allowlist configured — fall back to the daemon's own account only.
    return sourceNumber === SIGNAL_PHONE_NUMBER;
  }
  return SIGNAL_AUTHORIZED_RECIPIENTS.includes(sourceNumber);
}

/** Split a long response so Signal doesn't render one giant wall of text. */
function splitMessage(text: string): string[] {
  if (text.length <= SIGNAL_MAX_MESSAGE_LENGTH) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > SIGNAL_MAX_MESSAGE_LENGTH) {
    const chunk = remaining.slice(0, SIGNAL_MAX_MESSAGE_LENGTH);
    const lastNewline = chunk.lastIndexOf('\n');
    const splitAt = lastNewline > SIGNAL_MAX_MESSAGE_LENGTH / 2 ? lastNewline : SIGNAL_MAX_MESSAGE_LENGTH;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

interface FileMarker {
  type: 'document' | 'photo';
  filePath: string;
  caption?: string;
}

/** Extract [SEND_FILE:...] and [SEND_PHOTO:...] markers. Same shape as bot.ts. */
function extractFileMarkers(text: string): { text: string; files: FileMarker[] } {
  const files: FileMarker[] = [];
  const pattern = /\[SEND_(FILE|PHOTO):([^\]\|]+)(?:\|([^\]]*))?\]/g;
  const cleaned = text.replace(pattern, (_, kind: string, filePath: string, caption?: string) => {
    files.push({
      type: kind === 'PHOTO' ? 'photo' : 'document',
      filePath: filePath.trim(),
      caption: caption?.trim() || undefined,
    });
    return '';
  });
  return { text: cleaned.replace(/\n{3,}/g, '\n\n').trim(), files };
}

const AVAILABLE_MODELS: Record<string, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-5',
  haiku: 'claude-haiku-4-5',
};

export interface SignalBot {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** For outside code (e.g. scheduler / memory callbacks) to push messages. */
  sendTo(recipient: string, text: string): Promise<void>;
}

/**
 * Create the Signal bot. Does NOT connect yet — call `start()` to open the
 * socket and begin receiving messages.
 */
export function createSignalBot(): SignalBot {
  if (!SIGNAL_PHONE_NUMBER) {
    throw new Error(
      'SIGNAL_PHONE_NUMBER not set in .env. Link signal-cli first, then configure it.',
    );
  }

  const rpc = new SignalRpcClient({
    host: SIGNAL_RPC_HOST,
    port: SIGNAL_RPC_PORT,
    account: SIGNAL_PHONE_NUMBER,
  });

  const primaryRecipient = SIGNAL_AUTHORIZED_RECIPIENTS[0] ?? SIGNAL_PHONE_NUMBER;

  const sendMessage = async (recipient: string, text: string): Promise<void> => {
    // Plain text — Signal has no markdown rendering outside bold/italic with
    // asterisks/underscores and no HTML parse mode. Send verbatim.
    for (const part of splitMessage(text)) {
      try {
        await rpc.send(recipient, part);
      } catch (err) {
        logger.error({ err, recipientMasked: recipient.slice(0, 5) + '***' }, 'signal send failed');
        // Don't throw — a dropped message should not crash the receive loop.
      }
    }
  };

  const sendFile = async (recipient: string, filePath: string, caption?: string): Promise<void> => {
    if (!fs.existsSync(filePath)) {
      await sendMessage(recipient, `Could not send file: ${filePath} (not found)`);
      return;
    }
    try {
      await rpc.sendWithAttachments(recipient, caption ?? '', [filePath]);
    } catch (err) {
      logger.error({ err, filePath }, 'signal file send failed');
      await sendMessage(recipient, `Failed to send file: ${filePath}`);
    }
  };

  const sendTyping = async (recipient: string): Promise<void> => {
    try {
      await rpc.sendTyping(recipient);
    } catch {
      // Best-effort only.
    }
  };

  /**
   * Core message handler — ported from bot.ts handleMessage() for Signal.
   *
   * @param forceVoiceReply  When true, the reply is ALWAYS sent as a TTS
   *   voice note (used when the user sent a voice message). Independent of
   *   the per-chat /voice toggle.
   */
  async function handleTextMessage(
    incoming: SignalIncomingMessage,
    message: string,
    forceVoiceReply = false,
  ): Promise<void> {
    const chatId = incoming.sourceNumber;

    // Emergency kill works even when locked.
    if (checkKillPhrase(message)) {
      audit({ agentId: AGENT_ID, chatId, action: 'kill', detail: 'Emergency kill via Signal', blocked: false });
      await sendMessage(chatId, 'EMERGENCY KILL activated. All agents stopping.');
      executeEmergencyKill();
      return;
    }

    // PIN lock gate.
    if (isLocked()) {
      if (unlock(message)) {
        audit({ agentId: AGENT_ID, chatId, action: 'unlock', detail: 'PIN accepted', blocked: false });
        await sendMessage(chatId, 'Unlocked. Session active.');
      } else {
        audit({ agentId: AGENT_ID, chatId, action: 'blocked', detail: 'Session locked, wrong PIN', blocked: true });
        await sendMessage(chatId, 'Session locked. Send your PIN to unlock.');
      }
      return;
    }

    touchActivity();
    audit({ agentId: AGENT_ID, chatId, action: 'message', detail: message.slice(0, 200), blocked: false });
    emitChatEvent({ type: 'user_message', chatId, content: message, source: 'signal' });

    // Delegation (@agent or /delegate) — same parser as bot.ts.
    const delegation = parseDelegation(message);
    if (delegation) {
      setProcessing(chatId, true);
      void sendTyping(chatId);
      try {
        const result = await delegateToAgent(
          delegation.agentId,
          delegation.prompt,
          chatId,
          AGENT_ID,
          async (progressMsg) => {
            emitChatEvent({ type: 'progress', chatId, description: progressMsg });
            await sendMessage(chatId, progressMsg);
          },
        );
        const text = result.text?.trim() || 'Agent completed with no output.';
        const header = `[${result.agentId} — ${Math.round(result.durationMs / 1000)}s]`;
        saveConversationTurn(chatId, delegation.prompt, text, undefined, delegation.agentId);
        emitChatEvent({ type: 'assistant_message', chatId, content: text, source: 'signal' });
        await sendMessage(chatId, `${header}\n\n${text}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, agentId: delegation.agentId }, 'Delegation failed');
        await sendMessage(chatId, `Delegation to ${delegation.agentId} failed: ${msg}`);
      } finally {
        setProcessing(chatId, false);
      }
      return;
    }

    // Main agent path — build memory context, pick model, run, reply.
    const sessionId = getSession(chatId, AGENT_ID);
    const { contextText: memCtx, surfacedMemoryIds, surfacedMemorySummaries } = await buildMemoryContext(chatId, message, AGENT_ID);

    const parts: string[] = [];
    if (agentSystemPrompt && !sessionId) {
      parts.push(`[Agent role — follow these instructions]\n${agentSystemPrompt}\n[End agent role]`);
    }
    if (memCtx) parts.push(memCtx);

    const recentTasks = getRecentTaskOutputs(AGENT_ID, 30);
    if (recentTasks.length > 0) {
      const taskLines = recentTasks.map((t) => {
        const ago = Math.round((Date.now() / 1000 - t.last_run) / 60);
        return `[Scheduled task ran ${ago}m ago]\nTask: ${t.prompt}\nOutput:\n${t.last_result}`;
      });
      parts.push(`[Recent scheduled task context]\n${taskLines.join('\n\n')}\n[End task context]`);
    }

    if (shouldNudgeMemory(chatId, AGENT_ID)) parts.push(MEMORY_NUDGE_TEXT);
    parts.push(message);

    const userModel = chatModelOverride.get(chatId) ?? agentDefaultModel;
    const effectiveModel = (SMART_ROUTING_ENABLED && !userModel && classifyMessageComplexity(message) === 'simple')
      ? SMART_ROUTING_CHEAP_MODEL
      : (userModel ?? 'claude-opus-4-6');

    void sendTyping(chatId);
    const typingInterval = setInterval(() => void sendTyping(chatId), SIGNAL_TYPING_REFRESH_MS);
    setProcessing(chatId, true);

    try {
      const onProgress = (event: AgentProgressEvent): void => {
        emitChatEvent({ type: 'progress', chatId, description: event.description });
        // Signal has no edit-message, so progress notifications become new
        // messages. Only surface task boundaries — tool_active would flood.
        if (event.type === 'task_started') void sendMessage(chatId, `🔄 ${event.description}`);
        if (event.type === 'task_completed') void sendMessage(chatId, `✓ ${event.description}`);
      };

      const abortCtrl = new AbortController();
      setActiveAbort(chatId, abortCtrl);
      const timeoutId = setTimeout(() => {
        logger.warn({ chatId, timeoutMs: AGENT_TIMEOUT_MS }, 'Agent query timed out (Signal)');
        abortCtrl.abort();
      }, AGENT_TIMEOUT_MS);

      const fullMessage = parts.join('\n\n');

      const result = await runAgentWithRetry(
        fullMessage,
        sessionId,
        () => void sendTyping(chatId),
        onProgress,
        effectiveModel,
        abortCtrl,
        /* onStreamText */ undefined,
        async (attempt, error) => {
          await sendMessage(chatId, `${error.recovery.userMessage} (retry ${attempt}/2)`);
        },
        MODEL_FALLBACK_CHAIN.length > 0 ? MODEL_FALLBACK_CHAIN : undefined,
        agentMcpAllowlist,
      );

      clearTimeout(timeoutId);
      clearInterval(typingInterval);
      setActiveAbort(chatId, null);

      if (result.aborted) {
        setProcessing(chatId, false);
        const msg = result.text === null
          ? `Timed out after ${Math.round(AGENT_TIMEOUT_MS / 1000)}s. Raise AGENT_TIMEOUT_MS in your .env (default is 1800000 = 30 min) and restart, or break the task into smaller steps.`
          : 'Stopped.';
        emitChatEvent({ type: 'assistant_message', chatId, content: msg, source: 'signal' });
        await sendMessage(chatId, msg);
        return;
      }

      if (result.newSessionId) setSession(chatId, result.newSessionId, AGENT_ID);

      let rawResponse = result.text?.trim() || 'Done.';

      // Exfiltration guard — same behaviour as bot.ts.
      if (EXFILTRATION_GUARD_ENABLED) {
        const protectedValues = PROTECTED_ENV_VARS
          .map((key) => process.env[key])
          .filter((v): v is string => !!v && v.length > 8);
        const matches = scanForSecrets(rawResponse, protectedValues);
        if (matches.length > 0) {
          rawResponse = redactSecrets(rawResponse, matches);
          logger.warn({ matchCount: matches.length }, 'Exfiltration guard: redacted secrets (Signal)');
        }
      }

      const { text: responseText, files: fileMarkers } = extractFileMarkers(rawResponse);
      const costFooter = buildCostFooter(SHOW_COST_FOOTER, result.usage, effectiveModel);

      saveConversationTurn(chatId, message, rawResponse, result.newSessionId ?? sessionId, AGENT_ID);
      if (surfacedMemoryIds.length > 0) {
        void evaluateMemoryRelevance(surfacedMemoryIds, surfacedMemorySummaries, message, rawResponse).catch(() => {});
      }
      emitChatEvent({ type: 'assistant_message', chatId, content: rawResponse, source: 'signal' });

      for (const file of fileMarkers) {
        await sendFile(chatId, file.filePath, file.caption);
      }

      const textWithFooter = responseText ? responseText + costFooter : '';
      const caps = voiceCapabilities();
      // `/voice off` hard-mutes TTS even when the user spoke (forceVoiceReply).
      // `/voice on` forces TTS even for typed prompts. Without an explicit
      // mode set, mirror the incoming modality.
      const mode = voiceMode.get(chatId);
      const shouldSpeakBack = caps.tts && (
        mode === 'on' || (mode !== 'off' && forceVoiceReply)
      );

      if (textWithFooter) {
        if (shouldSpeakBack && responseText) {
          // TTS path: synth the response (without the cost footer) and
          // ship it as a Signal attachment. Fall back to text if TTS fails.
          let audioPath: string | null = null;
          try {
            const audioBuffer = await synthesizeSpeech(responseText);
            audioPath = writeTempFile(audioBuffer, '.mp3');
            await rpc.sendWithAttachments(chatId, '', [audioPath]);
          } catch (ttsErr) {
            logger.error({ err: ttsErr }, 'TTS failed, falling back to text');
            await sendMessage(chatId, textWithFooter);
          } finally {
            if (audioPath) tryUnlink(audioPath);
          }
        } else {
          await sendMessage(chatId, textWithFooter);
        }
      }
    } catch (err) {
      clearInterval(typingInterval);
      setActiveAbort(chatId, null);
      const errMsg = err instanceof AgentError
        ? err.recovery.userMessage
        : err instanceof Error ? err.message : String(err);
      logger.error({ err }, 'Agent run failed (Signal)');
      await sendMessage(chatId, `Error: ${errMsg}`);
    } finally {
      setProcessing(chatId, false);
    }
  }

  /** Dispatch a bare /command (with optional argument). Returns true if handled. */
  async function handleCommand(incoming: SignalIncomingMessage, text: string): Promise<boolean> {
    const chatId = incoming.sourceNumber;
    const match = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
    if (!match) return false;
    const cmd = match[1].toLowerCase();
    const arg = (match[2] ?? '').trim();

    switch (cmd) {
      case 'start':
        await sendMessage(chatId, `ClaudeClaw online via Signal. Agent: ${AGENT_ID}.\n\nSend /help for commands.`);
        return true;

      case 'help':
        await sendMessage(chatId,
          'ClaudeClaw — Commands (Signal)\n\n' +
          '/newchat — Start a new Claude session\n' +
          '/forget — Clear session\n' +
          '/memory — View recent memories\n' +
          '/pin <id> — Pin a memory\n' +
          '/unpin <id> — Unpin a memory\n' +
          '/voice on|off|auto — Voice replies: always / never / mirror input\n' +
          '/model <opus|sonnet|haiku> — Switch model\n' +
          '/agents — List available agents\n' +
          '/delegate <agent> <prompt> — Delegate to an agent\n' +
          '/dashboard — Get dashboard link\n' +
          '/lock — Lock session (PIN required to unlock)\n' +
          '/status — Security status\n' +
          '/stop — Stop current processing\n\n' +
          'Send a voice note for speech-to-text; send a /voice on to get audio replies.\n' +
          'Everything else goes straight to Claude.');
        return true;

      case 'newchat':
      case 'forget':
        clearSession(chatId, AGENT_ID);
        await sendMessage(chatId, 'Session cleared. Next message starts fresh.');
        return true;

      case 'memory': {
        const memories = getRecentMemories(chatId, 10);
        if (memories.length === 0) {
          await sendMessage(chatId, 'No recent memories.');
        } else {
          const lines = memories.map((m) => `#${m.id} [${m.importance.toFixed(1)}] ${m.summary.slice(0, 150)}`);
          await sendMessage(chatId, `Recent memories:\n\n${lines.join('\n')}`);
        }
        return true;
      }

      case 'pin': {
        const id = parseInt(arg, 10);
        if (!id) { await sendMessage(chatId, 'Usage: /pin <memory_id>'); return true; }
        pinMemory(id);
        await sendMessage(chatId, `Memory #${id} pinned.`);
        return true;
      }

      case 'unpin': {
        const id = parseInt(arg, 10);
        if (!id) { await sendMessage(chatId, 'Usage: /unpin <memory_id>'); return true; }
        unpinMemory(id);
        await sendMessage(chatId, `Memory #${id} unpinned.`);
        return true;
      }

      case 'voice': {
        const caps = voiceCapabilities();
        if (!caps.tts) {
          await sendMessage(chatId,
            'Voice replies not available. Configure one of:\n' +
            '  ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID\n' +
            '  GRADIUM_API_KEY + GRADIUM_VOICE_ID\n' +
            '  KOKORO_URL (local)\n' +
            '…or leave all unset to fall back to macOS `say` (Mac only).');
          return true;
        }
        const sub = arg.toLowerCase();
        if (sub === 'on') {
          voiceMode.set(chatId, 'on');
          await sendMessage(chatId, 'Voice replies enabled. All replies will be spoken. Send /voice off to disable or /voice auto for default mirroring.');
        } else if (sub === 'off') {
          voiceMode.set(chatId, 'off');
          await sendMessage(chatId, 'Voice replies disabled. All replies (including for voice notes) will be text.');
        } else if (sub === 'auto' || sub === 'reset' || sub === 'default') {
          voiceMode.delete(chatId);
          await sendMessage(chatId, 'Voice replies set to auto (mirror incoming modality).');
        } else {
          const state = voiceMode.get(chatId) ?? 'auto';
          await sendMessage(chatId, `Voice replies: ${state}\nUsage: /voice on | /voice off | /voice auto`);
        }
        return true;
      }

      case 'model': {
        const key = arg.toLowerCase();
        if (!key) {
          const current = chatModelOverride.get(chatId) ?? agentDefaultModel ?? 'claude-opus-4-6';
          await sendMessage(chatId, `Current model: ${current}\n\nUsage: /model <opus|sonnet|haiku>`);
          return true;
        }
        const target = AVAILABLE_MODELS[key];
        if (!target) { await sendMessage(chatId, 'Unknown model. Use opus, sonnet, or haiku.'); return true; }
        chatModelOverride.set(chatId, target);
        await sendMessage(chatId, `Model switched to ${target}.`);
        return true;
      }

      case 'dashboard': {
        const token = DASHBOARD_TOKEN;
        if (!token) { await sendMessage(chatId, 'Dashboard not configured (DASHBOARD_TOKEN missing).'); return true; }
        const base = DASHBOARD_URL || `http://localhost:${DASHBOARD_PORT}`;
        const url = `${base}/?token=${token}&chatId=${encodeURIComponent(chatId)}`;
        await sendMessage(chatId, `Dashboard:\n${url}`);
        return true;
      }

      case 'agents': {
        const agentsDir = path.join(PROJECT_ROOT, 'agents');
        let ids: string[] = [];
        try {
          ids = fs.readdirSync(agentsDir).filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());
        } catch { /* no agents dir */ }
        await sendMessage(chatId, ids.length ? `Agents: ${ids.join(', ')}` : 'No additional agents configured.');
        return true;
      }

      case 'delegate': {
        // Rewrite as a normal text message so the delegation parser handles it.
        const rest = arg;
        if (!rest) { await sendMessage(chatId, 'Usage: /delegate <agent> <prompt>'); return true; }
        await handleTextMessage(incoming, `/delegate ${rest}`);
        return true;
      }

      case 'lock':
        lock();
        await sendMessage(chatId, 'Session locked. Send your PIN to unlock.');
        return true;

      case 'status': {
        const s = getSecurityStatus();
        const lines = [
          `PIN lock: ${s.pinEnabled ? (s.locked ? 'locked' : 'unlocked') : 'disabled'}`,
          `Kill phrase: ${s.killPhraseEnabled ? 'enabled' : 'disabled'}`,
          `Idle lock: ${s.idleLockMinutes > 0 ? `${s.idleLockMinutes} min` : 'disabled'}`,
        ];
        await sendMessage(chatId, lines.join('\n'));
        return true;
      }

      case 'stop': {
        // There's no per-message handle in the loop — the in-flight agent's
        // AbortController is held in state.ts via setActiveAbort. The shared
        // abort helper stops whatever's running.
        const { abortActiveQuery } = await import('./state.js');
        abortActiveQuery(chatId);
        await sendMessage(chatId, 'Stopping.');
        return true;
      }

      default:
        return false;
    }
  }

  const onMessage = async (incoming: SignalIncomingMessage): Promise<void> => {
    // Sync-message handling. Signal mirrors every outbound message from any
    // linked device as a sync to every other linked device so the UI stays
    // consistent. Two cases matter:
    //   1. Q types in "Note to Self" on the phone → destinationNumber ==
    //      SIGNAL_PHONE_NUMBER (own account). Treat as a normal incoming
    //      message so Q can chat with the bot via Note-to-Self on mobile.
    //   2. Q writes to anyone else (e.g. a contact) → we must ignore or the
    //      bot would try to "answer" every outbound message Q sends.
    if (incoming.isSync) {
      if (incoming.destinationNumber !== SIGNAL_PHONE_NUMBER) return;
      // else: fall through as a Note-to-Self message from Q's phone.
    }

    if (!isAuthorised(incoming.sourceNumber)) {
      logger.warn({ sender: incoming.sourceNumber.slice(0, 5) + '***' }, 'Dropped unauthorized Signal message');
      return;
    }

    const text = incoming.text.trim();

    // Voice-note handling. Signal attaches a single audio/* blob for voice
    // notes (content type varies: audio/aac, audio/mpeg, audio/ogg, etc.).
    // signal-cli writes the blob to a local path and surfaces it in the
    // envelope as `attachments[].path`; we transcribe with Groq/whisper.cpp
    // and treat the transcript as if it were a typed message, then force
    // the reply to come back as a TTS voice note (forceVoiceReply=true).
    const voiceAttachment = incoming.attachments.find((a) =>
      a.contentType?.startsWith('audio/') ?? false,
    );
    if (voiceAttachment) {
      // signal-cli >= 0.14 writes the attachment blob to a local dir but
      // doesn't always surface the path in the JSON-RPC envelope; some
      // versions only emit { id, contentType, size }. Fall back to the
      // well-known per-user attachment directory (XDG_DATA_HOME default
      // ~/.local/share/signal-cli/attachments/<id>.<ext>) so voice notes
      // still work across daemon versions.
      const resolvedPath = voiceAttachment.path ?? resolveSignalAttachmentPath(voiceAttachment);
      if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        logger.warn(
          { attachmentId: voiceAttachment.id, contentType: voiceAttachment.contentType, tried: resolvedPath },
          'Voice attachment path could not be resolved',
        );
        await sendMessage(
          incoming.sourceNumber,
          'Got your voice note but could not locate the audio file on disk. Check signal-cli attachment-storage config.',
        );
        return;
      }
      voiceAttachment.path = resolvedPath;
      const caps = voiceCapabilities();
      if (!caps.stt) {
        await sendMessage(
          incoming.sourceNumber,
          'Voice transcription not configured. Set GROQ_API_KEY for cloud STT or install whisper-cpp for local STT.',
        );
        return;
      }
      messageQueue.enqueue(incoming.sourceNumber, async () => {
        let transcript: string;
        let transcribePath = voiceAttachment.path!;
        let cleanupPath: string | null = null;
        try {
          const converted = await ensureTranscribableAudio(transcribePath);
          if (converted !== transcribePath) cleanupPath = converted;
          transcribePath = converted;
          transcript = await transcribeAudio(transcribePath);
        } catch (err) {
          logger.error({ err }, 'Voice transcription failed (Signal)');
          await sendMessage(incoming.sourceNumber, 'Voice transcription failed. Try again or send text.');
          if (cleanupPath) tryUnlink(cleanupPath);
          return;
        }
        if (cleanupPath) tryUnlink(cleanupPath);
        if (!transcript.trim()) {
          await sendMessage(incoming.sourceNumber, 'Could not understand the audio. Try again.');
          return;
        }
        logger.info({ chatId: incoming.sourceNumber, len: transcript.length }, 'Signal voice transcribed');
        emitChatEvent({ type: 'user_message', chatId: incoming.sourceNumber, content: `[voice] ${transcript}`, source: 'signal' });
        await handleTextMessage(incoming, transcript, /* forceVoiceReply */ true);
      });
      return;
    }

    if (!text && incoming.attachments.length === 0) return;

    // Commands first — they bypass the message queue so /stop can interrupt.
    if (text.startsWith('/')) {
      const handled = await handleCommand(incoming, text);
      if (handled) return;
    }

    // Everything else goes through the shared message queue so /stop etc.
    // can still work while a long-running agent query is in flight.
    messageQueue.enqueue(incoming.sourceNumber, () => handleTextMessage(incoming, text));
  };

  return {
    async start(): Promise<void> {
      await rpc.connect();
      rpc.on('message', (msg) => void onMessage(msg).catch((err) => logger.error({ err }, 'onMessage threw')));
      logger.info(
        { host: SIGNAL_RPC_HOST, port: SIGNAL_RPC_PORT, account: SIGNAL_PHONE_NUMBER },
        'Signal bot connected to signal-cli daemon',
      );
    },
    async stop(): Promise<void> {
      rpc.stop();
    },
    async sendTo(recipient: string, text: string): Promise<void> {
      await sendMessage(recipient, text);
    },
  };
}

/** Export for the scheduler — same shape as bot.ts's splitMessage. */
export { splitMessage };
