/**
 * API Key Pool — Stateless for Serverless
 * 
 * CRITICAL: In Vercel Serverless, each invocation may run in a different
 * lambda instance. In-memory state (round-robin index, cooldown timers)
 * does NOT persist between invocations.
 * 
 * Strategy: Hash-based key selection using request timestamp.
 * This distributes load across keys without requiring shared state.
 */

let _keys: string[] | null = null;

function getKeys(): string[] {
  if (_keys) return _keys;
  
  const keys: string[] = [];
  const key1 = process.env.GEMINI_API_KEY_1;
  const key2 = process.env.GEMINI_API_KEY_2;
  if (key1) keys.push(key1);
  if (key2) keys.push(key2);
  
  if (keys.length === 0) {
    throw new Error('[FATAL] No GEMINI_API_KEY env vars found.');
  }
  
  _keys = keys;
  return keys;
}

/**
 * Get a key using simple alternation based on current second.
 * Even seconds → key 1, Odd seconds → key 2.
 * This ensures natural load distribution without shared state.
 */
export function getNextKey(): string {
  const keys = getKeys();
  if (keys.length === 1) return keys[0];
  const index = Math.floor(Date.now() / 1000) % keys.length;
  return keys[index];
}

/**
 * Get a specific key by index (0 or 1). Used for retry with alternate key.
 */
export function getKeyByIndex(index: number): string {
  const keys = getKeys();
  return keys[index % keys.length];
}

/**
 * Get total number of keys configured.
 */
export function getPoolSize(): number {
  return getKeys().length;
}

/**
 * markKeyExhausted is a no-op in stateless mode.
 * Retry logic in handlers will switch to the other key directly.
 */
export function markKeyExhausted(_key: string, _cooldownMs = 60_000): void {
  // No-op: stateless serverless cannot persist cooldown state.
}
