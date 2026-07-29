/**
 * SpiderDash (ARCANUM) tRPC bridge — start scan, poll until finished, pull results.
 */

import { getJson, postJson, sleep, bridgeTimeoutMs, bridgePollMs } from './bridgeAwait.js';
import { resolveSpiderdashUrl } from './bridgeDefaults.js';
import type { OsintEvidenceItem } from './recursiveEngine.js';
import type { RefinementSeed } from './refinementLoop.js';

function trpcData(json: unknown): Record<string, unknown> | unknown[] | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const result = root.result as Record<string, unknown> | undefined;
  const data = result?.data as Record<string, unknown> | undefined;
  if (data && 'json' in data) return data.json as Record<string, unknown> | unknown[];
  if (root.error) return null;
  return root as Record<string, unknown>;
}

async function fetchModules(base: string): Promise<string[]> {
  const res = await getJson(`${base}/api/trpc/spiderfoot.modules`);
  const data = trpcData(res.json);
  if (!Array.isArray(data)) return ['sfp_accounts', 'sfp_spider', 'sfp_email', 'sfp_archiveorg', 'sfp_social'];
  return data
    .map(m => (m && typeof m === 'object' ? String((m as { name?: string }).name || '') : ''))
    .filter(Boolean)
    .slice(0, 80);
}

/**
 * Run a person/target scan via SpiderDash → SpiderFoot, waiting until FINISHED.
 */
export async function runSpiderdashWhoScan(opts: {
  target: string;
  name?: string;
  scanType?: string;
  seeds?: RefinementSeed[];
  authorizationRef?: string;
}): Promise<{ items: OsintEvidenceItem[]; seeds: RefinementSeed[]; scanId?: string; status?: string } | null> {
  const base = resolveSpiderdashUrl().replace(/\/$/, '');
  if (!base) return null;

  const modules = await fetchModules(base);
  const name = opts.name || `WHO: ${opts.target}`.slice(0, 80);
  const started = await postJson(
    `${base}/api/trpc/spiderfoot.scanStart`,
    {
      json: {
        name,
        target: opts.target,
        scanType: opts.scanType || 'Passive',
        modules,
      },
    },
    Math.min(bridgeTimeoutMs(), 60_000),
  );

  const startData = trpcData(started.json) as Record<string, unknown> | null;
  const scanId = startData && typeof startData.scanId === 'string' ? startData.scanId : null;

  // Fallback: older /api/scan contract
  if (!scanId) {
    const legacy = await postJson(
      `${base}/api/scan`,
      {
        seeds: opts.seeds,
        target: opts.target,
        name,
        authorizationRef: opts.authorizationRef,
        source: 'ocrowley-who',
      },
      bridgeTimeoutMs(),
    );
    const leg = legacy.json as Record<string, unknown> | null;
    if (leg && (Array.isArray(leg.items) || Array.isArray(leg.entities))) {
      return {
        items: (leg.items as OsintEvidenceItem[]) || [],
        seeds: (leg.seeds as RefinementSeed[]) || [],
        status: String(leg.status || 'SYNC'),
      };
    }
    // If start failed, still try globalSearch for prior results
    return searchSpiderdashGlobal(base, opts.target);
  }

  const deadline = Date.now() + bridgeTimeoutMs();
  let status = 'RUNNING';
  while (Date.now() < deadline) {
    await sleep(bridgePollMs());
    const input = encodeURIComponent(JSON.stringify({ json: { scanId } }));
    const st = await getJson(`${base}/api/trpc/spiderfoot.scanStatus?input=${input}`);
    const stData = trpcData(st.json) as Record<string, unknown> | null;
    status = String(stData?.status || stData?.scanStatus || '').toUpperCase();
    if (/FINISHED|COMPLETE|COMPLETED|ERROR|FAILED|ABORTED|STOPPED/.test(status)) break;
  }

  const resultsInput = encodeURIComponent(JSON.stringify({ json: { scanId } }));
  const results = await getJson(`${base}/api/trpc/spiderfoot.scanResults?input=${resultsInput}`);
  const resultData = trpcData(results.json);
  const items: OsintEvidenceItem[] = [];
  const rows = Array.isArray(resultData)
    ? resultData
    : resultData && typeof resultData === 'object' && Array.isArray((resultData as { results?: unknown[] }).results)
      ? ((resultData as { results: unknown[] }).results)
      : [];

  for (const [i, row] of rows.entries()) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const data = String(r.data || r.value || r.module || '');
    const typeName = String(r.type || r.eventType || r.source || 'spiderfoot');
    if (!data) continue;
    items.push({
      key: `sf:${scanId}:${i}:${data.slice(0, 80)}`,
      entity: opts.target,
      title: `${typeName}`,
      source: 'spiderfoot-scan',
      snippet: data.slice(0, 400),
      url: /^https?:/i.test(data) ? data : undefined,
      score: status.startsWith('FINISH') || status.startsWith('COMPLETE') ? 72 : 55,
    });
  }

  if (!items.length) {
    const searched = await searchSpiderdashGlobal(base, opts.target);
    if (searched) return { ...searched, scanId, status };
  }

  return { items, seeds: [], scanId, status };
}

async function searchSpiderdashGlobal(
  base: string,
  query: string,
): Promise<{ items: OsintEvidenceItem[]; seeds: RefinementSeed[]; status?: string } | null> {
  const input = encodeURIComponent(JSON.stringify({ json: { query, maxScans: 20 } }));
  const res = await getJson(`${base}/api/trpc/spiderfoot.globalSearch?input=${input}`);
  const data = trpcData(res.json);
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  if (!rows.length) return null;
  const items: OsintEvidenceItem[] = [];
  for (const [i, row] of rows.slice(0, 40).entries()) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const dataVal = String(r.data || r.value || r.snippet || '');
    if (!dataVal) continue;
    items.push({
      key: `sf-global:${query}:${i}:${dataVal.slice(0, 60)}`,
      entity: query,
      title: String(r.type || r.eventType || 'SpiderFoot'),
      source: 'spiderfoot-scan',
      snippet: dataVal.slice(0, 400),
      url: /^https?:/i.test(dataVal) ? dataVal : undefined,
      score: 65,
    });
  }
  return items.length ? { items, seeds: [], status: 'GLOBAL_SEARCH' } : null;
}
