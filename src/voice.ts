import fs, { mkdirSync } from 'fs';
import https from 'https';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { logger } from './logger.js';
import { readEnvFile } from './env.js';

const execFileAsync = promisify(execFile);

// Cache ffmpeg availability check (only needs to run once)
let _ffmpegAvailable: boolean | null = null;
async function hasFfmpeg(): Promise<boolean> {
  if (_ffmpegAvailable !== null) return _ffmpegAvailable;
  try {
    await execFileAsync('ffmpeg', ['-version']);
    _ffmpegAvailable = true;
  } catch {
    _ffmpegAvailable = false;
  }
  return _ffmpegAvailable;
}

// ── Upload directory ────────────────────────────────────────────────────────

export const UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'workspace',
  'uploads',
);

mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Make an HTTPS request and return the response body as a Buffer.
 */
function httpsRequest(
  url: string,
  options: https.RequestOptions,
  body?: Buffer | string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode && res.statusCode >= 400) {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${buf.toString('utf-8').slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve(buf);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Convenience wrapper for HTTPS GET that returns a Buffer.
 */
function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow a single redirect if present
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        https.get(res.headers.location, (res2) => {
          const chunks: Buffer[] = [];
          res2.on('data', (chunk: Buffer) => chunks.push(chunk));
          res2.on('end', () => resolve(Buffer.concat(chunks)));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode && res.statusCode >= 400) {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${buf.toString('utf-8').slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve(buf);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── STT: Groq Whisper ───────────────────────────────────────────────────────

/**
 * Download a Telegram file to a local temp path and return the path.
 * Uses the Telegram Bot API file download endpoint.
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  destDir: string,
): Promise<string> {
  mkdirSync(destDir, { recursive: true });

  // Step 1: Get the file path from Telegram
  const infoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const infoBuffer = await httpsGet(infoUrl);
  const info = JSON.parse(infoBuffer.toString('utf-8')) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  if (!info.ok || !info.result?.file_path) {
    throw new Error(`Telegram getFile failed: ${infoBuffer.toString('utf-8').slice(0, 300)}`);
  }

  // Step 2: Download the actual file
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`;
  const fileBuffer = await httpsGet(downloadUrl);

  // Step 3: Save locally
  // Telegram sends voice as .oga — Groq requires .ogg. Rename transparently.
  const rawExt = path.extname(info.result.file_path) || '.ogg';
  const ext = rawExt === '.oga' ? '.ogg' : rawExt;
  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const localPath = path.join(destDir, filename);
  fs.writeFileSync(localPath, fileBuffer);

  return localPath;
}

/**
 * Transcribe an audio file using Groq's Whisper API.
 * Supports .ogg, .mp3, .wav, .m4a.
 */
async function transcribeAudioGroq(filePath: string): Promise<string> {
  const env = readEnvFile(['GROQ_API_KEY']);
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set in .env');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString('hex')}`;

  // Build multipart/form-data body manually
  const parts: Buffer[] = [];

  // File field
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: audio/ogg\r\n\r\n`,
    ),
  );
  parts.push(fileBuffer);
  parts.push(Buffer.from('\r\n'));

  // Model field
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-large-v3\r\n`,
    ),
  );

  // Response format field
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
        `json\r\n`,
    ),
  );

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const responseBuffer = await httpsRequest(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
    },
    body,
  );

  const response = JSON.parse(responseBuffer.toString('utf-8')) as {
    text?: string;
  };

  return response.text ?? '';
}

// ── STT: whisper-cpp (local fallback) ────────────────────────────────────────

/**
 * Transcribe an audio file using local whisper-cpp binary.
 * Converts to WAV first (whisper-cpp requires WAV input).
 */
async function transcribeAudioLocal(filePath: string): Promise<string> {
  const env = readEnvFile(['WHISPER_CPP_PATH', 'WHISPER_MODEL_PATH']);
  const whisperPath = env.WHISPER_CPP_PATH || 'whisper-cpp';
  const modelPath = env.WHISPER_MODEL_PATH;
  if (!modelPath) throw new Error('WHISPER_MODEL_PATH not set');

  // whisper-cpp needs WAV input — convert from ogg/mp3/etc.
  const wavPath = filePath.replace(/\.[^.]+$/, '.wav');
  await execFileAsync('ffmpeg', ['-i', filePath, '-ar', '16000', '-ac', '1', '-y', wavPath]);

  try {
    const { stdout } = await execFileAsync(whisperPath, [
      '-m', modelPath,
      '-f', wavPath,
      '--output-json',
      '--no-timestamps',
      '-l', 'auto',
    ]);
    const result = JSON.parse(stdout);
    return (result.transcription || []).map((s: { text: string }) => s.text).join(' ').trim();
  } finally {
    try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
  }
}

// ── STT: Cascade (Groq → whisper-cpp local) ─────────────────────────────────

/**
 * Transcribe an audio file using the first available provider.
 * Priority: Groq Whisper (cloud) → whisper-cpp (local).
 */
export async function transcribeAudio(filePath: string): Promise<string> {
  const env = readEnvFile(['GROQ_API_KEY', 'WHISPER_MODEL_PATH']);

  // Try Groq first (cloud, fast)
  if (env.GROQ_API_KEY) {
    try {
      return await transcribeAudioGroq(filePath);
    } catch (err) {
      logger.warn({ err }, 'Groq Whisper failed, trying local whisper-cpp');
    }
  }

  // Fallback: local whisper-cpp
  return await transcribeAudioLocal(filePath);
}

// ── TTS: ElevenLabs (primary) ────────────────────────────────────────────────

/**
 * Convert text to speech using ElevenLabs and return the audio as a Buffer.
 */
async function synthesizeSpeechElevenLabs(text: string, voiceIdOverride?: string, modelIdOverride?: string): Promise<Buffer> {
  const env = readEnvFile(['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_MODEL_ID']);
  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = voiceIdOverride || env.ELEVENLABS_VOICE_ID;
  const modelId = modelIdOverride || env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID not set');

  logger.info({ voiceId, modelId, textLength: text.length }, 'ElevenLabs TTS request');

  const payload = JSON.stringify({
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  });

  return await httpsRequest(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'Content-Length': Buffer.byteLength(payload).toString(),
      },
    },
    payload,
  );
}

// ── TTS: Gradium AI (alternative) ────────────────────────────────────────────

/**
 * Convert text to speech using Gradium AI and return the audio as a Buffer.
 * Returns OGG Opus directly.
 */
async function synthesizeSpeechGradium(text: string): Promise<Buffer> {
  const env = readEnvFile(['GRADIUM_API_KEY', 'GRADIUM_VOICE_ID']);
  const apiKey = env.GRADIUM_API_KEY;
  const voiceId = env.GRADIUM_VOICE_ID;

  if (!apiKey) throw new Error('GRADIUM_API_KEY not set');
  if (!voiceId) throw new Error('GRADIUM_VOICE_ID not set');

  const payload = JSON.stringify({
    text,
    voice_id: voiceId,
    output_format: 'opus',
    only_audio: true,
  });

  return await httpsRequest(
    'https://eu.api.gradium.ai/api/post/speech/tts',
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
      },
    },
    payload,
  );
}

// ── TTS: macOS say + ffmpeg (local fallback) ─────────────────────────────────

/**
 * Convert text to speech using macOS `say` + ffmpeg.
 * Returns an OGG Opus buffer suitable for Telegram voice messages.
 * Only works on macOS with ffmpeg installed.
 */
export async function synthesizeSpeechLocal(text: string): Promise<Buffer> {
  if (process.platform !== 'darwin') {
    throw new Error('Local TTS only available on macOS');
  }
  if (!(await hasFfmpeg())) {
    throw new Error('ffmpeg not installed — required for local TTS');
  }

  const env = readEnvFile(['TTS_VOICE']);
  const voice = env.TTS_VOICE || 'Thomas';
  const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tmpDir = path.join(UPLOADS_DIR, '..', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const aiffPath = path.join(tmpDir, `tts_${id}.aiff`);
  const oggPath = path.join(tmpDir, `tts_${id}.ogg`);

  try {
    await execFileAsync('/usr/bin/say', ['-v', voice, '-o', aiffPath, text]);
    await execFileAsync('ffmpeg', [
      '-i', aiffPath,
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-y',
      oggPath,
    ]);
    return fs.readFileSync(oggPath);
  } finally {
    try { fs.unlinkSync(aiffPath); } catch { /* ignore */ }
    try { fs.unlinkSync(oggPath); } catch { /* ignore */ }
  }
}

// ── TTS: Cascade (ElevenLabs → Gradium → macOS say) ─────────────────────────

/**
 * Convert text to speech using the first available provider.
 * Priority: ElevenLabs → Gradium AI → macOS say + ffmpeg.
 */
export async function synthesizeSpeech(text: string, voiceIdOverride?: string, modelIdOverride?: string): Promise<Buffer> {
  const env = readEnvFile([
    'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
    'GRADIUM_API_KEY', 'GRADIUM_VOICE_ID',
  ]);

  const hasElevenLabs = !!(env.ELEVENLABS_API_KEY && (voiceIdOverride || env.ELEVENLABS_VOICE_ID));
  const hasGradium = !!(env.GRADIUM_API_KEY && env.GRADIUM_VOICE_ID);

  if (hasElevenLabs) {
    try {
      return await synthesizeSpeechElevenLabs(text, voiceIdOverride, modelIdOverride);
    } catch (err) {
      logger.warn({ err }, 'ElevenLabs TTS failed, trying next provider');
    }
  }

  if (hasGradium) {
    try {
      return await synthesizeSpeechGradium(text);
    } catch (err) {
      logger.warn({ err }, 'Gradium TTS failed, trying local fallback');
    }
  }

  return await synthesizeSpeechLocal(text);
}

// ── Capabilities check ──────────────────────────────────────────────────────

/**
 * Check whether voice mode is available (all required env vars are set).
 * TTS is available if any provider is configured or macOS say is available.
 */
export function voiceCapabilities(voiceIdOverride?: string): { stt: boolean; tts: boolean } {
  const env = readEnvFile([
    'GROQ_API_KEY',
    'WHISPER_MODEL_PATH',
    'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
    'GRADIUM_API_KEY', 'GRADIUM_VOICE_ID',
  ]);

  return {
    stt: !!env.GROQ_API_KEY || !!env.WHISPER_MODEL_PATH,
    tts: !!(env.ELEVENLABS_API_KEY && (voiceIdOverride || env.ELEVENLABS_VOICE_ID))
      || !!(env.GRADIUM_API_KEY && env.GRADIUM_VOICE_ID)
      || process.platform === 'darwin',
  };
}
