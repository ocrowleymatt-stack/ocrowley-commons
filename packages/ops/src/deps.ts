/** Optional runtime deps for doctor checks — inject in host apps. */
export async function probeUrl(url: string, timeoutMs = 2000): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
