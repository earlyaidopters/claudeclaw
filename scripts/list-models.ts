import { GoogleGenAI } from '@google/genai';
import { readEnvFile } from '../src/env.js';

const env = readEnvFile(['GOOGLE_API_KEY']);
const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY || '' });

const models = await ai.models.list();
for await (const m of models) {
  if (m.name?.includes('embed')) {
    console.log(m.name, JSON.stringify(m.supportedActions));
  }
}
