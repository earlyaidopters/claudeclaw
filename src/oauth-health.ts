import fs from 'fs';
import path from 'path';
import os from 'os';

import { logger } from './logger.js';
import { readEnvFile } from './env.js';

type Sender = (text: string) => Promise<void>;

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

/** Don't spam - track last alert level to avoid repeating */
let lastAlertLevel: 'none' | 'warning' | 'expired' = 'none';

interface Credentials {
  claudeAiOauth?: {
    expiresAt?: number;
    subscriptionType?: string;
  };
}

function readCredentials(): Credentials | null {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

function getCheckIntervalMs(): number {
  const env = readEnvFile(['OAUTH_CHECK_MINUTES']);
  const minutes = parseInt(env.OAUTH_CHECK_MINUTES || '30', 10);
  return (isNaN(minutes) || minutes < 1 ? 30 : minutes) * 60 * 1000;
}

function getAlertThresholdMs(): number {
  const env = readEnvFile(['OAUTH_ALERT_HOURS']);
  const hours = parseInt(env.OAUTH_ALERT_HOURS || '2', 10);
  return (isNaN(hours) || hours < 1 ? 2 : hours) * 60 * 60 * 1000;
}

async function checkOAuthHealth(sender: Sender): Promise<void> {
  // If a long-lived setup token is configured, the credentials file is irrelevant
  const env = readEnvFile(['CLAUDE_CODE_OAUTH_TOKEN']);
  if (env.CLAUDE_CODE_OAUTH_TOKEN) {
    logger.debug('Using long-lived env token (CLAUDE_CODE_OAUTH_TOKEN), skipping credentials check');
    lastAlertLevel = 'none';
    return;
  }

  const creds = readCredentials();

  if (!creds?.claudeAiOauth?.expiresAt) {
    if (lastAlertLevel !== 'expired') {
      lastAlertLevel = 'expired';
      await sender(
        '<b>OAuth Health Check</b>\n\n' +
        'Cannot read OAuth token.\n' +
        'File missing or invalid structure.\n\n' +
        'Run: <code>claude auth login</code>',
      );
    }
    return;
  }

  const expiresAt = creds.claudeAiOauth.expiresAt;
  const now = Date.now();
  const remainingMs = expiresAt - now;
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const alertThresholdMs = getAlertThresholdMs();

  if (remainingMs <= 0) {
    if (lastAlertLevel !== 'expired') {
      lastAlertLevel = 'expired';
      logger.error({ expiresAt, remainingMs }, 'OAuth token EXPIRED');
      await sender(
        '<b>OAuth Health Check - TOKEN EXPIRED</b>\n\n' +
        `The OAuth token expired ${Math.abs(remainingMinutes)} minutes ago.\n` +
        'All API calls will fail until renewed.\n\n' +
        '<b>Action required:</b>\n' +
        '<code>claude auth logout && claude auth login</code>',
      );
    }
  } else if (remainingMs <= alertThresholdMs) {
    if (lastAlertLevel !== 'warning') {
      lastAlertLevel = 'warning';
      logger.warn({ expiresAt, remainingHours, remainingMinutes }, 'OAuth token expiring soon');
      await sender(
        '<b>OAuth Health Check - Expiring soon</b>\n\n' +
        `The OAuth token expires in <b>${remainingHours}h${remainingMinutes}min</b>.\n\n` +
        '<b>Recommended action:</b>\n' +
        '<code>claude auth logout && claude auth login</code>',
      );
    }
  } else {
    if (lastAlertLevel !== 'none') {
      lastAlertLevel = 'none';
      logger.info({ remainingHours }, 'OAuth token healthy again');
    }
    logger.debug({ remainingHours, remainingMinutes }, 'OAuth token OK');
  }
}

/**
 * Start periodic OAuth health checks.
 * Monitors ~/.claude/.credentials.json for token expiration.
 * Alerts via the provided sender callback when expiration is near.
 *
 * Configure via env vars:
 * - OAUTH_CHECK_MINUTES: check interval (default 30)
 * - OAUTH_ALERT_HOURS: alert threshold before expiry (default 2)
 *
 * Automatically skips when CLAUDE_CODE_OAUTH_TOKEN is set.
 */
export function initOAuthHealthCheck(sender: Sender): void {
  const checkIntervalMs = getCheckIntervalMs();
  const alertThresholdMs = getAlertThresholdMs();

  // Initial check after 10s (let bot fully start)
  setTimeout(() => void checkOAuthHealth(sender), 10_000);

  // Periodic checks
  setInterval(() => void checkOAuthHealth(sender), checkIntervalMs);

  logger.info(
    { intervalMin: checkIntervalMs / 60_000, alertThresholdHours: alertThresholdMs / (60 * 60 * 1000) },
    'OAuth health check initialized',
  );
}
