/**
 * Rate Limiter — Sliding Window per IP
 * Max 10 requests per minute per IP address.
 * Returns { allowed, retryAfter, queuePosition } 
 */

interface RateLimitEntry {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) ipMap.delete(ip);
  }
}, 5 * 60_000);

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
  
  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);
  
  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      currentCount: entry.timestamps.length,
    };
  }
  
  // Allow and record
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    retryAfterMs: 0,
    currentCount: entry.timestamps.length,
  };
}

/**
 * Extract client IP from Vercel request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}
