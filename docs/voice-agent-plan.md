# Voice Agent: Pipecat + Ollama + ElevenLabs + Twilio

## Context

Add phone call capabilities to ClaudeClaw agents. Each agent gets voice -- same memory system as Telegram, same personality derived from their CLAUDE.md, but adapted for phone conversation. No tool execution, no long responses. Just talk, absorb info, feed it into the shared memory DB.

Phone calling is configured per-agent in agent.yaml under the `voice-agent` key (not `voice` -- that's used for Telegram voice note transcription). When an agent has voice-agent config with SIP credentials, the voice agent starts automatically with `npm start`. No separate process or startup step.

**Stack:** Pipecat (Python) + Faster Whisper (local STT) + Ollama qwen2.5:7b (local LLM) + ElevenLabs (TTS) + Twilio WebSocket Media Streams (phone)

**Cost:** ~$1.15/month Twilio number + $0.0085/min inbound + ElevenLabs TTS usage. STT and LLM are free (local).

---

## Research Decisions

### Pipecat over LiveKit

Pipecat wins for single-user self-hosted:
- Built-in local Faster Whisper STT and Piper TTS (zero API cost options)
- Native Anthropic Claude + Ollama support
- Just one Python process, no separate media server
- Full pipeline control
- BSD-2-Clause license

LiveKit rejected: requires separate Go media server (overkill for one user), Claude plugin only in Python SDK not Node.js, no built-in local STT/TTS.

### Ollama Model: qwen2.5:7b

- ~40-60 tok/s on consumer GPU, sub-200ms time-to-first-token
- 72.5% accuracy on voice agent benchmarks -- most reliable in its class
- ~4.5GB VRAM, no prompting tricks needed

Alternatives: qwen3:4b with /no_think (faster, needs special prompting), qwen2.5:3b (if VRAM constrained). Skip Llama 3.2 3B (21.4% accuracy, bad at instructions).

Set `OLLAMA_KEEP_ALIVE=-1` to avoid cold start latency.

### Twilio: Direct WebSocket Media Streams

Not Daily.co SIP bridge. Twilio sends 8kHz mulaw audio over WebSocket. Pipecat has native TwilioFrameSerializer. Setup: TwiML Bin with `<Stream url="wss://...">`, phone number pointing to it. For local dev: ngrok exposes WebSocket port.

---

## Architecture

```
npm start (agent)
  --> Node.js bot starts (Telegram + dashboard)
  --> Reads agent.yaml voice-agent config
  --> If voice-agent.enabled: spawns Python voice-agent as child process
      --> Pipecat registers with Twilio via SIP
      --> Ready to receive calls on configured phone number

Phone call --> Twilio --> WebSocket --> Pipecat (Python process)
  --> Faster Whisper (local STT, 8kHz mulaw -> 16kHz PCM)
  --> MemoryLLMProcessor (custom):
        1. HTTP POST to internal voice-api /memory-context
        2. Build messages: [system_prompt, ...history, memory_context + utterance]
        3. Stream from Ollama qwen2.5:7b
  --> ElevenLabs TTS (API)
  --> Audio back through Twilio WebSocket --> phone

On call end:
  --> POST full transcript to voice-api /conversation-log
  --> Node.js triggers Gemini memory extraction (existing pipeline)
```

### Memory Interface

Separate internal API (`src/voice-api.ts`) on port 3142. Localhost-only, no auth. NOT the dashboard -- the dashboard is a frontend-facing server with browser auth, not appropriate for internal service communication. The voice API is a lightweight backend that reuses existing TypeScript memory functions directly.

The ~30ms localhost HTTP overhead is invisible against STT (300-800ms) and LLM (1-3s) latency.

---

## Implementation Steps

### Step 1: Per-Agent Voice Agent Configuration in agent.yaml

> **Why `voice-agent` and not `voice`?** The `voice.ts` module already handles voice note/message transcription from Telegram. Using `voice-agent` for the phone calling config avoids confusion between the two features.

**File: `src/agent-config.ts`** -- add voice-agent fields to AgentConfig interface:

```typescript
export interface AgentConfig {
  // ... existing fields ...
  'voice-agent'?: {
    enabled: boolean;
    phone_number: string;            // e.g. "+14155551234"
    elevenlabs_voice_id: string;     // ElevenLabs voice ID for this agent
    elevenlabs_model?: string;       // ElevenLabs model, e.g. "eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_v3"
    personality?: string;            // Additional voice-agent-specific instructions
    speech_tags?: string;            // ElevenLabs v3 speech tags applied to all TTS output (see below)

    // SIP trunking credentials (Twilio or any SIP provider)
    sip: {
      termination_url: string;       // e.g. "sip:username@xxxxx.pstn.twilio.com"
      username: string;              // SIP auth username
      password_env: string;          // Env var name containing SIP password (not plaintext)
    };

    // Twilio config for WebSocket Media Streams
    twilio: {
      account_sid_env: string;       // Env var name, e.g. "TWILIO_ACCOUNT_SID"
      auth_token_env: string;        // Env var name, e.g. "TWILIO_AUTH_TOKEN"
    };
  };
}
```

**`elevenlabs_model`:** Controls which ElevenLabs model generates speech. Defaults to `eleven_multilingual_v2` if omitted. Use `eleven_v3` to unlock speech tags (see below).

**`speech_tags`:** ElevenLabs v3 supports inline speech tags for fine-grained control over delivery -- pauses, emphasis, pacing, emotion. When `speech_tags` is set in the yaml, the voice agent wraps every TTS output with these tags. This only works with `eleven_v3` as the model.

Example tags:
- `<break time="0.5s" />` -- insert a pause
- `<emphasis level="strong">word</emphasis>` -- stress a word
- `<prosody rate="slow">phrase</prosody>` -- control pacing
- Wrap in a top-level tag to set defaults for the whole utterance

The `speech_tags` value is a template string. The voice agent inserts the LLM output where `{text}` appears. If no `{text}` placeholder is present, the tags are prepended to the output.

**Example agent.yaml:**
```yaml
name: ClaudeClaw
description: Ben's primary AI assistant
telegram_bot_token_env: TELEGRAM_BOT_TOKEN
model: claude-sonnet-4-6

voice-agent:
  enabled: true
  phone_number: "+14155551234"
  elevenlabs_voice_id: "IZ5djXyCDpI3pyJpwdkk"
  elevenlabs_model: "eleven_v3"
  personality: |
    On phone calls, match Ben's energy level.
    If he sounds rushed, keep it extra brief.
  speech_tags: |
    <prosody rate="medium">{text}</prosody>

  sip:
    termination_url: "sip:trunk@pstn.twilio.com"
    username: "claudeclaw-sip"
    password_env: "SIP_PASSWORD"

  twilio:
    account_sid_env: "TWILIO_ACCOUNT_SID"
    auth_token_env: "TWILIO_AUTH_TOKEN"
```

Passwords/tokens are NEVER stored in yaml -- only env var names that point to values in `.env`. Same pattern as `telegram_bot_token_env`.

**File: `agents/_template/agent.yaml.example`** -- add commented voice-agent section:
```yaml
# Voice agent / phone call capabilities (optional -- uncomment to enable)
# Note: "voice-agent" not "voice" -- voice.ts handles Telegram voice note transcription
# voice-agent:
#   enabled: true
#   phone_number: "+1XXXXXXXXXX"
#   elevenlabs_voice_id: "your-voice-id"
#   elevenlabs_model: "eleven_multilingual_v2"  # or "eleven_v3" for speech tags
#   personality: |
#     Voice-agent-specific personality adjustments here.
#   speech_tags: |                               # Only works with eleven_v3
#     <prosody rate="medium">{text}</prosody>
#   sip:
#     termination_url: "sip:user@provider.com"
#     username: "sip-username"
#     password_env: "SIP_PASSWORD"
#   twilio:
#     account_sid_env: "TWILIO_ACCOUNT_SID"
#     auth_token_env: "TWILIO_AUTH_TOKEN"
```

**Main agent env var fallback:** The main agent doesn't use an `agent.yaml` file the same way sub-agents do -- its config lives primarily in `.env`. For the main agent, `loadAgentConfig()` should build the `voice-agent` config from `VOICE_AGENT_*` env vars when no yaml voice-agent section exists:

| Env var | Maps to |
|---------|---------|
| `VOICE_AGENT_ENABLED` | `voice-agent.enabled` |
| `VOICE_AGENT_PHONE_NUMBER` | `voice-agent.phone_number` |
| `VOICE_AGENT_ELEVENLABS_VOICE_ID` | `voice-agent.elevenlabs_voice_id` |
| `VOICE_AGENT_ELEVENLABS_MODEL` | `voice-agent.elevenlabs_model` |
| `VOICE_AGENT_PERSONALITY` | `voice-agent.personality` |
| `VOICE_AGENT_SPEECH_TAGS` | `voice-agent.speech_tags` |
| `SIP_PASSWORD` | `voice-agent.sip.password_env` (direct, not indirect) |
| `TWILIO_ACCOUNT_SID` | `voice-agent.twilio.account_sid_env` (direct) |
| `TWILIO_AUTH_TOKEN` | `voice-agent.twilio.auth_token_env` (direct) |

This keeps the main agent's setup identical to other agents from the launcher's perspective -- `launchVoiceAgent()` doesn't need to know where the config came from.

---

### Step 2: Internal Voice API Server

**New file: `src/voice-api.ts`** -- separate Hono server, localhost-only, no auth.

```typescript
// src/voice-api.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { buildMemoryContext, saveConversationTurn, evaluateMemoryRelevance } from './memory.js';
import { loadAgentConfig, resolveAgentClaudeMd } from './agent-config.js';
import { VOICE_API_PORT } from './config.js';
import { logger } from './logger.js';
import fs from 'fs';

export function startVoiceApi(): void {
  const app = new Hono();

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
    const summaryMap = new Map(Object.entries(memorySummaries).map(([k, v]) => [Number(k), v as string]));
    void evaluateMemoryRelevance(surfacedMemoryIds, summaryMap, userMessage, assistantResponse);
    return c.json({ ok: true });
  });

  app.get('/agent-config/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const config = loadAgentConfig(agentId);
    const claudeMd = fs.readFileSync(resolveAgentClaudeMd(agentId), 'utf-8');
    return c.json({ 'voice-agent': config['voice-agent'], claudeMd, name: config.name });
  });

  serve({ fetch: app.fetch, port: VOICE_API_PORT, hostname: '127.0.0.1' }, () => {
    logger.info(`Voice API listening on 127.0.0.1:${VOICE_API_PORT}`);
  });
}
```

**File: `src/config.ts`** -- add:
```typescript
export const VOICE_API_PORT = parseInt(process.env.VOICE_API_PORT || '3142', 10);
```

---

### Step 3: Auto-Start Voice Agent from Node.js

**New file: `src/voice-launcher.ts`** -- spawns Python voice agent as child process.

```typescript
// src/voice-launcher.ts
import { spawn, ChildProcess } from 'child_process';
import { AgentConfig } from './agent-config.js';
import { VOICE_API_PORT, PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';

let voiceProcess: ChildProcess | null = null;

export function launchVoiceAgent(agentId: string, config: AgentConfig): void {
  const va = config['voice-agent'];
  if (!va?.enabled) return;

  const env = {
    ...process.env,
    VOICE_API_PORT: String(VOICE_API_PORT),
    VOICE_AGENT_ID: agentId,
    VOICE_PHONE_NUMBER: va.phone_number,
    VOICE_ELEVENLABS_VOICE_ID: va.elevenlabs_voice_id,
    VOICE_ELEVENLABS_MODEL: va.elevenlabs_model || 'eleven_multilingual_v2',
    VOICE_PERSONALITY: va.personality || '',
    VOICE_SPEECH_TAGS: va.speech_tags || '',
    VOICE_SIP_TERMINATION_URL: va.sip.termination_url,
    VOICE_SIP_USERNAME: va.sip.username,
    VOICE_SIP_PASSWORD: process.env[va.sip.password_env] || '',
    TWILIO_ACCOUNT_SID: process.env[va.twilio.account_sid_env] || '',
    TWILIO_AUTH_TOKEN: process.env[va.twilio.auth_token_env] || '',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    VOICE_CHAT_ID: process.env.VOICE_CHAT_ID || '',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    WHISPER_MODEL: process.env.WHISPER_MODEL || 'base',
  };

  const voiceDir = `${PROJECT_ROOT}/voice-agent`;
  voiceProcess = spawn('python', ['main.py'], { cwd: voiceDir, env, stdio: 'pipe' });

  voiceProcess.stdout?.on('data', (data) => logger.info(`[voice] ${data.toString().trim()}`));
  voiceProcess.stderr?.on('data', (data) => logger.warn(`[voice] ${data.toString().trim()}`));
  voiceProcess.on('exit', (code) => {
    logger.info(`Voice agent exited with code ${code}`);
    voiceProcess = null;
  });

  logger.info(`Voice agent started for ${agentId} on ${va.phone_number}`);
}

export function stopVoiceAgent(): void {
  if (voiceProcess) {
    voiceProcess.kill('SIGTERM');
    voiceProcess = null;
  }
}
```

**File: `src/index.ts`** -- after bot starts:
```typescript
import { startVoiceApi } from './voice-api.js';
import { launchVoiceAgent } from './voice-launcher.js';

// During startup, after bot is created:
startVoiceApi();

const agentConfig = loadAgentConfig(AGENT_ID);
if (agentConfig['voice-agent']?.enabled) {
  launchVoiceAgent(AGENT_ID, agentConfig);
}
```

---

### Step 4: Python Voice Agent

**Directory: `voice-agent/`** inside project root

**File structure:**
```
voice-agent/
  main.py                 # Entry point, Pipecat pipeline
  config.py               # Reads env vars passed by Node.js launcher
  prompt_builder.py       # Builds system prompt from CLAUDE.md + voice rules
  memory_client.py        # HTTP client for internal voice-api
  requirements.txt
```

**requirements.txt:**
```
pipecat-ai[silero]>=0.0.52
faster-whisper>=1.0.0
elevenlabs>=1.0.0
ollama>=0.3.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
```

**config.py** -- all config from env vars (set by Node.js launcher):
- `VOICE_API_PORT` -- internal API port (3142)
- `VOICE_AGENT_ID` -- which agent this is
- `VOICE_CHAT_ID` -- Ben's chatId
- `VOICE_PHONE_NUMBER`, `VOICE_ELEVENLABS_VOICE_ID`
- `VOICE_ELEVENLABS_MODEL` -- ElevenLabs model (default: `eleven_multilingual_v2`)
- `VOICE_SPEECH_TAGS` -- ElevenLabs v3 speech tag template (optional, only with `eleven_v3`)
- `VOICE_SIP_*` -- SIP credentials
- `TWILIO_*` -- Twilio credentials
- `ELEVENLABS_API_KEY`, `OLLAMA_MODEL`, `WHISPER_MODEL`
- `VOICE_PORT` -- WebSocket port, default 8765

**prompt_builder.py** -- builds system prompt from three sources:

1. **Agent personality from CLAUDE.md** (~80%) -- extracted personality, identity, rules, knowledge. Strips tool docs, scheduling, formatting sections.
2. **Agent voice-agent personality from agent.yaml** -- the `voice-agent.personality` field
3. **Shared call rules** (hardcoded, all agents):

These rules mirror the personality rules proven in the main agent's CLAUDE.md (sarcasm, brutal honesty, no AI cliches, energy matching, conversational tone) and add phone-specific constraints for brevity and spoken delivery.

```
CALL RULES -- PERSONALITY:
- You are sarcastic, opinionated, and brutally honest. Never sugarcoat.
- Have strong takes and share them. Don't hedge with "it depends" unless it genuinely does.
- No AI cliches. Never say "certainly", "great question", "I'd be happy to", "as an AI", or any variation.
- No sycophancy. Don't validate, flatter, or soften things unnecessarily.
- No apologising excessively. If you got something wrong, correct yourself and move on.
- Don't narrate what you're about to do. Just answer.
- If you don't know something, say so plainly.
- The sarcasm is affectionate -- you're poking fun because you're comfortable, not dismissive.
- Push back when there's a real reason to -- a missed detail, a genuine risk, something the caller likely didn't account for.
- Be brutally honest. If someone is wasting time on something unproductive, say it.
- Match the caller's energy. If they're casual, be casual. If they're focused, be focused.
- Never be cheery, never celebrate, never hype. No "nice job", no "you've got this". Dry acknowledgment at most.
- Never be sensational. Don't oversell, don't dramatize. State things plainly.

CALL RULES -- DELIVERY:
- 1-2 sentences max. Shorter than text. Phone time is expensive -- get to the point.
- Only go longer if explicitly asked to elaborate or if the answer genuinely requires it.
- No markdown, no bullet points, no formatting -- this is speech.
- No em dashes. Use natural pauses instead.
- Speak in flowing sentences, never lists.
- Numbers: say naturally ("about fifteen hundred" not "1,500").
- Use memory context naturally, don't announce "I remember that..."

CALL RULES -- BOUNDARIES:
- You CANNOT execute tools, code, emails, or actions on a call.
- If asked to DO something (send an email, create a task, run code), say you'll handle it on Telegram after the call.
- Keep casual chat casual. If the caller just wants to talk, talk. Don't pivot to work mode unless they clearly ask.
```

**memory_client.py** -- async HTTP client (aiohttp) for internal voice-api:
- `get_memory_context(message, agent_id) -> dict`
- `log_conversation(user_msg, assistant_msg, agent_id) -> None`
- `evaluate_relevance(ids, summaries, user_msg, assistant_msg) -> None`
- `get_agent_config(agent_id) -> dict`

All calls to `http://127.0.0.1:{VOICE_API_PORT}`.

**main.py** -- the Pipecat pipeline:

```python
async def main():
    # 1. Fetch agent config + build system prompt
    agent_config = await memory_client.get_agent_config(AGENT_ID)
    system_prompt = build_voice_prompt(
        agent_config['claudeMd'],
        agent_config.get('voice-agent', {}).get('personality')
    )

    # 2. Set up Pipecat pipeline
    transport = TwilioWebSocketTransport(
        port=VOICE_PORT,
        params=TwilioParams(
            account_sid=TWILIO_ACCOUNT_SID,
            auth_token=TWILIO_AUTH_TOKEN,
        )
    )
    stt = FasterWhisperSTTService(model_size=WHISPER_MODEL)
    llm = OllamaLLMService(model=OLLAMA_MODEL)
    tts = ElevenLabsTTSService(
        api_key=ELEVENLABS_API_KEY,
        voice_id=VOICE_ELEVENLABS_VOICE_ID,
        model=VOICE_ELEVENLABS_MODEL,          # e.g. "eleven_v3", "eleven_multilingual_v2"
    )

    # If speech_tags configured (eleven_v3 only), wrap TTS output
    # Template uses {text} placeholder: "<prosody rate='medium'>{text}</prosody>"
    # Applied in the TTS pre-processor before sending text to ElevenLabs

    # 3. Conversation state
    messages = [{"role": "system", "content": system_prompt}]
    transcript = []

    # On each utterance: fetch memory -> prepend -> Ollama -> stream
    # On disconnect: log transcript -> trigger Gemini extraction
    # Cap history at ~20 turns

    pipeline = Pipeline([
        transport.input(), stt, memory_llm_processor, tts, transport.output()
    ])
    await pipeline.run()
```

**In-call context:** Maintain Python list of message dicts. Cap at ~20 turns for qwen2.5:7b (32k context, quality degrades with too much). Memory context prepended to each user message, not system prompt.

**Post-call:** Aggregate all turns into one log entry: `[Phone call transcript]`. POST to `/conversation-log` which triggers Gemini extraction via existing `ingestConversationTurn()`.

---

### Step 5: Twilio SIP Setup

Configured once per agent. Values go in agent.yaml `voice-agent` section + .env.

**Twilio Console steps (one-time):**
1. Buy a phone number (~$1.15/month)
2. Create a TwiML Bin:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://YOUR_PUBLIC_URL/ws" />
  </Connect>
</Response>
```
3. Point phone number "A call comes in" to the TwiML Bin
4. Get SIP credentials from Twilio Console > Voice > SIP > Credentials
5. Put all values in agent.yaml + .env

**Local dev:** `ngrok http 8765`, update TwiML Bin with ngrok WSS URL
**Production:** Stable public URL (reverse proxy, Cloudflare tunnel)

---

### Step 6: Outbound Call Script (Pipecat + Twilio)

Like `scripts/notify.sh` sends a Telegram message, `scripts/outbound-call.sh` triggers an outbound phone call. It uses the Twilio REST API to initiate the call, which connects to the already-running Pipecat WebSocket server -- same pipeline as inbound calls (Faster Whisper STT, Ollama LLM, ElevenLabs TTS).

**How it works:**
1. Script calls Twilio REST API to create an outbound call
2. Twilio dials the target number from your Twilio number
3. When answered, Twilio's TwiML connects audio to the Pipecat WebSocket via `<Connect><Stream>`
4. Pipecat handles the conversation identically to an inbound call
5. Post-call transcript logging and memory extraction happen the same way

**Prerequisite:** The Pipecat voice agent must already be running (started by `npm start`). The outbound call just tells Twilio to connect a new call to the existing WebSocket endpoint.

**New file: `scripts/outbound-call.sh`**

```bash
#!/bin/bash
# Trigger an outbound phone call via Twilio, routed to the Pipecat voice agent.
# Usage: outbound-call.sh <to_number>
# Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VOICE_AGENT_PHONE_NUMBER,
# and VOICE_AGENT_WS_URL from .env in the project root.
#
# Examples:
#   outbound-call.sh "+12137774445"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "outbound-call.sh: .env not found at $ENV_FILE" >&2
  exit 1
fi

ACCOUNT_SID=$(grep -E '^TWILIO_ACCOUNT_SID=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
AUTH_TOKEN=$(grep -E '^TWILIO_AUTH_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
FROM_NUMBER=$(grep -E '^VOICE_AGENT_PHONE_NUMBER=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
WS_URL=$(grep -E '^VOICE_AGENT_WS_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$ACCOUNT_SID" ] || [ -z "$AUTH_TOKEN" ]; then
  echo "outbound-call.sh: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set in .env" >&2
  exit 1
fi

if [ -z "$FROM_NUMBER" ]; then
  echo "outbound-call.sh: VOICE_AGENT_PHONE_NUMBER not set in .env" >&2
  exit 1
fi

if [ -z "$WS_URL" ]; then
  echo "outbound-call.sh: VOICE_AGENT_WS_URL not set in .env (e.g. wss://your-domain/ws)" >&2
  exit 1
fi

TO_NUMBER="$1"
if [ -z "$TO_NUMBER" ]; then
  echo "outbound-call.sh: usage: outbound-call.sh <to_number>" >&2
  exit 1
fi

# TwiML that connects the answered call to the Pipecat WebSocket
TWIML="<Response><Connect><Stream url=\"${WS_URL}\" /></Connect></Response>"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json" \
  -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
  --data-urlencode "To=${TO_NUMBER}" \
  --data-urlencode "From=${FROM_NUMBER}" \
  --data-urlencode "Twiml=${TWIML}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  CALL_SID=$(echo "$BODY" | grep -o '"sid": *"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Call initiated: $CALL_SID"
else
  echo "outbound-call.sh: Twilio API error ($HTTP_CODE): $BODY" >&2
  exit 1
fi
```

**Twilio REST API response (201 Created):**
- `sid` -- unique call SID
- `status` -- queued, ringing, in-progress, completed, etc.
- `from`, `to` -- call participants
- `date_created` -- timestamp

**Note on `VOICE_AGENT_WS_URL`:** This is the public WebSocket URL where Pipecat listens. For local dev, this is the ngrok URL (e.g. `wss://abc123.ngrok.io/ws`). For production, it's whatever stable public URL you have (reverse proxy, Cloudflare tunnel). Same URL used in the TwiML Bin for inbound calls.

---

### Step 7: .env Updates

```
# Voice agent (Pipecat -- inbound + outbound calls)
VOICE_API_PORT=3142
VOICE_CHAT_ID=<ben's telegram chat id>
VOICE_PORT=8765
VOICE_AGENT_WS_URL=<public wss:// URL for Pipecat, e.g. wss://your-domain/ws>
OLLAMA_MODEL=qwen2.5:7b
WHISPER_MODEL=base
ELEVENLABS_API_KEY=<from elevenlabs>

# SIP credentials (referenced by agent.yaml password_env)
SIP_PASSWORD=<from twilio sip credentials>

# Twilio (used for both inbound TwiML and outbound call API)
TWILIO_ACCOUNT_SID=<from twilio>
TWILIO_AUTH_TOKEN=<from twilio>

# Main agent voice-agent config (mirrors agent.yaml for main agent)
VOICE_AGENT_ENABLED=true
VOICE_AGENT_PHONE_NUMBER=<twilio phone number in E.164>
VOICE_AGENT_ELEVENLABS_VOICE_ID=<elevenlabs voice id>
VOICE_AGENT_ELEVENLABS_MODEL=eleven_multilingual_v2
VOICE_AGENT_PERSONALITY=<optional personality overrides>
VOICE_AGENT_SPEECH_TAGS=<optional speech tags template>
```

---

## Memory System Reference

The voice agent interfaces with ClaudeClaw's 3-layer memory system:

**Layer 1: Session Resumption** -- NOT used for voice. Ollama has no session resumption. In-call context maintained as a Python list of message dicts.

**Layer 2: Structured Memory Extraction** -- Used post-call. After hang-up, the full transcript is POSTed to the voice-api, which calls `saveConversationTurn()`. This triggers `ingestConversationTurn()` which sends the transcript to Gemini Flash for structured extraction (summary, entities, topics, importance score). Only memories scoring >= 0.5 importance are saved.

**Layer 3: 5-Layer Context Injection** -- Used per-utterance. Before each Ollama call, the voice agent POSTs to `/memory-context` which calls `buildMemoryContext()`:
1. Semantic vector search (cosine similarity > 0.3 via Gemini embeddings)
2. FTS5 keyword search (fallback)
3. High-importance recent memories (importance >= 0.5)
4. Consolidation insights (cross-memory patterns)
5. Cross-agent activity (what other agents did in last 24h)

Returns formatted `[Memory context]` block prepended to user message.

After Ollama responds, `evaluateMemoryRelevance()` fires async to boost/penalize surfaced memories based on whether they were actually useful.

**Key functions reused (all in src/memory.ts):**
- `buildMemoryContext(chatId, userMessage, agentId)` -- 5-layer search, returns formatted context
- `saveConversationTurn(chatId, userMessage, claudeResponse, sessionId?, agentId)` -- logs + fires extraction
- `evaluateMemoryRelevance(surfacedIds, summaryMap, userMessage, assistantResponse)` -- feedback loop

---

## Files to Create/Modify

**New files:**
- `src/voice-api.ts` -- internal API server (~50 lines)
- `src/voice-launcher.ts` -- spawns Python process (~40 lines)
- `voice-agent/main.py` -- Pipecat pipeline
- `voice-agent/config.py` -- env config
- `voice-agent/prompt_builder.py` -- system prompt construction
- `voice-agent/memory_client.py` -- HTTP client
- `voice-agent/requirements.txt` -- Python deps
- `scripts/voice-setup.sh` -- one-time Python venv + deps setup
- `scripts/outbound-call.sh` -- trigger outbound calls via Twilio REST API, routed to Pipecat

**Modified files:**
- `src/agent-config.ts` -- add voice-agent fields to AgentConfig (including elevenlabs_model, speech_tags); for the main agent, fall back to `VOICE_AGENT_*` env vars when no agent.yaml voice-agent section exists
- `src/config.ts` -- add VOICE_API_PORT
- `src/index.ts` -- call startVoiceApi() + launchVoiceAgent()
- `agents/_template/agent.yaml.example` -- add voice-agent section
- `package.json` -- add "voice:setup" npm script
- `.env.example` -- add voice agent env vars

---

## Potential Issues

1. **Faster Whisper on Windows**: CUDA can be tricky. Fallback: CPU mode or WSL2. Base model on CPU: ~700-1200ms.
2. **Ollama cold start**: Set `OLLAMA_KEEP_ALIVE=-1` to keep model in VRAM.
3. **Twilio 8kHz audio**: Phone-grade quality. Use Whisper `small` model if GPU available.
4. **ElevenLabs latency**: ~200-400ms for TTS. Pipecat streams chunks as they arrive.
5. **Python venv**: Node.js launcher needs Python + venv set up. `scripts/voice-setup.sh` handles one-time setup.

---

## Verification

1. Build: `npm run build`
2. Configure: add `voice-agent` section to agent.yaml, set .env vars
3. Start: `npm start` -- should see "Voice API listening on 127.0.0.1:3142" and "Voice agent started for main on +1..."
4. Test API: `curl -X POST http://127.0.0.1:3142/memory-context -H "Content-Type: application/json" -d '{"chatId":"CHAT_ID","message":"test"}'`
5. Call the phone number
6. Have a conversation -- verify short, conversational responses
7. Hang up -- check conversation_log for transcript
8. Wait ~30s -- verify Gemini memory extraction
9. Message on Telegram referencing the call -- verify memory picks it up
