/**
 * Web archive recovery types + Wayback CDX helpers.
 * Source: nexus-backend services/webArchiveService.js (portable subset).
 */

export interface WebArtefact {
  source: string;
  sourceLabel: string;
  originalUrl: string;
  archiveUrl: string;
  timestamp: string | null;
  mimeType?: string;
  httpStatus?: string;
  size?: number | null;
  type: 'web_archive';
  artefactType: 'deleted_web' | 'snapshot';
  notes?: string;
}

export function normaliseUrl(raw: string): string {
  try {
    let value = raw;
    if (!value.startsWith('http')) value = `https://${value}`;
    const u = new URL(value);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return raw;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(normaliseUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function parseWaybackCdx(data: unknown, sourceLabel = 'Wayback Machine'): WebArtefact[] {
  if (!Array.isArray(data) || data.length < 2) return [];
  const headers = data[0] as string[];
  const results: WebArtefact[] = [];

  for (const row of data.slice(1) as string[][]) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    const original = obj.original ?? '';
    const ts = obj.timestamp;
    results.push({
      source: 'wayback_machine',
      sourceLabel,
      originalUrl: original,
      archiveUrl: ts ? `https://web.archive.org/web/${ts}/${original}` : `https://web.archive.org/web/*/${original}`,
      timestamp: ts ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : null,
      mimeType: obj.mimetype,
      httpStatus: obj.statuscode,
      size: obj.length ? parseInt(obj.length, 10) : null,
      type: 'web_archive',
      artefactType: 'snapshot',
      notes: `Wayback Machine snapshot — ${obj.mimetype || 'unknown type'}`,
    });
  }

  return results;
}

export function waybackCdxUrl(url: string, limit = 50): string {
  return `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=${limit}&fl=timestamp,original,statuscode,mimetype,length&filter=statuscode:200&collapse=digest`;
}

export async function queryWayback(
  url: string,
  fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
): Promise<WebArtefact[]> {
  const data = await fetchJson(waybackCdxUrl(url));
  const exact = parseWaybackCdx(data);
  if (exact.length) return exact;

  const domain = extractDomain(url);
  const domainData = await fetchJson(waybackCdxUrl(`${domain}/*`, 30));
  return parseWaybackCdx(domainData);
}

async function defaultFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OcrowleyArchiveRecovery/1.0 (forensic research)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
