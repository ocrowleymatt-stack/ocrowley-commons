/** Synchronous localStorage cache helpers (browser). No-ops safely when unavailable. */
function storage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readCache<T>(key: string): T | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    /* quota errors ignored */
  }
}

export function removeCache(key: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    /* ignore */
  }
}
