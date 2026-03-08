import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

vi.mock('./env.js', () => ({
  readEnvFile: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { voiceCapabilities, synthesizeSpeechLocal, UPLOADS_DIR } from './voice.js';
import { readEnvFile } from './env.js';

const mockReadEnvFile = vi.mocked(readEnvFile);
const isMac = process.platform === 'darwin';

describe('voiceCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tts based on platform when no env vars set', () => {
    mockReadEnvFile.mockReturnValue({});
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: false, tts: isMac });
  });

  it('returns stt=true when GROQ_API_KEY is set', () => {
    mockReadEnvFile.mockReturnValue({ GROQ_API_KEY: 'gsk_test123' });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: true, tts: isMac });
  });

  it('returns tts based on platform when only ELEVENLABS_API_KEY set (missing voice ID)', () => {
    mockReadEnvFile.mockReturnValue({ ELEVENLABS_API_KEY: 'el_test123' });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: false, tts: isMac });
  });

  it('returns tts=true when both ELEVENLABS keys set', () => {
    mockReadEnvFile.mockReturnValue({
      ELEVENLABS_API_KEY: 'el_test123',
      ELEVENLABS_VOICE_ID: 'voice_abc',
    });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: false, tts: true });
  });

  it('returns tts based on platform when only GRADIUM_API_KEY set (missing voice ID)', () => {
    mockReadEnvFile.mockReturnValue({ GRADIUM_API_KEY: 'gd_test123' });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: false, tts: isMac });
  });

  it('returns tts=true when both GRADIUM keys set', () => {
    mockReadEnvFile.mockReturnValue({
      GRADIUM_API_KEY: 'gd_test123',
      GRADIUM_VOICE_ID: 'voice_abc',
    });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: false, tts: true });
  });

  it('returns all true when all providers set', () => {
    mockReadEnvFile.mockReturnValue({
      GROQ_API_KEY: 'gsk_test123',
      ELEVENLABS_API_KEY: 'el_test123',
      ELEVENLABS_VOICE_ID: 'voice_abc',
      GRADIUM_API_KEY: 'gd_test123',
      GRADIUM_VOICE_ID: 'voice_def',
    });
    const result = voiceCapabilities();
    expect(result).toEqual({ stt: true, tts: true });
  });
});

describe('synthesizeSpeechLocal', () => {
  it('produces a non-empty OGG buffer on macOS', async () => {
    if (!isMac) return;
    mockReadEnvFile.mockReturnValue({});
    const buffer = await synthesizeSpeechLocal('Hello, this is a test.');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 15000);
});

describe('UPLOADS_DIR', () => {
  it('is an absolute path', () => {
    expect(path.isAbsolute(UPLOADS_DIR)).toBe(true);
  });

  it('ends with agents/main/uploads or workspace/uploads (fallback)', () => {
    expect(UPLOADS_DIR).toMatch(/(agents[/\\]main|workspace)[/\\]uploads$/);
  });
});
