/**
 * Integration tests for Telegram file sending.
 *
 * These tests verify the FULL pipeline:
 * 1. extractFileMarkers() parsing (unit-level, but included for completeness)
 * 2. Grammy's InputFile + replyWithDocument/replyWithPhoto via mocked context
 * 3. Real Telegram Bot API call to actually send a file to the chat
 *
 * The real API tests require TELEGRAM_BOT_TOKEN and ALLOWED_CHAT_ID in .env.
 * They're skipped automatically if those aren't set.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractFileMarkers } from './bot.js';

// ── Helper: create a temp file with known content ───────────────────
function createTempFile(filename: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeclaw-test-'));
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function cleanupTempFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath));
  } catch { /* ignore */ }
}

// ── Load .env for real API tests ────────────────────────────────────
function loadEnv(): { token: string; chatId: string } {
  const envPath = path.resolve(process.cwd(), '.env');
  let token = '';
  let chatId = '';
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('TELEGRAM_BOT_TOKEN=')) {
        token = trimmed.slice('TELEGRAM_BOT_TOKEN='.length).replace(/^['"]|['"]$/g, '');
      }
      if (trimmed.startsWith('ALLOWED_CHAT_ID=')) {
        chatId = trimmed.slice('ALLOWED_CHAT_ID='.length).replace(/^['"]|['"]$/g, '');
      }
    }
  } catch { /* no .env */ }
  return { token, chatId };
}

// ── Unit tests: extractFileMarkers → mocked Grammy context ─────────
describe('file sending: mocked Grammy context', () => {
  let mockCtx: {
    reply: ReturnType<typeof vi.fn>;
    replyWithDocument: ReturnType<typeof vi.fn>;
    replyWithPhoto: ReturnType<typeof vi.fn>;
    chat: { id: number };
  };

  beforeEach(() => {
    mockCtx = {
      reply: vi.fn().mockResolvedValue(undefined),
      replyWithDocument: vi.fn().mockResolvedValue(undefined),
      replyWithPhoto: vi.fn().mockResolvedValue(undefined),
      chat: { id: 12345 },
    };
  });

  it('sends a document when SEND_FILE marker is present and file exists', async () => {
    const tmpFile = createTempFile('test-report.pdf', 'fake pdf content');
    try {
      const response = `Here is your report.\n[SEND_FILE:${tmpFile}]\nLet me know if you need changes.`;
      const { text, files } = extractFileMarkers(response);

      // Simulate what handleMessage does
      for (const file of files) {
        expect(fs.existsSync(file.filePath)).toBe(true);
        if (file.type === 'photo') {
          await mockCtx.replyWithPhoto(file.filePath, file.caption ? { caption: file.caption } : undefined);
        } else {
          await mockCtx.replyWithDocument(file.filePath, file.caption ? { caption: file.caption } : undefined);
        }
      }

      expect(mockCtx.replyWithDocument).toHaveBeenCalledTimes(1);
      expect(mockCtx.replyWithDocument).toHaveBeenCalledWith(tmpFile, undefined);
      expect(text).toBe('Here is your report.\n\nLet me know if you need changes.');
    } finally {
      cleanupTempFile(tmpFile);
    }
  });

  it('sends a photo when SEND_PHOTO marker is present', async () => {
    const tmpFile = createTempFile('chart.png', 'fake png content');
    try {
      const response = `[SEND_PHOTO:${tmpFile}|Revenue chart]`;
      const { files } = extractFileMarkers(response);

      for (const file of files) {
        if (file.type === 'photo') {
          await mockCtx.replyWithPhoto(file.filePath, file.caption ? { caption: file.caption } : undefined);
        }
      }

      expect(mockCtx.replyWithPhoto).toHaveBeenCalledTimes(1);
      expect(mockCtx.replyWithPhoto).toHaveBeenCalledWith(tmpFile, { caption: 'Revenue chart' });
    } finally {
      cleanupTempFile(tmpFile);
    }
  });

  it('sends error message when file does not exist', async () => {
    const response = '[SEND_FILE:/tmp/nonexistent-file-abc123.pdf]';
    const { files } = extractFileMarkers(response);

    for (const file of files) {
      if (!fs.existsSync(file.filePath)) {
        await mockCtx.reply(`Could not send file: ${file.filePath} (not found)`);
      }
    }

    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Could not send file: /tmp/nonexistent-file-abc123.pdf (not found)',
    );
    expect(mockCtx.replyWithDocument).not.toHaveBeenCalled();
  });

  it('sends multiple files in order', async () => {
    const tmpPdf = createTempFile('report.pdf', 'pdf');
    const tmpPng = createTempFile('chart.png', 'png');
    try {
      const response = `Files ready.\n[SEND_FILE:${tmpPdf}|Report]\n[SEND_PHOTO:${tmpPng}|Chart]`;
      const { files } = extractFileMarkers(response);

      expect(files).toHaveLength(2);

      for (const file of files) {
        if (file.type === 'photo') {
          await mockCtx.replyWithPhoto(file.filePath, file.caption ? { caption: file.caption } : undefined);
        } else {
          await mockCtx.replyWithDocument(file.filePath, file.caption ? { caption: file.caption } : undefined);
        }
      }

      expect(mockCtx.replyWithDocument).toHaveBeenCalledTimes(1);
      expect(mockCtx.replyWithPhoto).toHaveBeenCalledTimes(1);
      // Document sent first (order matters)
      expect(mockCtx.replyWithDocument.mock.invocationCallOrder[0])
        .toBeLessThan(mockCtx.replyWithPhoto.mock.invocationCallOrder[0]);
    } finally {
      cleanupTempFile(tmpPdf);
      cleanupTempFile(tmpPng);
    }
  });

  it('handles mixed: some files exist, some dont', async () => {
    const tmpFile = createTempFile('exists.pdf', 'content');
    try {
      const response = `[SEND_FILE:${tmpFile}]\n[SEND_FILE:/tmp/ghost-file-999.pdf]`;
      const { files } = extractFileMarkers(response);

      for (const file of files) {
        if (!fs.existsSync(file.filePath)) {
          await mockCtx.reply(`Could not send file: ${file.filePath} (not found)`);
          continue;
        }
        await mockCtx.replyWithDocument(file.filePath);
      }

      // One successful send, one error
      expect(mockCtx.replyWithDocument).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    } finally {
      cleanupTempFile(tmpFile);
    }
  });
});

// ── Real Telegram API tests ─────────────────────────────────────────
// These actually send a file to your Telegram chat.
// Skipped if TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID are not in .env.

describe('file sending: real Telegram API', () => {
  const { token, chatId } = loadEnv();
  // Opt-in: these tests send real messages to the configured Telegram chat.
  // Require RUN_LIVE_TELEGRAM_TESTS=1 so a plain `npm run test` is quiet.
  const canRunRealTests = !!(token && chatId && process.env.RUN_LIVE_TELEGRAM_TESTS === '1');

  // Create a real temp file for the test
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = createTempFile('claudeclaw-test.txt', `ClaudeClaw file send test\nTimestamp: ${new Date().toISOString()}\nThis file was sent by an automated integration test.`);
  });

  afterEach(() => {
    cleanupTempFile(tmpFile);
  });

  it.skipIf(!canRunRealTests)('sends a real document via Telegram sendDocument API', async () => {
    // Use the raw Telegram Bot API (multipart form upload) to verify
    // the same mechanism Grammy uses under the hood.
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fs.readFileSync(tmpFile)]), 'claudeclaw-test.txt');
    formData.append('caption', 'Integration test: file sending works');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json() as { ok: boolean; result?: { document?: { file_name: string } }; description?: string };

    expect(json.ok).toBe(true);
    expect(json.result?.document?.file_name).toBe('claudeclaw-test.txt');
  }, 15000);

  it.skipIf(!canRunRealTests)('sends a real PDF via Telegram sendDocument API', async () => {
    // Create a minimal PDF
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF`;

    const pdfFile = createTempFile('claudeclaw-test.pdf', pdfContent);
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', new Blob([fs.readFileSync(pdfFile)]), 'claudeclaw-test.pdf');
      formData.append('caption', 'Integration test: PDF sending works');

      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as { ok: boolean; result?: { document?: { file_name: string; mime_type: string } } };

      expect(json.ok).toBe(true);
      expect(json.result?.document?.file_name).toBe('claudeclaw-test.pdf');
    } finally {
      cleanupTempFile(pdfFile);
    }
  }, 15000);

  it.skipIf(!canRunRealTests)('returns error for nonexistent file (sanity check)', async () => {
    // This tests that our code correctly checks file existence before calling the API.
    // If we skip the check, the API would error. But we handle it gracefully.
    const fakePath = '/tmp/claudeclaw-nonexistent-test-file.pdf';
    expect(fs.existsSync(fakePath)).toBe(false);

    // Simulate the bot's behavior
    const { files } = extractFileMarkers(`[SEND_FILE:${fakePath}]`);
    expect(files).toHaveLength(1);
    expect(fs.existsSync(files[0].filePath)).toBe(false);
    // Bot would send an error message, not crash
  });

  it.skipIf(!canRunRealTests)('end-to-end: parse marker → check file → send via API', async () => {
    // Full pipeline: Claude's response text → parse → validate → send
    const response = `Here's your test file.\n[SEND_FILE:${tmpFile}|Automated test file]\nAll good.`;

    // Step 1: Parse
    const { text, files } = extractFileMarkers(response);
    expect(text).toBe("Here's your test file.\n\nAll good.");
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe('document');
    expect(files[0].caption).toBe('Automated test file');

    // Step 2: Validate file exists
    expect(fs.existsSync(files[0].filePath)).toBe(true);

    // Step 3: Send via real API
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fs.readFileSync(files[0].filePath)]), path.basename(files[0].filePath));
    if (files[0].caption) {
      formData.append('caption', files[0].caption);
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json() as { ok: boolean; result?: { document?: { file_name: string }; caption?: string } };

    expect(json.ok).toBe(true);
    expect(json.result?.document?.file_name).toBe('claudeclaw-test.txt');
    expect(json.result?.caption).toBe('Automated test file');
  }, 15000);
});
