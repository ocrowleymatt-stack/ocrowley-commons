/** Result type from Shakespeare persistenceService (local-first pattern). */
export type PersistResult<T = void> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; error: string; fromCache: boolean };

export function ok<T>(data: T, fromCache = false): PersistResult<T> {
  return { ok: true, data, fromCache };
}

export function fail(error: unknown, fromCache = false): PersistResult<never> {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false, error: msg, fromCache };
}
