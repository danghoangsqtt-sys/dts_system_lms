import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getNextKey } from '../lib/keyPool.js';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';

export const maxDuration = 60;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Token endpoint for LiveChat audio sessions.
 * Returns a temporary API key for the client to use with the Live API.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const key = getNextKey();
    return res.status(200).json({ key });
  } catch (error: any) {
    console.error('[TOKEN-ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}
