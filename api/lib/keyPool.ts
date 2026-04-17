/**
 * API Key — Single Key Mode
 * Priority: X-Gemini-Key request header > GEMINI_API_KEY env var.
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

/** Returns key from request header if present, otherwise falls back to env var. */
export function getKeyFromRequest(headers: Record<string, string | string[] | undefined>): string {
  const headerKey = headers['x-gemini-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.startsWith('AIza')) {
    return headerKey;
  }
  return getNextKey();
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
