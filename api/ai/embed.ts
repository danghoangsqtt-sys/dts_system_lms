import { GoogleGenAI } from '@google/genai';
import { getNextKey, markKeyExhausted } from '../_lib/keyPool';
import { checkRateLimit, getClientIP } from '../_lib/rateLimit';

export const maxDuration = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: CORS_HEADERS });
  }

  try {
    const { texts } = await req.json();
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing texts array' }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = getNextKey();
    const ai = new GoogleGenAI({ apiKey });
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      let retries = 0;
      while (retries < 3) {
        try {
          const response = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: [{ parts: [{ text: texts[i] }] }],
          });
          const values = response.embeddings?.[0]?.values;
          embeddings.push(values || []);
          break;
        } catch (error: any) {
          if (error.toString().includes('429')) {
            markKeyExhausted(apiKey);
            retries++;
            await new Promise(r => setTimeout(r, 3000 * retries));
            continue;
          }
          throw error;
        }
      }
    }

    return new Response(JSON.stringify({ embeddings }), { status: 200, headers: CORS_HEADERS });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}
