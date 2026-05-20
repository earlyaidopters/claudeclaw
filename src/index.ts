import fs from 'fs';
import path from 'path';

import { loadAgentConfig, listAgentIds, resolveAgentDir, resolveAgentClaudeMd } from './agent-config.js';
import { createBot } from './bot.js';
import { createSignalBot, SignalBot } from './signal-bot.js';
import { checkPendingMigrations } from './migrations.js';
import { ALLOWED_CHAT_ID, activeBotToken, STORE_DIR, PROJECT_ROOT, CLAUDECLAW_CONFIG, GOOGLE_API_KEY, setAgentOverrides, SECURITY_PIN_HASH, IDLE_LOCK_MINUTES, EMERGENCY_KILL_PHRASE, WARROOM_ENABLED, WARROOM_PORT, MESSENGER_TYPE, SIGNAL_AUTHORIZED_RECIPIENTS, SIGNAL_PHONE_NUMBER } from './config.js';
import { startDashboard } from './dashboard.js';
import { initDatabase, cleanupOldMissionTasks, insertAuditLog } from './db.js';
import { initSecurity, setAuditCallback } from './security.js';
import { logger } from './logger.js';
import { cleanupOldUploads } from './media.js';
import { runConsolidation } from './memory-consolidate.js';
import { runDecaySweep } from './memory.js';
import { initOAuthHealthCheck } from './oauth-health.js';
import { initOrchestrator } from './orchestrator.js';
import { initScheduler } from './scheduler.js';
import { setTelegramConnected, setBotInfo } from './state.js';

// Parse --agent flag
const agentFlagIndex = process.argv.indexOf('--agent');
const AGENT_ID = agentFlagIndex !== -1 ? process.argv[agentFlagIndex + 1] : 'main';

// Export AGENT_ID to env so child processes (schedule-cli, etc.) inherit it
process.env.CLAUDECLAW_AGENT_ID = AGENT_ID;

if (AGENT_ID !== 'main') {
  const agentConfig = loadAgentConfig(AGENT_ID);
  const agentDir = resolveAgentDir(AGENT_ID);
  const claudeMdPath = resolveAgentClaudeMd(AGENT_ID);
  let systemPrompt: string | undefined;
  if (claudeMdPath) {
    try {
      systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch { /* no CLAUDE.md */ }
  }
  setAgentOverrides({
    agentId: AGENT_ID,
    botToken: agentConfig.botToken,
    cwd: agentDir,
    model: agentConfig.model,
    obsidian: agentConfig.obsidian,
    systemPrompt,
    mcpServers: agentConfig.mcpServers,
    skillsAllowlist: agentConfig.skillsAllowlist,
  });
  logger.info({ agentId: AGENT_ID, name: agentConfig.name }, 'Running as agent');
} else {
  // For main bot: load CLAUDE.md from CLAUDECLAW_CONFIG/agents/main/ (same
  // pattern as sub-agents). Falls back to CLAUDECLAW_CONFIG/CLAUDE.md for
  // backward compatibility with setups that only have a root-level file.
  const agentClaudeMd = resolveAgentClaudeMd('main');
  const rootClaudeMd = path.join(CLAUDECLAW_CONFIG, 'CLAUDE.md');
  const claudeMdSource = agentClaudeMd ?? (fs.existsSync(rootClaudeMd) ? rootClaudeMd : null);

  if (claudeMdSource) {
    let systemPrompt: string | undefined;
    try {
      systemPrompt = fs.readFileSync(claudeMdSource, 'utf-8');
    } catch { /* unreadable */ }
    if (systemPrompt) {
      setAgentOverrides({
        agentId: 'main',
        botToken: activeBotToken,
        cwd: PROJECT_ROOT,
        systemPrompt,
      });
      logger.info({ source: claudeMdSource }, 'Loaded CLAUDE.md from CLAUDECLAW_CONFIG');
    }
  } else if (!fs.existsSync(path.join(PROJECT_ROOT, 'CLAUDE.md'))) {
    logger.warn(
      'No CLAUDE.md found. Copy CLAUDE.md.example to %s/agents/main/CLAUDE.md and customize it.',
      CLAUDECLAW_CONFIG,
    );
  }
}

const PID_FILE = path.join(STORE_DIR, `${AGENT_ID === 'main' ? 'claudeclaw' : `agent-${AGENT_ID}`}.pid`);

function showBanner(): void {
  const bannerPath = path.join(PROJECT_ROOT, 'banner.txt');
  try {
    const banner = fs.readFileSync(bannerPath, 'utf-8');
    console.log('\n' + banner);
  } catch {
    console.log('\n  ClaudeClaw\n');
  }
}

function acquireLock(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  try {
    if (fs.existsSync(PID_FILE)) {
      const old = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (!isNaN(old) && old !== process.pid) {
        try {
          process.kill(old, 'SIGTERM');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
        } catch { /* already dead */ }
      }
    }
  } catch { /* ignore */ }
  fs.writeFileSync(PID_FILE, String(process.pid), { mode: 0o600 });
}

function releaseLock(): void {
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

async function main(): Promise<void> {
  
  checkPendingMigrations(PROJECT_ROOT);

  if (AGENT_ID === 'main') {
    showBanner();
  }

  // Messenger-specific startup checks. Signal uses signal-cli (no token),
  // Telegram needs a bot token from @BotFather.
  if (MESSENGER_TYPE === 'signal') {
    if (!SIGNAL_PHONE_NUMBER) {
      logger.error('SIGNAL_PHONE_NUMBER not set. Link signal-cli first, then set it in .env.');
      process.exit(1);
    }
  } else {
    if (!activeBotToken) {
      if (AGENT_ID === 'main') {
        logger.error('Bot token is not set. Run npm run setup to configure it.');
      } else {
        logger.error({ agentId: AGENT_ID }, `Configuration for agent "${AGENT_ID}" is broken: bot token not set. Check .env or re-run npm run agent:create.`);
      }
      process.exit(1);
    }
  }

  acquireLock();

  try {
    initDatabase();
  } catch (err: any) {
    logger.error('Database initialization failed: %s', err?.message || err);
    if (err?.message?.includes('DB_ENCRYPTION_KEY')) {
      logger.error('Fix: add DB_ENCRYPTION_KEY to .env. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    process.exit(1);
  }
  logger.info('Database ready');

  // Initialize security (PIN lock, kill phrase, destructive confirmation, audit)
  initSecurity({
    pinHash: SECURITY_PIN_HASH || undefined,
    idleLockMinutes: IDLE_LOCK_MINUTES,
    killPhrase: EMERGENCY_KILL_PHRASE || undefined,
  });
  setAuditCallback((entry) => {
    insertAuditLog(entry.agentId, entry.chatId, entry.action, entry.detail, entry.blocked);
  });

  initOrchestrator();

  // Decay and consolidation run ONLY in the main process to prevent
  // multi-process over-decay (5x decay on simultaneous restart) and
  // duplicate consolidation records from overlapping memory batches.
  if (AGENT_ID === 'main') {
    runDecaySweep();
    cleanupOldMissionTasks(7);
    setInterval(() => { runDecaySweep(); cleanupOldMissionTasks(7); }, 24 * 60 * 60 * 1000);

    // Memory consolidation: find patterns across recent memories every 30 minutes
    if (ALLOWED_CHAT_ID && GOOGLE_API_KEY) {
      // Delay first consolidation 2 minutes after startup to let things settle
      setTimeout(() => {
        void runConsolidation(ALLOWED_CHAT_ID).catch((err) =>
          logger.error({ err }, 'Initial consolidation failed'),
        );
      }, 2 * 60 * 1000);
      setInterval(() => {
        void runConsolidation(ALLOWED_CHAT_ID).catch((err) =>
          logger.error({ err }, 'Periodic consolidation failed'),
        );
      }, 30 * 60 * 1000);
      logger.info('Memory consolidation enabled (every 30 min)');
    }
  } else {
    logger.info({ agentId: AGENT_ID }, 'Skipping decay/consolidation (main process owns these)');
  }

  cleanupOldUploads();

  // ── Messenger: create either the Telegram bot (grammy) or the Signal bot
  // (signal-cli JSON-RPC). Both expose a messenger-agnostic `sendToPrimary`
  // helper used by scheduler, War Room status messages, and OAuth alerts.
  const useSignal = MESSENGER_TYPE === 'signal';
  const bot = useSignal ? null : createBot();
  const signalBot: SignalBot | null = useSignal ? createSignalBot() : null;

  // Recipient for status messages (scheduler output, War Room errors, etc.).
  // Telegram: ALLOWED_CHAT_ID. Signal: first entry in SIGNAL_AUTHORIZED_RECIPIENTS,
  // falling back to the daemon's own number (sync-to-self works for testing).
  const primaryRecipient = useSignal
    ? (SIGNAL_AUTHORIZED_RECIPIENTS[0] ?? SIGNAL_PHONE_NUMBER)
    : ALLOWED_CHAT_ID;

  async function sendToPrimary(text: string): Promise<void> {
    if (!primaryRecipient) return;
    if (useSignal && signalBot) {
      await signalBot.sendTo(primaryRecipient, text).catch((err) =>
        logger.error({ err }, 'Signal status message failed'),
      );
    } else if (bot) {
      const { splitMessage } = await import('./bot.js');
      for (const chunk of splitMessage(text)) {
        await bot.api.sendMessage(primaryRecipient, chunk, { parse_mode: 'HTML' }).catch((err) =>
          logger.error({ err }, 'Telegram status message failed'),
        );
      }
    }
  }

  // Dashboard only runs in the main bot process. Signal has no bot.api;
  // pass undefined so the dashboard just skips the "send from dashboard"
  // feature instead of crashing.
  if (AGENT_ID === 'main') {
    startDashboard(bot?.api);

    // War Room voice server (auto-start if enabled, with auto-respawn)
    if (WARROOM_ENABLED) {
      const { spawn } = await import('child_process');
      const venvPython = path.join(PROJECT_ROOT, 'warroom', '.venv', 'bin', 'python');
      const serverScript = path.join(PROJECT_ROOT, 'warroom', 'server.py');

      // Write agent roster to /tmp so the Python server can discover agents dynamically
      try {
        const ids = ['main', ...listAgentIds().filter((id) => id !== 'main')];
        const roster = ids.map((id) => {
          try {
            const cfg = loadAgentConfig(id);
            return { id, name: cfg.name || id, description: cfg.description || '' };
          } catch {
            const fallbackName = id.charAt(0).toUpperCase() + id.slice(1);
            return { id, name: fallbackName, description: '' };
          }
        });
        fs.writeFileSync('/tmp/warroom-agents.json', JSON.stringify(roster, null, 2));
      } catch (err) {
        logger.warn({ err }, 'Could not write warroom agent roster');
      }

      if (fs.existsSync(venvPython) && fs.existsSync(serverScript)) {
        // Pre-flight: verify Python dependencies are actually installed
        const { spawnSync } = await import('child_process');
        const depCheck = spawnSync(venvPython, ['-c', 'import pipecat'], { stdio: 'pipe', timeout: 10000 });
        if (depCheck.status !== 0) {
          const msg = 'War Room Python dependencies not installed. Run:\n\n'
            + 'source warroom/.venv/bin/activate\n'
            + 'pip install -r warroom/requirements.txt\n\n'
            + 'Then restart the bot.';
          logger.error(msg);
          void sendToPrimary(`War Room could not start.\n\n${msg}`);
        } else {
        // Dedicated log file for the warroom subprocess
        const warroomLogPath = '/tmp/warroom-debug.log';
        let warroomLogFd: number | null = null;
        try {
          warroomLogFd = fs.openSync(warroomLogPath, 'a');
        } catch (err) {
          logger.warn({ err, warroomLogPath }, 'Could not open warroom log');
        }

        const MAX_CRASH_RESPAWNS = 3;
        let respawnAttempts = 0;
        let shuttingDown = false;
        let currentProc: ReturnType<typeof spawn> | null = null;

        const spawnWarroom = (): void => {
          if (shuttingDown) return;
          const proc = spawn(venvPython, [serverScript], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, WARROOM_PORT: String(WARROOM_PORT) },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          currentProc = proc;

          proc.stdout.once('data', (data: Buffer) => {
            try {
              const info = JSON.parse(data.toString().trim());
              logger.info({ port: WARROOM_PORT, ws_url: info.ws_url, pid: proc.pid }, 'War Room server started');
            } catch {
              logger.info({ port: WARROOM_PORT, pid: proc.pid }, 'War Room server started');
            }
            respawnAttempts = 0; // reset backoff once we see a ready line
          });

          // Forward stdout+stderr into the dedicated log file.
          if (warroomLogFd !== null) {
            const write = (buf: Buffer) => { try { fs.writeSync(warroomLogFd!, buf); } catch { /* ok */ } };
            proc.stdout.on('data', write);
            proc.stderr.on('data', write);
          }

          proc.on('exit', (code, signal) => {
            if (shuttingDown) return;
            const wasIntentional = signal === 'SIGTERM' || signal === 'SIGKILL' || signal === 'SIGINT';
            logger.warn({ code, signal, pid: proc.pid, intentional: wasIntentional }, 'War Room server exited');
            let delayMs: number;
            if (wasIntentional) {
              delayMs = 300;
              respawnAttempts = 0;
            } else {
              respawnAttempts += 1;
              if (respawnAttempts > MAX_CRASH_RESPAWNS) {
                logger.error(`War Room crashed ${MAX_CRASH_RESPAWNS} times. Giving up. Check /tmp/warroom-debug.log for errors.`);
                void sendToPrimary(`War Room crashed ${MAX_CRASH_RESPAWNS} times and has been disabled.\n\nCheck /tmp/warroom-debug.log, fix the issue, and restart the bot.`);
                return;
              }
              delayMs = Math.min(30000, 500 * 2 ** Math.min(respawnAttempts, 6));
            }
            logger.info({ delayMs, attempt: respawnAttempts }, 'Respawning War Room server');
            setTimeout(spawnWarroom, delayMs);
          });
        };

        spawnWarroom();

        // Clean up on main process exit.
        const shutdownWarroom = () => {
          shuttingDown = true;
          try { currentProc?.kill(); } catch { /* ok */ }
          if (warroomLogFd !== null) { try { fs.closeSync(warroomLogFd); } catch { /* ok */ } }
        };
        process.on('exit', shutdownWarroom);
        process.on('SIGTERM', shutdownWarroom);
        process.on('SIGINT', shutdownWarroom);
        } // end dep check else
      } else {
        const missingVenv = !fs.existsSync(venvPython);
        const missingScript = !fs.existsSync(serverScript);
        const hint = missingVenv
          ? 'Python venv not found. Run:\n\npython3 -m venv warroom/.venv\nsource warroom/.venv/bin/activate\npip install -r warroom/requirements.txt'
          : 'warroom/server.py not found. Make sure the warroom/ directory exists.';
        logger.warn('War Room enabled but cannot start: %s', hint);
        void sendToPrimary(`War Room is enabled but could not start.\n\n${hint}`);
      }
    }
  }

  if (primaryRecipient) {
    initScheduler(
      async (text) => {
        await sendToPrimary(text);
      },
      AGENT_ID,
    );

    // Proactive OAuth health monitoring — alerts before the Claude CLI token
    // expires. OPT-IN (OAUTH_HEALTH_ENABLED=true in .env).
    const oauthHealthEnv = (await import('./env.js')).readEnvFile(['OAUTH_HEALTH_ENABLED']);
    if ((oauthHealthEnv.OAUTH_HEALTH_ENABLED || '').trim().toLowerCase() === 'true') {
      initOAuthHealthCheck(async (text) => {
        await sendToPrimary(text);
      });
    } else {
      logger.info('OAuth health check disabled (set OAUTH_HEALTH_ENABLED=true in .env to enable)');
    }
  } else {
    logger.warn('No primary recipient configured — scheduler disabled');
  }

  const shutdown = async () => {
    logger.info('Shutting down...');
    setTelegramConnected(false);
    releaseLock();
    if (bot) await bot.stop();
    if (signalBot) await signalBot.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  logger.info({ agentId: AGENT_ID, messenger: MESSENGER_TYPE }, 'Starting ClaudeClaw...');

  if (useSignal && signalBot) {
    await signalBot.start();
    setTelegramConnected(true); // reuse the connected flag for dashboard state
    setBotInfo('signal', `ClaudeClaw (Signal)`);
    if (AGENT_ID === 'main') {
      console.log(`\n  ClaudeClaw online via Signal: ${SIGNAL_PHONE_NUMBER}`);
      if (SIGNAL_AUTHORIZED_RECIPIENTS.length === 0) {
        console.log('  No SIGNAL_AUTHORIZED_RECIPIENTS set — only sync-to-self messages will be accepted.');
      }
      console.log();
    } else {
      console.log(`\n  ClaudeClaw agent [${AGENT_ID}] online via Signal\n`);
    }
    return;
  }

  if (!bot) throw new Error('Telegram bot not created and Signal not active — check MESSENGER_TYPE.');

  // Clear any existing webhook so polling works cleanly (e.g., if token was
  // previously used with a webhook-based bot or another ClaudeClaw instance).
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
  } catch (err) {
    logger.warn({ err }, 'Could not clear webhook (non-fatal)');
  }

  await bot.start({
    onStart: (botInfo) => {
      setTelegramConnected(true);
      setBotInfo(botInfo.username ?? '', botInfo.first_name ?? 'ClaudeClaw');
      logger.info({ username: botInfo.username }, 'ClaudeClaw is running');
      if (AGENT_ID === 'main') {
        console.log(`\n  ClaudeClaw online: @${botInfo.username}`);
        if (!ALLOWED_CHAT_ID) {
          console.log(`  Send /chatid to get your chat ID for ALLOWED_CHAT_ID`);
        }
        console.log();
      } else {
        console.log(`\n  ClaudeClaw agent [${AGENT_ID}] online: @${botInfo.username}\n`);
      }
    },
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal error');
  releaseLock();
  process.exit(1);
});
