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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  // Rate limit check
  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({
      error: 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
      retryAfterMs: limit.retryAfterMs,
      queuePosition: limit.currentCount - 9,
    }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
    });
  }

  try {
    const body = await req.json();
    const { history, message, systemInstruction, temperature, tools } = body;

    if (!message && !history) {
      return new Response(JSON.stringify({ error: 'Missing message or history' }), {
        status: 400, headers: CORS_HEADERS,
      });
    }

    const PRIMARY_MODEL = 'gemini-2.5-flash';
    const FALLBACK_MODEL = 'gemini-flash-latest';
    let currentModel = body.model || PRIMARY_MODEL;
    
    // Safety: Block preview models
    if (currentModel.includes('preview')) currentModel = PRIMARY_MODEL;

    const apiKey = getNextKey();
    const ai = new GoogleGenAI({ apiKey });

    let config: any = {
      temperature: temperature || 0.7,
    };
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (tools) config.tools = tools;

    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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

        return new Response(JSON.stringify({
          text: response.text || '',
          sources,
          modelUsed: currentModel,
          remaining: limit.remaining,
        }), { status: 200, headers: CORS_HEADERS });

      } catch (error: any) {
        lastError = error;
        const msg = error.toString();
        const status = error.status || 0;
        const isQuota = msg.includes('429') || status === 429 || msg.includes('RESOURCE_EXHAUSTED');
        const isOverload = msg.includes('503') || status === 503;

        if (isQuota || isOverload) {
          markKeyExhausted(apiKey);
          
          if (currentModel !== FALLBACK_MODEL) {
            currentModel = FALLBACK_MODEL;
            if (config.thinkingConfig) delete config.thinkingConfig;
            continue;
          }
          
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        break; // Non-retryable error
      }
    }

    return new Response(JSON.stringify({
      error: lastError?.message || 'Lỗi xử lý AI',
      code: lastError?.status || 500,
    }), { status: 500, headers: CORS_HEADERS });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: CORS_HEADERS,
    });
  }
}
