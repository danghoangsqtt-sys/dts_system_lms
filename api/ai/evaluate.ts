import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { getNextKey, getKeyByIndex } from '../lib/keyPool';
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

  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs });
  }

  try {
    const { question, correctAnswer, userAnswer } = req.body;
    if (!question || !userAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
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
        return res.status(200).json({ score: 0, feedback: 'AI không thể đánh giá.' });
      }
      return res.status(200).json(JSON.parse(text));

    } catch (error: any) {
      // On quota error, try alternate key once
      if (error.toString().includes('429')) {
        const altKey = getKeyByIndex(1);
        const altAi = new GoogleGenAI({ apiKey: altKey });
        try {
          const response = await altAi.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Đánh giá câu trả lời.\nCâu hỏi: ${question}\nĐáp án: ${correctAnswer}\nTrả lời: ${userAnswer}`,
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
          return res.status(200).json(text ? JSON.parse(text) : { score: 0, feedback: 'AI không thể đánh giá.' });
        } catch (retryErr: any) {
          throw retryErr;
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[EVALUATE-ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}
