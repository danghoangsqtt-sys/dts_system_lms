import { getNextKey } from '../lib/keyPool.js';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';

export const maxDuration = 60;
export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

/**
 * Token endpoint for LiveChat audio sessions.
 * Returns a temporary API key for the client to use with the Live API.
 * Rate limited to prevent abuse.
 */
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const ip = getClientIP(req.headers);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429, headers: CORS_HEADERS,
    });
  }

  try {
    const key = getNextKey();
    return new Response(JSON.stringify({ key }), { status: 200, headers: CORS_HEADERS });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}
