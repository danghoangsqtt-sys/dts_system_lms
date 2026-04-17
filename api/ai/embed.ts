import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
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
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Missing texts array' });
    }

    const apiKey = getKeyFromRequest(req.headers as any);
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
            retries++;
            await new Promise(r => setTimeout(r, 2000 * retries));
            continue;
          }
          throw error;
        }
      }
    }

    return res.status(200).json({ embeddings });
  } catch (error: any) {
    console.error('[EMBED-ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}
