/**
 * Generate pop-art style profile images for agent bots using Gemini image generation.
 * Usage: npx tsx scripts/gen-agent-avatars.ts
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { readEnvFile } from '../src/env.js';

const env = readEnvFile(['GOOGLE_API_KEY']);
const apiKey = env.GOOGLE_API_KEY;
if (!apiKey) { console.error('GOOGLE_API_KEY not set in .env'); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const assetsDir = path.join(import.meta.dirname, '..', 'assets');

interface AgentAvatar {
  id: string;
  prompt: string;
  outFile: string;
}

const agents: AgentAvatar[] = [
  {
    id: 'ops',
    outFile: path.join(assetsDir, 'agent-ops.png'),
    prompt: `Create a bold pop-art comic book style square profile picture avatar for an AI agent called "OPS".
Style: Retro 1960s Roy Lichtenstein pop art with ben-day dots, thick black outlines, vivid flat colors.
Character: A sharp, confident professional man in a suit with slicked-back hair, holding a clipboard. He looks decisive and organized.
Background: Bright teal/green with geometric shapes.
Text: The word "OPS" in massive bold block letters across the top, white with black outline.
Bottom label: Small white text "Operations" on a dark banner at the bottom.
Square format, vibrant saturated colors, comic book halftone dots visible. No speech bubbles.`,
  },
  {
    id: 'research',
    outFile: path.join(assetsDir, 'agent-research.png'),
    prompt: `Create a bold pop-art comic book style square profile picture avatar for an AI agent called "RESEARCH".
Style: Retro 1960s Roy Lichtenstein pop art with ben-day dots, thick black outlines, vivid flat colors.
Character: A studious woman with stylish glasses, short dark hair, wearing a turtleneck. She has an intense analytical gaze, holding a magnifying glass.
Background: Rich purple/violet with geometric shapes.
Text: The word "RESEARCH" in massive bold block letters across the top, white with black outline.
Bottom label: Small white text "Deep Research" on a dark banner at the bottom.
Square format, vibrant saturated colors, comic book halftone dots visible. No speech bubbles.`,
  },
  {
    id: 'comms',
    outFile: path.join(assetsDir, 'agent-comms.png'),
    prompt: `Create a bold pop-art comic book style square profile picture avatar for an AI agent called "COMMS".
Style: Retro 1960s Roy Lichtenstein pop art with ben-day dots, thick black outlines, vivid flat colors.
Character: A charismatic woman with wavy dark hair, red lipstick, wearing a headset/earpiece. She has a warm but focused expression, like she's mid-conversation managing multiple channels.
Background: Bright sky blue with geometric shapes and signal/wave patterns.
Text: The word "COMMS" in massive bold block letters across the top, white with black outline.
Bottom label: Small white text "Communications" on a dark banner at the bottom.
Square format, vibrant saturated colors, comic book halftone dots visible. No speech bubbles.`,
  },
  {
    id: 'content',
    outFile: path.join(assetsDir, 'agent-content.png'),
    prompt: `Create a bold pop-art comic book style square profile picture avatar for an AI agent called "CONTENT".
Style: Retro 1960s Roy Lichtenstein pop art with ben-day dots, thick black outlines, vivid flat colors.
Character: A creative young man with tousled hair, wearing a casual blazer over a t-shirt, holding a pen/stylus like he's about to create something. He has an inspired, energetic expression.
Background: Bright orange/amber with geometric shapes and film strip/play button motifs.
Text: The word "CONTENT" in massive bold block letters across the top, white with black outline.
Bottom label: Small white text "Content Creator" on a dark banner at the bottom.
Square format, vibrant saturated colors, comic book halftone dots visible. No speech bubbles.`,
  },
];

async function generateAvatar(agent: AgentAvatar): Promise<void> {
  console.log(`Generating ${agent.id} avatar...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: agent.prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) { console.error(`No parts in response for ${agent.id}`); return; }

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data!, 'base64');
      fs.writeFileSync(agent.outFile, buffer);
      console.log(`  Saved: ${agent.outFile} (${Math.round(buffer.length / 1024)}KB)`);
      return;
    }
    if (part.text) {
      console.log(`  Model text: ${part.text.slice(0, 100)}`);
    }
  }
  console.error(`  No image generated for ${agent.id}`);
}

async function main() {
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const agent of agents) {
    await generateAvatar(agent);
  }
  console.log('\nDone! Set these as bot profile photos with:');
  console.log('  npx tsx scripts/set-bot-photos.ts');
}

main().catch(console.error);
