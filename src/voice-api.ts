import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import fs from 'fs';

import { runAgent } from './agent.js';
import { loadAgentConfig, resolveAgentClaudeMd } from './agent-config.js';
import {
  VOICE_API_PORT, VOICE_TUNNEL_HOSTNAME, ALLOWED_CHAT_ID, AGENT_ID,
  agentElevenlabsModelId, agentElevenlabsSpeechTags,
  ELEVENLABS_MODEL_ID, ELEVENLABS_SPEECH_TAGS,
} from './config.js';
import { getSession, setSession } from './db.js';
import { buildMemoryContext, saveConversationTurn, evaluateMemoryRelevance } from './memory.js';
import { logger } from './logger.js';

function buildVoiceCallInstruction(): string {
  const effectiveModel = agentElevenlabsModelId ?? ELEVENLABS_MODEL_ID ?? '';
  const effectiveTags = agentElevenlabsSpeechTags ?? ELEVENLABS_SPEECH_TAGS ?? [];
  const isV3 = effectiveModel.startsWith('eleven_v3');

  const lines = [
    '[Voice call mode active]',
    'You are on a phone call. Apply these rules for this response only:',
    '',
    'VOICE RULES (same as voice mode):',
    '- 2-3 sentences max. Distill to the key point.',
    '- No markdown, no bullet points, no headers, no code blocks -- plain spoken text only.',
    '- Scatter filler words: "uh", "um", "like", "kinda", "you know", "basically", "I mean"',
    '- Use casual contractions: "gonna", "wanna", "gotta", "cuz", "y\'know"',
    '- Self-interrupt naturally: "I, I think", "it\'s, it\'s not"',
    '- Start casually: "Yeah so uh", "I mean look", "Okay so basically"',
    '- Trail off: "so yeah", "anyway", "you know"',
    '- Never use rhetorical contrasts, parallel constructions, or pressuring follow-up questions',
    '',
    'PHONE CALL EXTRA RULES:',
    '- 1-2 sentences is ideal. This is a phone call, not a text chat.',
    '- If executing a tool or command, say "hold on a sec" and do it.',
    '- Be intimate and conversational -- you\'re talking to someone you know well.',
    '- If there\'s nothing to say, say nothing -- don\'t fill silence with questions.',
  ];

  if (isV3 && effectiveTags.length > 0) {
    lines.push('');
    lines.push(`SPEECH TAGS (include 1-2 where they fit naturally, inline in brackets):`);
    lines.push(`Allowed tags: ${effectiveTags.join(', ')}`);
    lines.push('Example: "I mean [sighs] that\'s basically it [chuckles] anyway"');
  }

  lines.push('[End voice call mode]');
  return lines.join('\n');
}

export function startVoiceApi(): void {
  const app = new Hono();

  // TwiML endpoint -- Twilio hits this when a call comes in, we tell it to stream to our WebSocket
  app.get('/twiml', (c) => {
    if (!VOICE_TUNNEL_HOSTNAME) {
      return c.text('VOICE_TUNNEL_HOSTNAME not configured', 500);
    }
    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Connect>',
      `    <Stream url="wss://${VOICE_TUNNEL_HOSTNAME}/ws" />`,
      '  </Connect>',
      '</Response>',
    ].join('\n');
    return c.body(twiml, 200, { 'Content-Type': 'text/xml' });
  });

  app.post('/memory-context', async (c) => {
    const { chatId, message, agentId } = await c.req.json();
    const result = await buildMemoryContext(chatId, message, agentId || 'voice');
    return c.json({
      contextText: result.contextText,
      surfacedMemoryIds: result.surfacedMemoryIds,
      surfacedMemorySummaries: Object.fromEntries(result.surfacedMemorySummaries),
    });
  });

  app.post('/conversation-log', async (c) => {
    const { chatId, userMessage, assistantResponse, agentId } = await c.req.json();
    saveConversationTurn(chatId, userMessage, assistantResponse, undefined, agentId || 'voice');
    return c.json({ ok: true });
  });

  app.post('/evaluate-relevance', async (c) => {
    const { surfacedMemoryIds, memorySummaries, userMessage, assistantResponse } = await c.req.json();
    const summaryMap = new Map(
      Object.entries(memorySummaries as Record<string, string>).map(([k, v]) => [Number(k), v]),
    );
    void evaluateMemoryRelevance(surfacedMemoryIds, summaryMap, userMessage, assistantResponse);
    return c.json({ ok: true });
  });

  app.get('/agent-config/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const config = loadAgentConfig(agentId);
    const claudeMdPath = resolveAgentClaudeMd(agentId);
    const claudeMd = claudeMdPath ? fs.readFileSync(claudeMdPath, 'utf-8') : '';
    return c.json({ 'voice-agent': config['voice-agent'], claudeMd, name: config.name });
  });

  app.post('/chat', async (c) => {
    const { message, agentId: bodyAgentId } = await c.req.json();
    if (!message) return c.json({ error: 'message required' }, 400);

    const effectiveAgentId = bodyAgentId ?? AGENT_ID;
    const voiceInstruction = buildVoiceCallInstruction();
    const fullMessage = `${voiceInstruction}\n\n[Voice transcribed]: ${message}`;

    const sessionId = getSession(ALLOWED_CHAT_ID, effectiveAgentId);
    logger.info(`[voice-chat] agent=${effectiveAgentId} session=${sessionId ? 'resumed' : 'new'} msg=${message.substring(0, 60)}`);

    let result;
    try {
      result = await runAgent(
        fullMessage,
        sessionId,
        () => {},
        undefined,
        'haiku',
      );
    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack?.split('\n').slice(0, 3).join('\n') }, '[voice-chat] runAgent failed');
      return c.json({ text: 'Give me a second, something went wrong.' });
    }

    if (result.newSessionId) {
      setSession(ALLOWED_CHAT_ID, result.newSessionId, effectiveAgentId);
    }

    return c.json({ text: result.text ?? '' });
  });

  serve({ fetch: app.fetch, port: VOICE_API_PORT, hostname: '127.0.0.1' }, () => {
    logger.info(`Voice API listening on 127.0.0.1:${VOICE_API_PORT}`);
  });
}
