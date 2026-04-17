import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { getKeyFromRequest } from '../lib/keyPool';
import { checkRateLimit, getClientIP } from '../lib/rateLimit';

export const maxDuration = 60;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs });
  }

  try {
    const { prompt, count, difficulty } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
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

    const PRIMARY_MODEL = 'gemini-2.5-flash-preview-04-17';
    const FALLBACK_MODEL = 'gemini-2.0-flash';
    let currentModel = PRIMARY_MODEL;

    for (let attempt = 0; attempt < 3; attempt++) {
      const apiKey = getKeyFromRequest(req.headers as any);
      const ai = new GoogleGenAI({ apiKey });

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
          return res.status(200).json({ questions: [] });
        }
        return res.status(200).json({ questions: JSON.parse(text) });

      } catch (error: any) {
        const msg = error.toString();
        const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        const isOverload = msg.includes('503');

        if (isQuota || isOverload) {
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

    return res.status(503).json({ error: 'AI overloaded, please try again later.' });
  } catch (error: any) {
    console.error('[GENERATE-ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}
