/**
 * Stronger, concurrent presence probes for people lookup.
 * Prefer GET + soft-404 heuristics over naive HEAD (many sites break HEAD).
 */

import { DEFAULT_USERNAME_PLATFORMS, resolvePlatformUrl } from './platforms.js';
import type { PlatformHit, PlatformProbe } from './types.js';

const SOFT_404 = [
  /page not found/i,
  /user not found/i,
  /doesn't exist/i,
  /does not exist/i,
  /404/i,
  /sorry, this page/i,
  /account suspended/i,
  /hasn't been claimed/i,
];

export async function probeUrlPresence(url: string): Promise<{ ok: boolean; status: number; snippet: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OcrowleyPeople/2.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });
    const text = (await res.text()).slice(0, 2500);
    if (!res.ok) return { ok: false, status: res.status, snippet: text.slice(0, 120) };
    if (SOFT_404.some(r => r.test(text))) return { ok: false, status: res.status, snippet: 'soft-404' };
    return { ok: true, status: res.status, snippet: text.replace(/\s+/g, ' ').slice(0, 160) };
  } catch {
    return { ok: false, status: 0, snippet: '' };
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

/** Probe one username across platforms concurrently; return only confirmed hits. */
export async function probeUsernameHard(
  username: string,
  options: { platforms?: PlatformProbe[]; concurrency?: number } = {},
): Promise<PlatformHit[]> {
  const platforms = options.platforms ?? DEFAULT_USERNAME_PLATFORMS;
  const concurrency = options.concurrency ?? 8;
  const results = await mapPool(platforms, concurrency, async p => {
    const url = resolvePlatformUrl(p, username);
    const presence = await probeUrlPresence(url);
    return {
      site: p.site,
      url,
      found: presence.ok,
      confirmed: presence.ok,
      snippet: presence.snippet,
    } as PlatformHit & { snippet?: string };
  });
  return results.filter(r => r.found);
}

/** Probe many usernames; optionally all usernames in parallel. */
export async function probePeopleUsernames(
  usernames: string[],
  options: {
    maxUsernames?: number;
    concurrency?: number;
    platforms?: PlatformProbe[];
    parallelUsernames?: boolean;
  } = {},
): Promise<Array<PlatformHit & { username: string }>> {
  const max = options.maxUsernames ?? 8;
  const list = usernames.slice(0, max);
  const runOne = async (u: string) => {
    const found = await probeUsernameHard(u, {
      concurrency: options.concurrency ?? 8,
      platforms: options.platforms,
    });
    return found.map(f => ({ ...f, username: u }));
  };

  const nested = options.parallelUsernames
    ? await Promise.all(list.map(runOne))
    : await (async () => {
        const out: Array<Array<PlatformHit & { username: string }>> = [];
        for (const u of list) out.push(await runOne(u));
        return out;
      })();

  const hits = nested.flat();
  const seen = new Set<string>();
  return hits.filter(h => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

/** Gravatar existence check from email (no API key). */
export async function probeGravatar(email: string): Promise<{ url: string; found: boolean } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return null;
  const { createHash } = await import('node:crypto');
  const hash = createHash('md5').update(normalized).digest('hex');
  const url = `https://www.gravatar.com/avatar/${hash}?d=404`;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return { url: `https://www.gravatar.com/${hash}`, found: res.status === 200 };
  } catch {
    return { url: `https://www.gravatar.com/${hash}`, found: false };
  }
}
