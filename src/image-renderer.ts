import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer, { type Browser } from 'puppeteer';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RENDERS_DIR = path.resolve(__dirname, '..', 'workspace', 'renders');
fs.mkdirSync(RENDERS_DIR, { recursive: true });

let browserInstance: Browser | null = null;

/** Get or launch a shared headless browser instance. */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  return browserInstance;
}

/** Shut down the shared browser (call on bot shutdown). */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export interface RenderOptions {
  /** Width in pixels (default: 1200) */
  width?: number;
  /** Height in pixels — if omitted, auto-sizes to content */
  height?: number;
  /** Output format (default: png) */
  format?: 'png' | 'jpeg' | 'webp';
  /** JPEG/WebP quality 0-100 (default: 90) */
  quality?: number;
  /** Custom filename prefix (default: 'render') */
  prefix?: string;
  /** Device scale factor for retina-quality output (default: 2) */
  scale?: number;
}

/**
 * Render an HTML string to an image file.
 *
 * Returns the absolute path to the generated image.
 * The image is saved to workspace/renders/ with a timestamped filename.
 *
 * Usage from Claude agents:
 *   The agent generates HTML, calls this function, then uses
 *   [SEND_PHOTO:/path/to/image.png|caption] to deliver via Telegram.
 */
export async function renderHtmlToImage(
  html: string,
  options: RenderOptions = {},
): Promise<string> {
  const {
    width = 1200,
    height,
    format = 'png',
    quality = 90,
    prefix = 'render',
    scale = 2,
  } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width,
      height: height || 800,
      deviceScaleFactor: scale,
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Auto-size height to content if not specified
    if (!height) {
      const bodyHeight = await page.evaluate(`
        Math.max(
          document.body.scrollHeight, document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        )
      ` as unknown as () => number);
      await page.setViewport({ width, height: bodyHeight, deviceScaleFactor: scale });
    }

    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${prefix}_${Date.now()}.${ext}`;
    const outputPath = path.join(RENDERS_DIR, filename);

    const screenshotOptions: Record<string, unknown> = {
      path: outputPath,
      type: format,
      fullPage: !height,
    };
    if (format !== 'png') {
      screenshotOptions.quality = quality;
    }

    await page.screenshot(screenshotOptions);

    logger.info({ outputPath, width, format }, 'Rendered HTML to image');
    return outputPath;
  } finally {
    await page.close();
  }
}

/**
 * Render HTML to image and return the SEND_PHOTO marker string.
 * Convenience wrapper for agents that want a ready-to-use marker.
 */
export async function renderAndMark(
  html: string,
  caption?: string,
  options?: RenderOptions,
): Promise<string> {
  const imagePath = await renderHtmlToImage(html, options);
  const captionSuffix = caption ? `|${caption}` : '';
  return `[SEND_PHOTO:${imagePath}${captionSuffix}]`;
}

/**
 * Clean up old renders (default: older than 24 hours).
 */
export function cleanupOldRenders(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(RENDERS_DIR);
  } catch {
    return;
  }

  const now = Date.now();
  let deleted = 0;

  for (const entry of entries) {
    const fullPath = path.join(RENDERS_DIR, entry);
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
    logger.info({ deleted, dir: RENDERS_DIR }, 'Cleaned up old renders');
  }
}
