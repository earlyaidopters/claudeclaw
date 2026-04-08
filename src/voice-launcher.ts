import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';

import { AgentConfig } from './agent-config.js';
import {
  VOICE_API_PORT, VOICE_PORT, PROJECT_ROOT,
  VOICE_TUNNEL_HOSTNAME, VOICE_TWILIO_PHONE_SID,
} from './config.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';

let voiceProcess: ChildProcess | null = null;

/** Auto-create venv, install deps, then start Pipecat. */
function setupVenvThenStart(voiceDir: string, venvPython: string, env: Record<string, string>): void {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const venvDir = path.join(voiceDir, 'venv');

  const venv = spawn(python, ['-m', 'venv', venvDir], { stdio: 'pipe' });
  venv.on('error', (err) => logger.warn({ err }, 'Failed to create Python venv'));
  venv.on('exit', (code) => {
    if (code !== 0) {
      logger.warn(`Python venv creation failed (exit ${code}). Is python3 installed?`);
      return;
    }
    logger.info('Python venv created, installing dependencies...');

    const pip = process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');
    const install = spawn(pip, ['install', '-r', path.join(voiceDir, 'requirements.txt')], { stdio: 'pipe' });
    install.stderr?.on('data', (data: Buffer) => logger.info(`[pip] ${data.toString().trim()}`));
    install.on('error', (err) => logger.warn({ err }, 'pip install failed'));
    install.on('exit', (installCode) => {
      if (installCode !== 0) {
        logger.warn(`pip install failed (exit ${installCode})`);
        return;
      }
      logger.info('Voice agent dependencies installed');
      startPipecat(voiceDir, venvPython, env);
    });
  });
}

/**
 * Verify cloudflared tunnel is running and voice routes are configured.
 * Voice routes are added to the existing ~/.cloudflared/config.yml alongside
 * the dashboard tunnel -- one tunnel process handles everything.
 */
function verifyTunnel(): void {
  if (!VOICE_TUNNEL_HOSTNAME) {
    logger.warn('VOICE_TUNNEL_HOSTNAME not set -- voice calls will not work over the internet');
    return;
  }
  logger.info(`Voice tunnel hostname: ${VOICE_TUNNEL_HOSTNAME} (uses existing cloudflared tunnel)`);
}

/**
 * Configure Twilio phone number webhook to point to our /twiml endpoint.
 * Uses raw HTTPS to avoid adding a Twilio SDK dependency.
 */
function configureTwilioWebhook(accountSid: string, authToken: string): void {
  if (!VOICE_TWILIO_PHONE_SID || !VOICE_TUNNEL_HOSTNAME) return;

  const voiceUrl = `https://${VOICE_TUNNEL_HOSTNAME}/twiml`;
  const postData = `VoiceUrl=${encodeURIComponent(voiceUrl)}&VoiceMethod=GET`;

  const options: https.RequestOptions = {
    hostname: 'api.twilio.com',
    port: 443,
    path: `/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${VOICE_TWILIO_PHONE_SID}.json`,
    method: 'POST',
    auth: `${accountSid}:${authToken}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode === 200) {
      logger.info(`Twilio phone webhook configured: ${voiceUrl}`);
    } else {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        logger.warn({ status: res.statusCode, body }, 'Failed to configure Twilio webhook');
      });
    }
  });

  req.on('error', (err) => {
    logger.warn({ err }, 'Failed to reach Twilio API for webhook config');
  });

  req.write(postData);
  req.end();
}

export function launchVoiceAgent(agentId: string, config: AgentConfig): void {
  const va = config['voice-agent'];
  if (!va?.enabled) return;

  const envVars = readEnvFile([
    'ELEVENLABS_API_KEY', 'OLLAMA_MODEL', 'WHISPER_MODEL',
    'VOICE_CHAT_ID', 'VOICE_PORT',
    va.sip.password_env, va.twilio.account_sid_env, va.twilio.auth_token_env,
  ]);

  const resolveEnv = (envName: string): string =>
    process.env[envName] || envVars[envName] || '';

  const twilioSid = resolveEnv(va.twilio.account_sid_env);
  const twilioToken = resolveEnv(va.twilio.auth_token_env);

  // 1. Verify cloudflared tunnel (uses existing tunnel, not a separate process)
  verifyTunnel();

  // 2. Configure Twilio phone number webhook (fire and forget)
  if (twilioSid && twilioToken) {
    configureTwilioWebhook(twilioSid, twilioToken);
  }

  // 3. Start Python Pipecat process
  const voiceDir = path.join(PROJECT_ROOT, 'voice-agent');
  const venvPython = process.platform === 'win32'
    ? path.join(voiceDir, 'venv', 'Scripts', 'python.exe')
    : path.join(voiceDir, 'venv', 'bin', 'python');

  // Strip Claude Code session vars to prevent SDK conflicts in child processes
  const cleanEnv = { ...process.env } as Record<string, string>;
  delete cleanEnv.CLAUDECODE;
  delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

  const pipecatEnv: Record<string, string> = {
    ...cleanEnv,
    PYTHONDONTWRITEBYTECODE: '1',
    VOICE_API_PORT: String(VOICE_API_PORT),
    VOICE_AGENT_ID: agentId,
    VOICE_PHONE_NUMBER: va.phone_number,
    VOICE_ELEVENLABS_VOICE_ID: va.elevenlabs_voice_id,
    VOICE_ELEVENLABS_MODEL: va.elevenlabs_model || 'eleven_multilingual_v2',
    VOICE_PERSONALITY: va.personality || '',
    VOICE_SPEECH_TAGS: va.speech_tags || '',
    VOICE_SIP_TERMINATION_URL: va.sip.termination_url,
    VOICE_SIP_USERNAME: va.sip.username,
    VOICE_SIP_PASSWORD: resolveEnv(va.sip.password_env),
    TWILIO_ACCOUNT_SID: twilioSid,
    TWILIO_AUTH_TOKEN: twilioToken,
    ELEVENLABS_API_KEY: resolveEnv('ELEVENLABS_API_KEY'),
    VOICE_CHAT_ID: resolveEnv('VOICE_CHAT_ID'),
    VOICE_PORT: resolveEnv('VOICE_PORT') || '8765',
    OLLAMA_MODEL: resolveEnv('OLLAMA_MODEL') || 'qwen2.5:7b',
    WHISPER_MODEL: resolveEnv('WHISPER_MODEL') || 'base',
  };

  if (!fs.existsSync(venvPython)) {
    logger.info('Voice agent venv not found, setting up automatically...');
    setupVenvThenStart(voiceDir, venvPython, pipecatEnv);
    return;
  }

  startPipecat(voiceDir, venvPython, pipecatEnv);
}

function startPipecat(voiceDir: string, venvPython: string, env: Record<string, string>): void {
  voiceProcess = spawn(venvPython, ['main.py'], { cwd: voiceDir, env, stdio: 'pipe' });

  voiceProcess.on('error', (err) => {
    logger.warn({ err }, 'Voice agent process error');
    voiceProcess = null;
  });
  voiceProcess.stdout?.on('data', (data: Buffer) => logger.info(`[voice] ${data.toString().trim()}`));
  voiceProcess.stderr?.on('data', (data: Buffer) => logger.warn(`[voice] ${data.toString().trim()}`));
  voiceProcess.on('exit', (code) => {
    logger.info(`Voice agent exited with code ${code}`);
    voiceProcess = null;
  });
}

export function stopVoiceAgent(): void {
  if (voiceProcess) {
    voiceProcess.kill('SIGTERM');
    voiceProcess = null;
  }
}
