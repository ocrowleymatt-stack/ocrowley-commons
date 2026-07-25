/**
 * Breach / index provider adapters. Keys from env only — never hardcoded.
 * Sources: spiderfoot-ui darkWebSearch.ts; nexus-backend darkWebService.js
 */

import type { BreachHit, IntelXRecord } from './types.js';

export interface BreachProvider {
  id: string;
  check(query: string): Promise<BreachHit[]>;
}

export interface DarkWebSearchProvider {
  id: string;
  search(query: string): Promise<import('./types.js').DarkWebMention[]>;
}

export function createHibpProvider(options: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
} = {}): BreachProvider {
  const apiKey = options.apiKey ?? process.env.HIBP_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: 'hibp',
    async check(query: string): Promise<BreachHit[]> {
      if (!apiKey || !query.includes('@')) return [];
      try {
        const resp = await fetchImpl(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}?truncateResponse=false`,
          {
            headers: {
              'hibp-api-key': apiKey,
              'User-Agent': 'OcrowleyDarkweb/1.0',
            },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (resp.status === 404 || !resp.ok) return [];
        const data = (await resp.json()) as Array<{
          Name: string;
          Domain?: string;
          BreachDate?: string;
          DataClasses?: string[];
          PwnCount?: number;
        }>;
        return data.map(b => ({
          source: 'hibp' as const,
          name: b.Name,
          domain: b.Domain,
          date: b.BreachDate,
          dataClasses: b.DataClasses,
          count: b.PwnCount,
        }));
      } catch {
        return [];
      }
    },
  };
}

export function createDehashedProvider(options: {
  email?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
} = {}): BreachProvider {
  const email = options.email ?? process.env.DEHASHED_EMAIL ?? '';
  const apiKey = options.apiKey ?? process.env.DEHASHED_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: 'dehashed',
    async check(query: string): Promise<BreachHit[]> {
      if (!email || !apiKey) return [];
      try {
        const field = query.includes('@') ? 'email' : 'username';
        const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');
        const resp = await fetchImpl(
          `https://api.dehashed.com/search?query=${field}:${encodeURIComponent(query)}&size=5`,
          {
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!resp.ok) return [];
        const data = (await resp.json()) as {
          entries?: Array<{ database_name?: string; obtained_from?: string }>;
        };
        const seen = new Set<string>();
        return (data.entries || []).reduce<BreachHit[]>((acc, e) => {
          const name = e.database_name || e.obtained_from || 'Unknown';
          if (!seen.has(name)) {
            seen.add(name);
            acc.push({ source: 'dehashed', name });
          }
          return acc;
        }, []);
      } catch {
        return [];
      }
    },
  };
}

export async function searchIntelX(
  query: string,
  options: { apiKey?: string; fetchImpl?: typeof fetch; settleMs?: number } = {},
): Promise<{ results: IntelXRecord[]; total: number }> {
  const apiKey = options.apiKey ?? process.env.INTELX_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) return { results: [], total: 0 };

  try {
    const searchResp = await fetchImpl('https://2.intelx.io/intelligent/search', {
      method: 'POST',
      headers: { 'x-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term: query,
        maxresults: 20,
        media: 0,
        target: 0,
        terminate: [],
        timeout: 10,
        datefrom: '',
        dateto: '',
        sort: 4,
        buckets: [],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!searchResp.ok) return { results: [], total: 0 };
    const searchData = (await searchResp.json()) as { id?: string };
    if (!searchData.id) return { results: [], total: 0 };

    await new Promise(r => setTimeout(r, options.settleMs ?? 2000));

    const resultsResp = await fetchImpl(
      `https://2.intelx.io/intelligent/search/result?id=${searchData.id}&limit=20&offset=0`,
      { headers: { 'x-key': apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!resultsResp.ok) return { results: [], total: 0 };
    const resultsData = (await resultsResp.json()) as {
      records?: IntelXRecord[];
      total?: number;
    };
    return { results: resultsData.records || [], total: resultsData.total || 0 };
  } catch {
    return { results: [], total: 0 };
  }
}

/** Honest stub — never fabricates breach or dark-web hits. */
export const stubBreachProvider: BreachProvider = {
  id: 'stub',
  async check() {
    return [];
  },
};

export const stubDarkWebSearchProvider: DarkWebSearchProvider = {
  id: 'stub',
  async search() {
    return [];
  },
};
