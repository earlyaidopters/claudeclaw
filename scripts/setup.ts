#!/usr/bin/env tsx
import crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// ── ANSI helpers ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
};

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

// ── Banner ───────────────────────────────────────────────────────────────────
function loadBanner(): string {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, 'banner.txt'), 'utf-8');
  } catch {
    return '\n  ClaudeClaw\n';
  }
}

// ── Shared readline ──────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

async function ask(question: string, defaultVal?: string): Promise<string> {
  return new Promise((resolve) => {
    const hint = defaultVal ? ` ${c.gray}(${defaultVal})${c.reset}` : '';
    rl.question(`  ${c.bold}${question}${c.reset}${hint} › `, (ans) => {
      resolve(ans.trim() || defaultVal || '');
    });
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const ans = await ask(`${question} [${hint}]`);
  if (!ans) return defaultYes;
  return ans.toLowerCase().startsWith('y');
}

function section(title: string) {
  console.log();
  console.log(`  ${c.bold}${c.white}${title}${c.reset}`);
  console.log(`  ${c.gray}${'─'.repeat(title.length + 2)}${c.reset}`);
  console.log();
}

function info(msg: string) {
  console.log(`  ${c.gray}${msg}${c.reset}`);
}

function ok(msg: string) {
  console.log(`  ${c.green}✓${c.reset}  ${msg}`);
}

function warn(msg: string) {
  console.log(`  ${c.yellow}⚠${c.reset}  ${msg}`);
}

function fail(msg: string) {
  console.log(`  ${c.red}✗${c.reset}  ${msg}`);
}

function bullet(msg: string) {
  console.log(`  ${c.cyan}•${c.reset}  ${msg}`);
}

function spinner(label: string): { stop: (status: 'ok' | 'fail' | 'warn', msg?: string) => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const iv = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${frames[i++ % frames.length]}${c.reset}  ${label}   `);
  }, 80);
  return {
    stop(status, msg) {
      clearInterval(iv);
      const icon = status === 'ok' ? `${c.green}✓${c.reset}` : status === 'warn' ? `${c.yellow}⚠${c.reset}` : `${c.red}✗${c.reset}`;
      process.stdout.write(`\r  ${icon}  ${msg ?? label}\n`);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return result; }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) result[key] = value;
  }
  return result;
}

async function validateBotToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok: boolean; result?: { username?: string } };
    if (data.ok && data.result) return { valid: true, username: data.result.username };
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

const PLATFORM = process.platform;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {

  // ── 1. Banner + intro ────────────────────────────────────────────────────
  console.log(`${c.cyan}${c.bold}${loadBanner()}${c.reset}`);
  console.log(`  ${c.bold}Welcome to ClaudeClaw.${c.reset}`);
  console.log();
  info('This wizard will get you set up in about 5 minutes.');
  info('Press Ctrl+C at any time to exit. You can re-run this at any time with: npm run setup');
  console.log();

  // ── 2. What is ClaudeClaw ────────────────────────────────────────────────
  section('What is ClaudeClaw?');

  console.log(`  ClaudeClaw bridges your Claude Code CLI to Telegram.`);
  console.log(`  You message your bot from your phone. ClaudeClaw runs the`);
  console.log(`  ${c.bold}actual${c.reset} ${c.cyan}claude${c.reset} CLI on your computer — with all your skills,`);
  console.log(`  tools, and context — and sends the result back to you.`);
  console.log();
  console.log(`  ${c.bold}It is not a chatbot wrapper.${c.reset} It runs real Claude Code.`);
  console.log(`  Everything you can do in your terminal, you can do from your phone.`);
  console.log();

  bullet('Text, voice, photos, documents, and videos');
  bullet('All your installed Claude Code skills auto-load');
  bullet('Persistent memory across messages');
  bullet('Scheduled autonomous tasks (cron)');
  bullet('Optional WhatsApp bridge');
  console.log();

  const understood = await confirm('Ready to continue?');
  if (!understood) {
    console.log();
    info('Come back when you\'re ready. Run npm run setup to start again.');
    return;
  }

  // ── 3. System checks ─────────────────────────────────────────────────────
  section('System checks');

  // Node
  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  if (nodeMajor >= 20) {
    ok(`Node.js ${process.version}`);
  } else {
    fail(`Node.js ${process.version} — version 20+ required`);
    info('Download: https://nodejs.org');
    process.exit(1);
  }

  // Claude CLI
  const claudeCmd = PLATFORM === 'win32' ? 'where claude' : 'which claude';
  try {
    execSync(claudeCmd, { stdio: 'pipe' });
    let version = '';
    try { version = execSync('claude --version', { stdio: 'pipe' }).toString().trim(); } catch { }
    ok(`Claude CLI ${version}`);
  } catch {
    fail('Claude CLI not found');
    console.log();
    info('Install it:');
    info('  npm install -g @anthropic-ai/claude-code');
    info('  claude login');
    console.log();
    const proceed = await confirm('Install Claude Code now and re-run setup later?', false);
    if (proceed) {
      console.log();
      info('Running: npm install -g @anthropic-ai/claude-code');
      const result = spawnSync('npm', ['install', '-g', '@anthropic-ai/claude-code'], { stdio: 'inherit' });
      if (result.status === 0) {
        ok('Claude Code installed. Run claude login, then npm run setup again.');
      } else {
        fail('Install failed. Run manually: npm install -g @anthropic-ai/claude-code');
      }
    }
    process.exit(1);
  }

  // Claude auth
  try {
    execSync('claude --version', { stdio: 'pipe' });
    ok('Claude auth — logged in');
  } catch {
    warn('Could not verify Claude auth. If you\'re not logged in, run: claude login');
  }

  // Git config (user.name and user.email)
  let gitName = '';
  let gitEmail = '';
  try { gitName = execSync('git config user.name', { stdio: 'pipe' }).toString().trim(); } catch { }
  try { gitEmail = execSync('git config user.email', { stdio: 'pipe' }).toString().trim(); } catch { }
  if (gitName && gitEmail) {
    ok(`Git identity: ${gitName} <${gitEmail}>`);
  } else {
    warn('Git identity not configured — this will cause errors later');
    console.log();
    info('Run these two commands (use your own name and email):');
    console.log(`  ${c.cyan}git config --global user.name "Your Name"${c.reset}`);
    console.log(`  ${c.cyan}git config --global user.email "you@email.com"${c.reset}`);
    console.log();
    const fixNow = await confirm('Set them now?', true);
    if (fixNow) {
      const name = await ask('Your name');
      const email = await ask('Your email');
      if (name) { try { execSync(`git config --global user.name "${name}"`, { stdio: 'pipe' }); } catch { } }
      if (email) { try { execSync(`git config --global user.email "${email}"`, { stdio: 'pipe' }); } catch { } }
      if (name && email) ok(`Git identity set: ${name} <${email}>`);
    }
  }

  // Build check
  const distExists = fs.existsSync(path.join(PROJECT_ROOT, 'dist', 'index.js'));
  if (distExists) {
    ok('Build output found (dist/)');
  } else {
    warn('Not built yet — building now...');
    const build = spawnSync('npm', ['run', 'build'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    if (build.status === 0) {
      ok('Build complete');
    } else {
      fail('Build failed. Fix TypeScript errors, then re-run setup.');
      process.exit(1);
    }
  }

  // ── 4. What do you want to enable? ──────────────────────────────────────
  section('Choose your features');

  info('ClaudeClaw has several optional features. Tell us what you want.');
  info('You can always add more later by editing .env and restarting.');
  console.log();

  const wantVoiceIn = await confirm('Voice input? (send voice notes → transcribed by Groq Whisper, free)', true);
  const wantVoiceOut = wantVoiceIn
    ? await confirm('Voice output? (Claude responds with audio via ElevenLabs — requires voice cloning)', false)
    : false;
  const wantVideo = await confirm('Video analysis? (send video clips → analyzed by Google Gemini)', false);
  const wantWhatsApp = await confirm('WhatsApp bridge? (view and reply to WhatsApp from Telegram)', false);

  // WhatsApp explanation if they said yes
  if (wantWhatsApp) {
    console.log();
    console.log(`  ${c.bold}How the WhatsApp bridge works:${c.reset}`);
    console.log();
    info('ClaudeClaw uses whatsapp-web.js to connect to your existing WhatsApp');
    info('account via the Linked Devices feature (same as WhatsApp Web).');
    console.log();
    info('A separate process (wa-daemon) runs in the background:');
    bullet('Keeps a Puppeteer browser session alive');
    bullet('Stores incoming messages to SQLite');
    bullet('Exposes an HTTP API on port 4242');
    console.log();
    info('First run: a QR code prints to your terminal. Scan it from');
    info('WhatsApp → Settings → Linked Devices. Session saves after that.');
    console.log();
    info('No API key needed — it uses your existing WhatsApp account.');
    console.log();

    console.log(`  ${c.bold}Message security:${c.reset}`);
    console.log();
    bullet('All message bodies are encrypted at rest (AES-256-GCM)');
    bullet('Messages auto-delete after 3 days');
    bullet('The database and session files are gitignored and never committed');
    bullet('Encryption key is stored in your .env (auto-generated if not set)');
    console.log();

    warn('Note: WhatsApp may occasionally disconnect and require a re-scan.');
    console.log();
  }

  // ── 5. Explore the ecosystem ─────────────────────────────────────────────
  section('The Claw ecosystem');

  info('ClaudeClaw is one of several "Claw" projects. You might want to');
  info('look at others for inspiration or to use a different channel:');
  console.log();
  bullet(`${c.bold}NanoClaw${c.reset}  github.com/qwibitai/nanoclaw       — WhatsApp, isolated containers`);
  bullet(`${c.bold}OpenClaw${c.reset}  github.com/openclaw/openclaw       — 10+ channels (Slack, Discord, iMessage...)`);
  bullet(`${c.bold}TinyClaw${c.reset}  github.com/jlia0/tinyclaw          — ~400 lines shell, no Node`);
  console.log();

  const cloneInspiration = await confirm('Clone any of these repos to browse locally?', false);
  if (cloneInspiration) {
    console.log();
    info('Which ones? (space-separated: nanoclaw openclaw tinyclaw)');
    const picks = await ask('Repos to clone', 'skip');
    if (picks !== 'skip' && picks.trim()) {
      const map: Record<string, string> = {
        nanoclaw: 'https://github.com/qwibitai/nanoclaw.git',
        openclaw: 'https://github.com/openclaw/openclaw.git',
        tinyclaw: 'https://github.com/jlia0/tinyclaw.git',
      };
      const cloneDir = path.join(PROJECT_ROOT, '..', 'claw-inspiration');
      fs.mkdirSync(cloneDir, { recursive: true });
      for (const name of picks.toLowerCase().split(/\s+/)) {
        const url = map[name];
        if (url) {
          const s = spinner(`Cloning ${name}...`);
          const r = spawnSync('git', ['clone', url, path.join(cloneDir, name)], { stdio: 'pipe' });
          r.status === 0 ? s.stop('ok', `Cloned ${name} → ${cloneDir}/${name}`) : s.stop('warn', `Could not clone ${name}`);
        }
      }
    }
  }

  // ── 6. Config directory (CLAUDECLAW_CONFIG) ──────────────────────────────
  section('Config directory (CLAUDECLAW_CONFIG)');

  info('Personal config files (CLAUDE.md, agent configs) live outside the repo');
  info('so they are never accidentally committed. Defaults to ~/.claudeclaw');
  console.log();

  const envForConfig = parseEnvFile(path.join(PROJECT_ROOT, '.env'));
  const defaultConfigDir = expandHome(
    envForConfig.CLAUDECLAW_CONFIG || '~/.claudeclaw',
  );
  info(`Current path: ${defaultConfigDir}`);
  console.log();

  let claudeclawConfigDir = defaultConfigDir;
  const changeConfigDir = await confirm('Change this path?', false);
  if (changeConfigDir) {
    const input = await ask('Config directory', '~/.claudeclaw');
    claudeclawConfigDir = expandHome(input.trim() || '~/.claudeclaw');
  }

  // If the chosen directory already exists, notify and let user decide
  if (fs.existsSync(claudeclawConfigDir)) {
    const hasClaudeMd = fs.existsSync(path.join(claudeclawConfigDir, 'CLAUDE.md'));
    ok(`Directory already exists${hasClaudeMd ? ' — CLAUDE.md found' : ' — no CLAUDE.md yet'}`);
    const useExisting = await confirm('Use this directory as-is?', true);
    if (!useExisting) {
      const newPath = await ask('Enter a different path');
      if (newPath.trim()) claudeclawConfigDir = expandHome(newPath.trim());
    }
  }

  // Create the directory if needed
  if (!fs.existsSync(claudeclawConfigDir)) {
    fs.mkdirSync(claudeclawConfigDir, { recursive: true });
    ok(`Created ${claudeclawConfigDir}`);
  }

  // Ensure CLAUDE.md exists in the config dir (copy from example if needed)
  const claudeMdDest = path.join(claudeclawConfigDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdDest)) {
    const exampleSrc = path.join(PROJECT_ROOT, 'CLAUDE.md.example');
    if (fs.existsSync(exampleSrc)) {
      fs.copyFileSync(exampleSrc, claudeMdDest);
      ok(`Created CLAUDE.md from template → ${claudeMdDest}`);
    } else {
      warn(`No CLAUDE.md.example found — create ${claudeMdDest} manually`);
    }
  } else {
    ok(`CLAUDE.md exists at ${claudeMdDest}`);
  }

  // ── 6b. CLAUDE.md personalization ────────────────────────────────────────
  section('Personalize your assistant (CLAUDE.md)');

  info('CLAUDE.md is the personality and context file loaded into every session.');
  info('It defines who your assistant is, what you do, and how it communicates.');
  console.log();
  info('At minimum, replace the [BRACKETED] placeholders:');
  bullet('[YOUR ASSISTANT NAME]  — what you want to call the bot');
  bullet('[YOUR NAME]            — your name (so it knows who it\'s talking to)');
  bullet('[YOUR_OBSIDIAN_VAULT]  — path to your Obsidian vault, if you use one');
  console.log();
  info('The more context you add, the better it performs without explaining things');
  info('in every message. Think of it as a system prompt that persists everywhere.');
  console.log();

  const openClaude = await confirm('Open CLAUDE.md now to edit it?', true);
  if (openClaude) {
    const editor = process.env.EDITOR || (PLATFORM === 'win32' ? 'notepad' : 'nano');
    try {
      spawnSync(editor, [claudeMdDest], { stdio: 'inherit' });
    } catch {
      warn(`Could not open ${editor}. Edit manually: ${claudeMdDest}`);
    }
  }

  // ── 7. Skills to install ─────────────────────────────────────────────────
  section('Skills you might want');

  info('ClaudeClaw auto-loads every skill in ~/.claude/skills/.');
  info('Here are the most useful ones to install:');
  console.log();

  console.log(`  ${c.bold}Core skills (for everyone):${c.reset}`);
  bullet('gmail           — read, triage, reply to email');
  bullet('google-calendar — schedule meetings, check availability');
  bullet('todo            — read tasks from Obsidian or text files');
  bullet('agent-browser   — browse the web, fill forms, scrape data');
  bullet('maestro         — run tasks in parallel with sub-agents');
  console.log();

  if (wantVideo) {
    console.log(`  ${c.bold}Gemini skill (required for video analysis):${c.reset}`);
    console.log();
    info('ClaudeClaw\'s video analysis uses the gemini-api-dev skill from Google.');
    info('It handles text, images, audio, video, function calling, and structured output.');
    info('Install it from: https://github.com/google-gemini/gemini-skills');
    console.log();
    bullet('Skill docs:  github.com/google-gemini/gemini-skills/blob/main/skills/gemini-api-dev/SKILL.md');
    bullet('Requires:    GOOGLE_API_KEY in .env (get free at aistudio.google.com)');
    bullet('Install:     Copy the skill folder into ~/.claude/skills/gemini-api-dev/');
    console.log();
  }

  info('Full skills catalog: https://github.com/anthropics/claude-code/tree/main/skills');
  console.log();

  // ── 8. API keys ───────────────────────────────────────────────────────────
  section('Telegram');

  const envPath = path.join(PROJECT_ROOT, '.env');
  const env: Record<string, string> = fs.existsSync(envPath) ? parseEnvFile(envPath) : {};

  // Persist CLAUDECLAW_CONFIG determined in section 6
  env.CLAUDECLAW_CONFIG = claudeclawConfigDir;

  let botUsername = '';
  if (env.TELEGRAM_BOT_TOKEN) {
    const s = spinner('Validating existing bot token...');
    const r = await validateBotToken(env.TELEGRAM_BOT_TOKEN);
    if (r.valid) {
      botUsername = r.username || '';
      s.stop('ok', `Bot: @${botUsername}`);
    } else {
      s.stop('fail', 'Existing token invalid — enter a new one');
      delete env.TELEGRAM_BOT_TOKEN;
    }
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log();
    info('You need a Telegram bot token. Get one from @BotFather:');
    bullet('Open Telegram → search @BotFather');
    bullet('Send /newbot');
    bullet('Follow the prompts, copy the token it gives you');
    console.log();

    let valid = false;
    while (!valid) {
      const token = await ask('Paste your bot token');
      if (!token) { console.log(`  ${c.red}Required.${c.reset}`); continue; }
      const s = spinner('Validating...');
      const r = await validateBotToken(token);
      if (r.valid) {
        env.TELEGRAM_BOT_TOKEN = token;
        botUsername = r.username || '';
        s.stop('ok', `Bot: @${botUsername}`);
        valid = true;
      } else {
        s.stop('fail', 'Invalid token. Try again.');
      }
    }
  }

  console.log();
  if (env.ALLOWED_CHAT_ID) {
    ok(`Chat ID: ${env.ALLOWED_CHAT_ID}`);
  } else {
    info('Your chat ID locks the bot so only YOU can talk to it.');
    info('To get it, you need to have a quick conversation with your bot:');
    console.log();
    bullet('Open Telegram on your phone or desktop');
    bullet(`Search for your bot: @${botUsername || 'your_bot_username'}`);
    bullet('Tap Start or send any message to it');
    bullet('The bot will reply with your chat ID (a number like 123456789)');
    bullet('Copy that number and paste it below');
    console.log();
    info('Don\'t have it yet? Press Enter to skip. The bot will show your');
    info('chat ID the first time you message it. Add it to .env and restart.');
    console.log();
    const chatId = await ask('Your Telegram chat ID (or Enter to skip)', 'skip');
    if (chatId !== 'skip' && chatId) env.ALLOWED_CHAT_ID = chatId;
  }

  // ── 9. Security ──────────────────────────────────────────────────────────
  section('Secure your bot');

  info('ClaudeClaw has full access to your machine. If someone gets into');
  info('your Telegram account, they control the bot. These layers protect you.');
  console.log();

  // Dashboard token (always generate)
  if (!env.DASHBOARD_TOKEN) {
    env.DASHBOARD_TOKEN = crypto.randomBytes(24).toString('hex');
  }
  ok('Dashboard token set');

  // PIN lock
  console.log();
  info('PIN lock: like a password for the bot. Even if someone opens your');
  info('Telegram, they can\'t use the bot without the PIN.');
  console.log();

  if (env.SECURITY_PIN_HASH) {
    ok('PIN lock already configured');
  } else {
    const wantPin = await confirm('Set up a PIN lock?');
    if (wantPin) {
      let pinSet = false;
      while (!pinSet) {
        const pin = await ask('Choose a PIN (4+ characters)');
        if (!pin || pin.length < 4) {
          console.log(`  ${c.red}PIN must be at least 4 characters.${c.reset}`);
          continue;
        }
        const pinConfirm = await ask('Confirm PIN');
        if (pin !== pinConfirm) {
          console.log(`  ${c.red}PINs don't match. Try again.${c.reset}`);
          continue;
        }
        // Salted hash: "salt:hash"
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHash('sha256').update(salt + pin).digest('hex');
        env.SECURITY_PIN_HASH = `${salt}:${hash}`;
        ok('PIN set. Bot will start locked, send the PIN to unlock.');
        pinSet = true;
      }

      // Idle timeout (only ask when PIN is set)
      console.log();
      info('Auto-lock re-locks the bot after a period of inactivity.');
      const idleMin = await ask('Lock after how many minutes idle?', '30');
      const idleVal = parseInt(idleMin) || 0;
      if (idleVal > 0) {
        env.IDLE_LOCK_MINUTES = String(idleVal);
        ok(`Auto-lock after ${idleVal}m of inactivity`);
      }
    } else {
      info('Skipped. Add SECURITY_PIN_HASH to .env later if you change your mind.');
    }
  }

  // Emergency kill phrase (auto-generate with option to customize)
  console.log();
  if (env.EMERGENCY_KILL_PHRASE) {
    ok('Emergency kill phrase already configured');
  } else {
    info('Kill phrase: a word you send to immediately shut down all agents.');
    info('Useful if something goes wrong or you suspect unauthorized access.');
    console.log();
    const defaultPhrase = 'EMERGENCY_STOP_' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const killPhrase = await ask('Kill phrase (Enter for auto-generated)', defaultPhrase);
    if (killPhrase && killPhrase.length >= 4) {
      env.EMERGENCY_KILL_PHRASE = killPhrase;
      ok('Kill phrase saved');
      info(`Remember it: ${killPhrase}`);
    }
  }

  // ── 10. Voice keys ────────────────────────────────────────────────────────
  if (wantVoiceIn || wantVoiceOut) {
    section('Voice configuration');
  }

  if (wantVoiceIn) {
    if (env.GROQ_API_KEY) {
      ok('Groq STT already configured');
    } else {
      info('Groq provides free voice transcription (Whisper large-v3).');
      info('Sign up free at: console.groq.com → API Keys');
      console.log();
      const key = await ask('Groq API key (Enter to skip)');
      if (key) env.GROQ_API_KEY = key;
    }
  }

  if (wantVoiceOut) {
    if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) {
      ok('ElevenLabs TTS already configured');
    } else {
      console.log();
      info('ElevenLabs generates spoken responses in your cloned voice.');
      info('Sign up at elevenlabs.io → clone your voice under Voice Lab.');
      console.log();
      if (!env.ELEVENLABS_API_KEY) {
        const key = await ask('ElevenLabs API key (Enter to skip)');
        if (key) env.ELEVENLABS_API_KEY = key;
      }
      if (env.ELEVENLABS_API_KEY && !env.ELEVENLABS_VOICE_ID) {
        info('Voice ID is the string ID in ElevenLabs, not the voice name.');
        const vid = await ask('ElevenLabs Voice ID (Enter to skip)');
        if (vid) env.ELEVENLABS_VOICE_ID = vid;
      }
    }
  }

  // ── 10. Video / Gemini ────────────────────────────────────────────────────
  if (wantVideo) {
    section('Video analysis — Google Gemini');

    if (env.GOOGLE_API_KEY) {
      ok('Google API key already configured');
    } else {
      info('Get a free Google API key at: aistudio.google.com → Get API key');
      info('Then install the gemini-api-dev skill from:');
      info('github.com/google-gemini/gemini-skills');
      console.log();
      const key = await ask('Google API key (Enter to skip)');
      if (key) env.GOOGLE_API_KEY = key;
    }
  }

  // ── 11. Optional Claude API key ───────────────────────────────────────────
  section('Claude authentication');

  info('By default, ClaudeClaw uses your existing claude login (Max plan).');
  info('This is fine for personal use on your own machine.');
  console.log();
  info('Set an API key if you\'re deploying on a server, or want pay-per-token');
  info('billing instead of using your subscription limits.');
  console.log();

  if (env.ANTHROPIC_API_KEY) {
    ok('API key already configured');
  } else {
    const key = await ask('Anthropic API key — optional (Enter to skip)');
    if (key) env.ANTHROPIC_API_KEY = key;
  }

  // ── Write .env ────────────────────────────────────────────────────────
  console.log();
  const sw = spinner('Saving .env...');
  await sleep(300);

  const lines = [
    '# ClaudeClaw — generated by setup wizard',
    '# Edit freely. Re-run: npm run setup',
    '',
    '# ── Required ──────────────────────────────────────────────────',
    `TELEGRAM_BOT_TOKEN=${env.TELEGRAM_BOT_TOKEN || ''}`,
    `ALLOWED_CHAT_ID=${env.ALLOWED_CHAT_ID || ''}`,
    '',
    '# ── Config directory (personal config, never committed) ───────',
    `CLAUDECLAW_CONFIG=${env.CLAUDECLAW_CONFIG || ''}`,
    '',
    '# ── Claude auth (optional — uses claude login by default) ─────',
    `ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY || ''}`,
    '',
    '# ── Voice ─────────────────────────────────────────────────────',
    `GROQ_API_KEY=${env.GROQ_API_KEY || ''}`,
    `ELEVENLABS_API_KEY=${env.ELEVENLABS_API_KEY || ''}`,
    `ELEVENLABS_VOICE_ID=${env.ELEVENLABS_VOICE_ID || ''}`,
    '',
    '# ── Integrations ──────────────────────────────────────────────',
    `GOOGLE_API_KEY=${env.GOOGLE_API_KEY || ''}`,
    '',
    '# ── Dashboard ─────────────────────────────────────────────────',
    `DASHBOARD_TOKEN=${env.DASHBOARD_TOKEN || ''}`,
    `DASHBOARD_PORT=${env.DASHBOARD_PORT || '3141'}`,
    env.DASHBOARD_URL ? `DASHBOARD_URL=${env.DASHBOARD_URL}` : '# DASHBOARD_URL=',
    '',
    '# ── Security ──────────────────────────────────────────────────',
    env.SECURITY_PIN_HASH ? `SECURITY_PIN_HASH=${env.SECURITY_PIN_HASH}` : '# SECURITY_PIN_HASH=',
    env.IDLE_LOCK_MINUTES ? `IDLE_LOCK_MINUTES=${env.IDLE_LOCK_MINUTES}` : '# IDLE_LOCK_MINUTES=30',
    env.EMERGENCY_KILL_PHRASE ? `EMERGENCY_KILL_PHRASE=${env.EMERGENCY_KILL_PHRASE}` : '# EMERGENCY_KILL_PHRASE=',
    '',
    '# ── Database Encryption ───────────────────────────────────────',
    '# Auto-generated. DO NOT share or commit.',
    `DB_ENCRYPTION_KEY=${env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')}`,
  ];

  // Preserve unknown keys
  const known = new Set(['TELEGRAM_BOT_TOKEN','ALLOWED_CHAT_ID','CLAUDECLAW_CONFIG','ANTHROPIC_API_KEY','GROQ_API_KEY','ELEVENLABS_API_KEY','ELEVENLABS_VOICE_ID','GOOGLE_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','WHATSAPP_ENABLED','DB_ENCRYPTION_KEY','DASHBOARD_TOKEN','DASHBOARD_PORT','DASHBOARD_URL','SECURITY_PIN_HASH','IDLE_LOCK_MINUTES','EMERGENCY_KILL_PHRASE','DESTRUCTIVE_CONFIRM']);
  for (const [k, v] of Object.entries(env)) {
    if (!known.has(k) && v) lines.push(`${k}=${v}`);
  }

  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');

  const written = parseEnvFile(envPath);
  const keyCount = Object.values(written).filter(Boolean).length;
  sw.stop('ok', `.env saved (${keyCount} key${keyCount !== 1 ? 's' : ''} configured)`);

  // ── 13. Auto-start service ───────────────────────────────────────────────
  if (PLATFORM === 'darwin') {
    await setupMacOS();
  } else if (PLATFORM === 'linux') {
    await setupLinux();
  } else if (PLATFORM === 'win32') {
    setupWindows();
  } else {
    section('Auto-start');
    info('Unknown platform. Start manually: npm start');
    info('Or use PM2: pm2 start dist/index.js --name claudeclaw && pm2 save');
  }

  // ── macOS permissions warning ──────────────────────────────────────────
  if (PLATFORM === 'darwin') {
    console.log();
    warn('macOS may show "Node wants to access..." permission dialogs on first run.');
    info('Keep an eye on your Mac screen and click Allow when prompted.');
    info('If the bot hangs with no response, check for pending permission dialogs.');
  }

  // ── 14. WhatsApp daemon reminder ─────────────────────────────────────────
  if (wantWhatsApp) {
    section('WhatsApp — next steps');
    info('To start the WhatsApp daemon:');
    console.log();
    console.log(`  ${c.cyan}npx tsx scripts/wa-daemon.ts${c.reset}`);
    console.log();
    info('A QR code will appear. Scan it from:');
    info('  WhatsApp → Settings → Linked Devices → Link a Device');
    console.log();
    info('The session saves to store/waweb/ and persists across restarts.');
    info('Then use /wa in Telegram to access your chats.');
    console.log();
    ok('Message bodies are encrypted at rest and auto-deleted after 3 days.');
    ok('The store/ directory is gitignored and will never be committed.');
  }

  // ── 15. Multi-agent setup (optional) ────────────────────────────────────
  section('Agent team (optional)');

  info('ClaudeClaw can run specialist agents alongside the main bot.');
  info('Each agent is its own Telegram bot with a focused role, its own');
  info('context window, and its own chat on your phone.');
  console.log();
  bullet('Each agent gets its own 1M context window (separate from main)');
  bullet('Agents default to Sonnet (cheaper) — use /model opus when needed');
  bullet('Each agent has its own CLAUDE.md personality and Obsidian folders');
  bullet('A shared hive mind lets agents see what others have done');
  bullet('All agents inherit every feature: voice, files, skills, scheduling');
  console.log();

  const wantAgents = await confirm('Set up specialist agents?', false);
  if (wantAgents) {
    console.log();
    info('Available templates:');
    console.log(`  1. ${c.bold}comms${c.reset}     — email, Slack, WhatsApp, YouTube comments, community forums, LinkedIn`);
    console.log(`  2. ${c.bold}content${c.reset}   — YouTube scripts, LinkedIn posts, trend research`);
    console.log(`  3. ${c.bold}ops${c.reset}       — calendar, billing, Stripe, Gumroad, admin`);
    console.log(`  4. ${c.bold}research${c.reset}  — deep web research, academic, competitive intel`);
    console.log();
    info('For each agent, you\'ll need to create a Telegram bot via @BotFather.');
    info('Open Telegram → @BotFather → /newbot → choose a name and username.');
    console.log();
    info('Run the agent creation wizard after setup finishes:');
    console.log();
    console.log(`  ${c.cyan}npm run agent:create${c.reset}`);
    console.log();
    info('It walks you through template selection, bot creation, and configuration.');
    info('Then start each agent in its own terminal:');
    console.log();
    console.log(`  ${c.cyan}npm start -- --agent comms${c.reset}      # Terminal 2`);
    console.log(`  ${c.cyan}npm start -- --agent content${c.reset}    # Terminal 3`);
    console.log(`  ${c.cyan}npm start -- --agent ops${c.reset}        # Terminal 4`);
    console.log();
    info('Or install as background services:');
    console.log(`  ${c.cyan}bash scripts/agent-service.sh install comms${c.reset}`);
    console.log();
    info('Full guide: see "Creating a team of agents" in the README.');
  }

  // ── 16. Summary ───────────────────────────────────────────────────────────
  console.log();
  console.log(`  ${c.cyan}╔════════════════════════════════════════════╗${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}${c.bold}           ClaudeClaw is ready!             ${c.reset}${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}╚════════════════════════════════════════════╝${c.reset}`);
  console.log();

  ok(`Bot: @${botUsername || '(configure TELEGRAM_BOT_TOKEN)'}`);
  env.ALLOWED_CHAT_ID ? ok(`Chat ID: ${env.ALLOWED_CHAT_ID}`) : warn('Chat ID: not set (bot will tell you on first message)');
  env.ANTHROPIC_API_KEY ? ok('Claude: API key (pay-per-token)') : ok('Claude: Max plan subscription');
  wantVoiceIn && env.GROQ_API_KEY ? ok('Voice input: Groq Whisper ✓') : wantVoiceIn ? warn('Voice input: GROQ_API_KEY not set') : info('Voice input: not enabled');
  wantVoiceOut && env.ELEVENLABS_API_KEY ? ok('Voice output: ElevenLabs ✓') : wantVoiceOut ? warn('Voice output: ElevenLabs keys not set') : info('Voice output: not enabled');
  wantVideo && env.GOOGLE_API_KEY ? ok('Video analysis: Gemini ✓') : wantVideo ? warn('Video analysis: GOOGLE_API_KEY not set') : info('Video analysis: not enabled');
  wantWhatsApp ? ok('WhatsApp: run npx tsx scripts/wa-daemon.ts to connect') : info('WhatsApp: not enabled');

  console.log();
  console.log(`  ${c.bold}Start the bot:${c.reset}`);
  console.log();
  console.log(`  ${c.cyan}npm start${c.reset}                    # production (compiled)`);
  console.log(`  ${c.cyan}npm run dev${c.reset}                  # development (tsx, no build needed)`);
  console.log();
  console.log(`  ${c.bold}Check health:${c.reset}`);
  console.log(`  ${c.cyan}npm run status${c.reset}`);
  console.log();
  if (PLATFORM === 'darwin') {
    info('Logs: tail -f /tmp/claudeclaw.log');
  } else if (PLATFORM === 'linux') {
    info('Logs: journalctl --user -u claudeclaw -f');
  }
  console.log();
  info('Edit CLAUDE.md any time to change personality, add context, or update skills.');
  info('Re-run npm run setup to change API keys or service settings.');
  console.log();
}

// ── Platform: macOS ──────────────────────────────────────────────────────────
async function setupMacOS() {
  section('Auto-start (macOS)');

  const dest = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.claudeclaw.app.plist');
  const installed = fs.existsSync(dest);

  if (installed) {
    ok('launchd service already installed');
    const reinstall = await confirm('Reinstall / update paths?', false);
    if (!reinstall) return;
  } else {
    const install = await confirm('Install as background service (starts automatically on login)?');
    if (!install) { info('Start manually: npm start'); return; }
  }

  const s = spinner('Installing launchd service...');
  try {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.claudeclaw.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${path.join(PROJECT_ROOT, 'dist', 'index.js')}</string>
  </array>
  <key>WorkingDirectory</key><string>${PROJECT_ROOT}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>/tmp/claudeclaw.log</string>
  <key>StandardErrorPath</key><string>/tmp/claudeclaw.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PATH</key><string>${process.env.PATH ?? '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'}</string>
    <key>HOME</key><string>${os.homedir()}</string>
  </dict>
</dict>
</plist>`;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, plist, 'utf-8');
    execSync(`launchctl load "${dest}"`, { stdio: 'pipe' });
    s.stop('ok', 'Service installed — starts automatically on login');
    info('Logs: tail -f /tmp/claudeclaw.log');
  } catch {
    s.stop('warn', 'Could not install automatically');
    info(`Manual install: launchctl load "${dest}"`);
  }
}

// ── Platform: Linux ──────────────────────────────────────────────────────────
async function setupLinux() {
  section('Auto-start (Linux)');

  const install = await confirm('Install as a systemd user service?');
  if (!install) {
    info('Start manually: npm start');
    info('Or: pm2 start dist/index.js --name claudeclaw && pm2 save');
    return;
  }

  const s = spinner('Installing systemd service...');
  try {
    const serviceDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    const servicePath = path.join(serviceDir, 'claudeclaw.service');
    const service = `[Unit]
Description=ClaudeClaw Telegram Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${process.execPath} ${path.join(PROJECT_ROOT, 'dist', 'index.js')}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=HOME=${os.homedir()}

[Install]
WantedBy=default.target
`;
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(servicePath, service, 'utf-8');
    execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    execSync('systemctl --user enable claudeclaw', { stdio: 'pipe' });
    execSync('systemctl --user start claudeclaw', { stdio: 'pipe' });
    s.stop('ok', `Service installed at ${servicePath}`);
    info('Logs: journalctl --user -u claudeclaw -f');
  } catch {
    s.stop('warn', 'Could not install automatically');
    info('See README.md for manual systemd setup instructions.');
  }
}

// ── Platform: Windows ────────────────────────────────────────────────────────
function setupWindows() {
  section('Auto-start (Windows)');

  warn('Windows detected.');
  console.log();
  info('Option A — WSL2 (recommended):');
  info('  Install WSL2, clone ClaudeClaw inside the WSL2 filesystem,');
  info('  and re-run setup. Keep ~/.claude/ inside WSL2, not the Windows mount.');
  console.log();
  info('Option B — PM2 (native Windows):');
  console.log(`  ${c.cyan}npm install -g pm2${c.reset}`);
  console.log(`  ${c.cyan}pm2 start dist/index.js --name claudeclaw${c.reset}`);
  console.log(`  ${c.cyan}pm2 save${c.reset}`);
  console.log(`  ${c.cyan}pm2 startup${c.reset}  ${c.gray}# follow the instructions it prints${c.reset}`);
}

main()
  .catch((err) => {
    console.error(`\n  ${c.red}Setup failed:${c.reset}`, err);
    process.exit(1);
  })
  .finally(() => rl.close());
