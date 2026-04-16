/**
 * API Key Pool with Round-Robin & Cooldown
 * Keys that hit 429/RESOURCE_EXHAUSTED are automatically skipped for 60s.
 */

interface KeyState {
  key: string;
  cooldownUntil: number; // timestamp ms
}

const pool: KeyState[] = [];
let currentIndex = 0;
let initialized = false;

function initPool() {
  if (initialized) return;
  const key1 = process.env.GEMINI_API_KEY_1;
  const key2 = process.env.GEMINI_API_KEY_2;
  if (key1) pool.push({ key: key1, cooldownUntil: 0 });
  if (key2) pool.push({ key: key2, cooldownUntil: 0 });
  if (pool.length === 0) {
    throw new Error('[FATAL] No GEMINI_API_KEY_1 or GEMINI_API_KEY_2 environment variables configured.');
  }
  initialized = true;
}

/**
 * Get the next available API key using round-robin.
 * Skips keys that are in cooldown.
 */
export function getNextKey(): string {
  initPool();
  const now = Date.now();
  
  // Try all keys starting from current index
  for (let i = 0; i < pool.length; i++) {
    const idx = (currentIndex + i) % pool.length;
    const entry = pool[idx];
    if (now >= entry.cooldownUntil) {
      currentIndex = (idx + 1) % pool.length;
      return entry.key;
    }
  }
  
  // All keys in cooldown — return the one with shortest remaining cooldown
  const sorted = [...pool].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  return sorted[0].key;
}

/**
 * Mark a key as rate-limited. It will be skipped for `cooldownMs`.
 */
export function markKeyExhausted(key: string, cooldownMs = 60_000): void {
  const entry = pool.find(k => k.key === key);
  if (entry) {
    entry.cooldownUntil = Date.now() + cooldownMs;
    console.warn(`[KEY-POOL] Key ...${key.slice(-6)} in cooldown for ${cooldownMs / 1000}s`);
  }
}

export function getPoolSize(): number {
  initPool();
  return pool.length;
}
