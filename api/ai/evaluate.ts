import { GoogleGenAI, Type } from '@google/genai';
import { getNextKey, markKeyExhausted } from '../_lib/keyPool';
import { checkRateLimit, getClientIP } from '../_lib/rateLimit';

export const maxDuration = 60;
export const config = { runtime: 'edge' };

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
    return new Response(JSON.stringify({ error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs }), { status: 429, headers: CORS_HEADERS });
  }

  try {
    const { question, correctAnswer, userAnswer } = await req.json();
    if (!question || !userAnswer) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = getNextKey();
    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Đánh giá câu trả lời môn học.\nCâu hỏi: ${question}\nĐáp án chuẩn: ${correctAnswer}\nCâu trả lời sinh viên: ${userAnswer}`,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              feedback: { type: Type.STRING },
            },
            required: ['score', 'feedback'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        return new Response(JSON.stringify({ score: 0, feedback: 'AI không thể đánh giá.' }), { status: 200, headers: CORS_HEADERS });
      }
      return new Response(text, { status: 200, headers: CORS_HEADERS });
    } catch (error: any) {
      if (error.toString().includes('429')) markKeyExhausted(apiKey);
      throw error;
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}
