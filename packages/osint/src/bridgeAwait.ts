/**
 * Awaitable HTTP bridge helpers for SpiderFoot / BigBrother / SpiderDash.
 * Polls until finished so long scans are not truncated by a single request timeout.
 */

export function bridgeTimeoutMs(): number {
  return Number(process.env.OCROWLEY_BRIDGE_TIMEOUT_MS || 180_000);
}

export function bridgePollMs(): number {
  return Number(process.env.OCROWLEY_BRIDGE_POLL_MS || 3_000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function postJson(
  url: string,
  body: unknown,
  timeoutMs = bridgeTimeoutMs(),
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: unknown | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch {
    return { ok: false, status: 0, json: null, text: '' };
  }
}

export async function getJson(
  url: string,
  timeoutMs = Math.min(bridgeTimeoutMs(), 60_000),
): Promise<{ ok: boolean; status: number; json: unknown | null }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: unknown | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function scanIdOf(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  for (const k of ['scanId', 'id', 'scan_id', 'jobId', 'job_id']) {
    const v = payload[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function statusOf(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const raw = payload.status ?? payload.state ?? payload.scanStatus ?? payload.phase;
  return String(raw || '').toUpperCase();
}

function isTerminal(status: string): boolean {
  return /FINISHED|COMPLETE|COMPLETED|DONE|ERROR|FAILED|ABORTED|STOPPED|SUCCESS/.test(status);
}

function isSuccess(status: string): boolean {
  return /FINISHED|COMPLETE|COMPLETED|DONE|SUCCESS/.test(status);
}

/**
 * POST a scan, then poll status/result endpoints until terminal or timeout.
 * Works with sync bridges that return `items` immediately, and async ones that return an id.
 */
export async function runAwaitableBridge(opts: {
  baseUrl: string;
  startPath: string;
  body: unknown;
  /** Status poll paths; `{id}` replaced with scan id. */
  statusPaths?: string[];
  /** Result fetch paths after success. */
  resultPaths?: string[];
  timeoutMs?: number;
  pollMs?: number;
}): Promise<Record<string, unknown> | null> {
  const base = opts.baseUrl.replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? bridgeTimeoutMs();
  const pollMs = opts.pollMs ?? bridgePollMs();
  const started = await postJson(`${base}${opts.startPath}`, opts.body, timeoutMs);
  if (!started.ok && !started.json) return null;

  const initial = asRecord(started.json) || {};
  if (Array.isArray(initial.items) || Array.isArray(initial.entities) || Array.isArray(initial.results)) {
    return initial;
  }

  const id = scanIdOf(initial);
  if (!id) {
    // Sync empty or opaque success — return whatever we got
    return Object.keys(initial).length ? initial : null;
  }

  const statusPaths =
    opts.statusPaths ??
    [`/api/scanstatus/${id}`, `/api/scan/${id}`, `/api/scans/${id}`, `/scan/${id}`, `/status/${id}`];
  const resultPaths =
    opts.resultPaths ??
    [`/api/scaneventresults/${id}`, `/api/scan/${id}/results`, `/api/scans/${id}/results`, `/results/${id}`];

  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> = { ...initial, scanId: id };

  while (Date.now() < deadline) {
    await sleep(pollMs);
    for (const pathTpl of statusPaths) {
      const path = pathTpl.replaceAll('{id}', id).replaceAll(id, id);
      // path templates already include id in defaults
      const statusUrl = path.includes(id) ? `${base}${path}` : `${base}${pathTpl.replace('{id}', id)}`;
      const st = await getJson(statusUrl, Math.min(30_000, timeoutMs));
      const rec = asRecord(st.json);
      if (!rec) continue;
      last = { ...last, ...rec, scanId: id };
      const status = statusOf(rec);
      if (isTerminal(status)) {
        if (!isSuccess(status) && Array.isArray(rec.items)) return last;
        for (const rpath of resultPaths) {
          const resultUrl = `${base}${rpath.replaceAll('{id}', id)}`;
          const results = await getJson(resultUrl, Math.min(60_000, timeoutMs));
          const rrec = asRecord(results.json);
          if (rrec) {
            return {
              ...last,
              ...rrec,
              items: (rrec.items as unknown[]) || (rrec.results as unknown[]) || (last.items as unknown[]) || [],
              scanId: id,
              status,
            };
          }
        }
        return { ...last, status };
      }
      break;
    }
  }

  return { ...last, status: statusOf(last) || 'TIMEOUT', timedOut: true };
}
