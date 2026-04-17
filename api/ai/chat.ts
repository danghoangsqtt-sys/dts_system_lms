import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getNextKey, getKeyByIndex, getPoolSize } from '../lib/keyPool';
import { checkRateLimit, getClientIP } from '../lib/rateLimit';

export const maxDuration = 60;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
    return res.status(429).json({
      error: 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
      retryAfterMs: limit.retryAfterMs,
    });
  }

  try {
    const { history, message, systemInstruction, temperature, tools, model } = req.body;

    if (!message && !history) {
      return res.status(400).json({ error: 'Missing message or history' });
    }

    const PRIMARY_MODEL = 'gemini-2.5-flash-preview-04-17';
    const FALLBACK_MODEL = 'gemini-2.0-flash';
    let currentModel = model || PRIMARY_MODEL;
    if (currentModel.includes('preview')) currentModel = PRIMARY_MODEL;

    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Alternate key on each retry
      const apiKey = attempt === 0 ? getNextKey() : getKeyByIndex(attempt);
      const ai = new GoogleGenAI({ apiKey });

      const config: any = { temperature: temperature || 0.7 };
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (tools) config.tools = tools;

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: history
            ? [...history, { role: 'user', parts: [{ text: message }] }]
            : message,
          config,
        });

        // Extract grounding sources
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.filter((chunk: any) => chunk.web)
          ?.map((chunk: any) => ({ uri: chunk.web.uri, title: chunk.web.title })) || [];

        return res.status(200).json({
          text: response.text || '',
          sources,
          modelUsed: currentModel,
          remaining: limit.remaining,
        });

      } catch (error: any) {
        lastError = error;
        const msg = error.toString();
        const status = error.status || 0;
        const isQuota = msg.includes('429') || status === 429 || msg.includes('RESOURCE_EXHAUSTED');
        const isOverload = msg.includes('503') || status === 503;

        if (isQuota || isOverload) {
          // Fall back to cheaper model
          if (currentModel !== FALLBACK_MODEL) {
            currentModel = FALLBACK_MODEL;
            continue;
          }
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        break; // Non-retryable
      }
    }

    return res.status(500).json({
      error: lastError?.message || 'Lỗi xử lý AI',
      code: lastError?.status || 500,
    });

  } catch (error: any) {
    console.error('[CHAT-ERROR]', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
