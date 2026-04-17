/**
 * Rate Limiter — Best-effort for Serverless
 * 
 * NOTE: In-memory rate limiting is per-instance only.
 * Each Vercel lambda has its own memory, so this is NOT globally accurate.
 * It still provides protection within a single warm instance.
 * For production-grade rate limiting, use Redis/Upstash.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 15; // Generous limit since it's per-instance only

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  currentCount: number;
} {
  const now = Date.now();

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { timestamps: [] });
  }

  const entry = ipMap.get(ip)!;
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, remaining: 0, retryAfterMs, currentCount: entry.timestamps.length };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    retryAfterMs: 0,
    currentCount: entry.timestamps.length,
  };
}

/**
 * Extract client IP — works with both Node.js IncomingHttpHeaders
 * and Web API Headers objects.
 */
export function getClientIP(headers: any): string {
  // Node.js format (VercelRequest.headers is an object)
  if (headers && typeof headers === 'object' && !('get' in headers)) {
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    const realIp = headers['x-real-ip'];
    if (typeof realIp === 'string') return realIp;
    return '0.0.0.0';
  }

  // Web API Headers format (fallback)
  if (headers && typeof headers.get === 'function') {
    return (
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      '0.0.0.0'
    );
  }

  return '0.0.0.0';
}
