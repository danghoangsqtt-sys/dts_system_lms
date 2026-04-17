/**
 * API Key — Single Key Mode
 * Reads GEMINI_API_KEY from environment variables.
 */

let _key: string | null = null;

export function getNextKey(): string {
  if (_key) return _key;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('[FATAL] GEMINI_API_KEY environment variable is not configured.');
  }
  _key = key;
  return _key;
}

/** Alias for compatibility — always returns the same key. */
export function getKeyByIndex(_index: number): string {
  return getNextKey();
}

export function getPoolSize(): number {
  return 1;
}

export function markKeyExhausted(_key: string, _cooldownMs = 60_000): void {
  // No-op in single key mode
}
