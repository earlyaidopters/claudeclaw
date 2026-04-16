import fs from 'fs';
import path from 'path';

import { loadAgentConfig, resolveAgentDir, resolveAgentClaudeMd } from './agent-config.js';
import { createBot } from './bot.js';
import { checkPendingMigrations } from './migrations.js';
import { ALLOWED_CHAT_ID, activeBotToken, STORE_DIR, PROJECT_ROOT, CLAUDECLAW_CONFIG, GOOGLE_API_KEY, setAgentOverrides, SECURITY_PIN_HASH, IDLE_LOCK_MINUTES, EMERGENCY_KILL_PHRASE } from './config.js';
import { startDashboard } from './dashboard.js';
import { initDatabase, cleanupOldMissionTasks, insertAuditLog } from './db.js';
import { initSecurity, setAuditCallback } from './security.js';
import { logger } from './logger.js';
import { cleanupOldUploads } from './media.js';
import { runConsolidation } from './memory-consolidate.js';
import { runDecaySweep } from './memory.js';
import { initOrchestrator } from './orchestrator.js';
import { initOAuthHealthCheck } from './oauth-health.js';
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
  });
  logger.info(
    {
      agentId: AGENT_ID,
      name: agentConfig.name,
      mcpAllowlist: agentConfig.mcpServers ?? 'all',
    },
    'Running as agent',
  );
} else {
  // For main bot: read CLAUDE.md from CLAUDECLAW_CONFIG and inject it as
  // systemPrompt — the same pattern used by sub-agents. Never copy the file
  // into the repo; that defeats the purpose of CLAUDECLAW_CONFIG and risks
  // accidentally committing personal config.
  const externalClaudeMd = path.join(CLAUDECLAW_CONFIG, 'CLAUDE.md');
  if (fs.existsSync(externalClaudeMd)) {
    let systemPrompt: string | undefined;
    try {
      systemPrompt = fs.readFileSync(externalClaudeMd, 'utf-8');
    } catch { /* unreadable */ }
    if (systemPrompt) {
      setAgentOverrides({
        agentId: 'main',
        botToken: activeBotToken,
        cwd: PROJECT_ROOT,
        systemPrompt,
      });
      logger.info({ source: externalClaudeMd }, 'Loaded CLAUDE.md from CLAUDECLAW_CONFIG');
    }
  } else if (!fs.existsSync(path.join(PROJECT_ROOT, 'CLAUDE.md'))) {
    logger.warn(
      'No CLAUDE.md found. Copy CLAUDE.md.example to %s/CLAUDE.md and customize it.',
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

  if (!activeBotToken) {
    if (AGENT_ID === 'main') {
      logger.error('Bot token is not set. Run npm run setup to configure it.');
    } else {
      logger.error({ agentId: AGENT_ID }, `Configuration for agent "${AGENT_ID}" is broken: bot token not set. Check .env or re-run npm run agent:create.`);
    }
    process.exit(1);
  }

  acquireLock();

  initDatabase();
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

  const bot = createBot();

  // Dashboard only runs in the main bot process
  if (AGENT_ID === 'main') {
    startDashboard(bot.api);
  }

  if (ALLOWED_CHAT_ID) {
    initScheduler(
      async (text) => {
        // Split long messages to respect Telegram's 4096 char limit.
        // The scheduler's splitMessage handles chunking, but the sender
        // callback is also called directly for status messages which may exceed the limit.
        const { splitMessage } = await import('./bot.js');
        for (const chunk of splitMessage(text)) {
          await bot.api.sendMessage(ALLOWED_CHAT_ID, chunk, { parse_mode: 'HTML' }).catch((err) =>
            logger.error({ err }, 'Scheduler failed to send message'),
          );
        }
      },
      AGENT_ID,
    );

    // Proactive OAuth health monitoring - alerts before token expires
    initOAuthHealthCheck(async (text) => {
      const { splitMessage } = await import('./bot.js');
      for (const chunk of splitMessage(text)) {
        await bot.api.sendMessage(ALLOWED_CHAT_ID, chunk, { parse_mode: 'HTML' }).catch((err) =>
          logger.error({ err }, 'OAuth health alert failed'),
        );
      }
    });
  } else {
    logger.warn('ALLOWED_CHAT_ID not set — scheduler disabled (no destination for results)');
  }

  const shutdown = async () => {
    logger.info('Shutting down...');
    setTelegramConnected(false);
    releaseLock();
    await bot.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  logger.info({ agentId: AGENT_ID }, 'Starting ClaudeClaw...');

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
