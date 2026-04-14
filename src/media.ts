import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory where all Telegram media is saved
export const UPLOADS_DIR = path.resolve(__dirname, '..', 'workspace', 'uploads');

// Ensure uploads dir exists on module load
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Make an HTTPS GET request and return the response body as a string.
 */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve, reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download a file via HTTPS and save it to disk.
 */
function httpsDownload(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsDownload(res.headers.location, dest).then(resolve, reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(dest, () => { /* ignore cleanup error */ });
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Sanitize a filename: replace non-alphanumeric chars (except . and -) with _.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-]/g, '_');
}

/**
 * Download a file from Telegram and save it to workspace/uploads/.
 * Returns the local file path.
 *
 * Steps:
 * 1. GET https://api.telegram.org/bot{TOKEN}/getFile?file_id={fileId}
 *    -> response: { ok: true, result: { file_path: "photos/file_123.jpg" } }
 * 2. Download from https://api.telegram.org/file/bot{TOKEN}/{file_path}
 * 3. Save to UPLOADS_DIR/{timestamp}_{sanitized_filename}
 * 4. Return the local path
 */
export async function downloadMedia(
  botToken: string,
  fileId: string,
  originalFilename?: string,
): Promise<string> {
  // Step 1: Get the file path from Telegram
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const responseBody = await httpsGet(getFileUrl);
  const parsed = JSON.parse(responseBody) as { ok: boolean; result?: { file_path?: string } };

  if (!parsed.ok || !parsed.result?.file_path) {
    throw new Error(`Telegram getFile failed for file_id=${fileId}: ${responseBody}`);
  }

  const telegramFilePath = parsed.result.file_path;

  // Determine the local filename
  let filename: string;
  if (originalFilename) {
    filename = sanitizeFilename(originalFilename);
  } else {
    // Infer from the Telegram file_path (e.g. "photos/file_123.jpg" -> "file_123.jpg")
    const basename = path.basename(telegramFilePath);
    filename = sanitizeFilename(basename);
  }

  const localFilename = `${Date.now()}_${filename}`;
  const localPath = path.join(UPLOADS_DIR, localFilename);

  // Step 2: Download the file
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;
  await httpsDownload(downloadUrl, localPath);

  return localPath;
}

/**
 * Build the message text to send to Claude when a photo is received.
 * Claude Code's Read tool can open image files -- just give it the path.
 */
export function buildPhotoMessage(localPath: string, caption?: string): string {
  let msg = `Photo received. File saved at: ${localPath}`;
  if (caption) {
    msg += `\nCaption: "${caption}"`;
  }
  msg += '\nPlease analyze this image.';
  return msg;
}

/**
 * Build the message text to send to Claude when a document is received.
 */
export function buildDocumentMessage(localPath: string, filename: string, caption?: string): string {
  let msg = `Document received: ${filename}\nFile saved at: ${localPath}`;
  if (caption) {
    msg += `\nCaption: "${caption}"`;
  }
  msg += '\nPlease read and process this file.';
  return msg;
}

/**
 * Build the message text to send to Claude when a video is received.
 * Instructs Claude to use the gemini-api-dev skill for video understanding.
 */
export function buildVideoMessage(localPath: string, caption?: string): string {
  let msg = `Video received. File saved at: ${localPath}`;
  if (caption) {
    msg += `\nCaption: "${caption}"`;
  }
  msg += '\nUse the gemini-api-dev skill with the GOOGLE_API_KEY from .env to analyze this video. Summarize what is in it and transcribe any spoken content.';
  return msg;
}

/**
 * Clean up old files from workspace/uploads/.
 * Deletes files older than maxAgeMs (default: 24 hours).
 */
export function cleanupOldUploads(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(UPLOADS_DIR);
  } catch {
    return;
  }

  const now = Date.now();
  let deleted = 0;

  for (const entry of entries) {
    const fullPath = path.join(UPLOADS_DIR, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        deleted++;
      }
    } catch {
      // Skip files we can't stat or delete
    }
  }

  if (deleted > 0) {
    logger.info({ deleted, dir: UPLOADS_DIR }, 'Cleaned up old uploads');
  }
}
