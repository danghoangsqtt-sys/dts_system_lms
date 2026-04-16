import { GoogleGenAI, Type } from '@google/genai';
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
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs,
    }), { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } });
  }

  try {
    const { prompt, count, difficulty } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: CORS_HEADERS });
    }

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          type: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          category: { type: Type.STRING },
          bloomLevel: { type: Type.STRING },
        },
        required: ['content', 'type', 'correctAnswer', 'explanation', 'category', 'bloomLevel'],
      },
    };

    const apiKey = getNextKey();
    const ai = new GoogleGenAI({ apiKey });

    const PRIMARY_MODEL = 'gemini-2.5-flash';
    const FALLBACK_MODEL = 'gemini-flash-latest';
    let currentModel = PRIMARY_MODEL;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.5,
          },
        });

        const text = response.text;
        if (!text) {
          return new Response(JSON.stringify({ questions: [] }), { status: 200, headers: CORS_HEADERS });
        }

        return new Response(JSON.stringify({ questions: JSON.parse(text) }), { status: 200, headers: CORS_HEADERS });

      } catch (error: any) {
        const msg = error.toString();
        const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        const isOverload = msg.includes('503');

        if (isQuota || isOverload) {
          markKeyExhausted(apiKey);
          if (currentModel !== FALLBACK_MODEL) {
            currentModel = FALLBACK_MODEL;
            continue;
          }
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw error;
      }
    }

    return new Response(JSON.stringify({ error: 'AI overloaded' }), { status: 503, headers: CORS_HEADERS });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}
