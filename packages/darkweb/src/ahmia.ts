/**
 * Ahmia clearnet Tor-index HTML parsers.
 * Sources: nexus-backend darkWebService.js; spiderfoot-ui darkWebSearch.ts
 */

import type { DarkWebMention } from './types.js';

export const AHMIA_SEARCH_URL = 'https://ahmia.fi/search/';

/** spiderfoot-ui style: <li class="result"> blocks */
export function parseAhmiaResultBlocks(html: string, limit = 10): DarkWebMention[] {
  const results: DarkWebMention[] = [];
  const resultBlocks = html.match(/<li class="result"[^>]*>[\s\S]*?<\/li>/g) || [];
  for (const block of resultBlocks.slice(0, limit)) {
    const titleMatch = block.match(/<h4[^>]*><a[^>]*>([^<]+)<\/a>/);
    const urlMatch = block.match(/href="([^"]+\.onion[^"]*)"/);
    const descMatch = block.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/p>/);
    if (titleMatch) {
      const onion = urlMatch ? urlMatch[1] : '';
      results.push({
        title: titleMatch[1].trim(),
        url: onion,
        onionUrl: onion || undefined,
        description: descMatch ? descMatch[1].trim() : '',
        source: 'Ahmia (Tor search index)',
      });
    }
  }
  return results;
}

/** nexus-backend style: <h4><a href=...> pairs with description paragraphs */
export function parseAhmiaLegacyHtml(html: string, limit = 10): DarkWebMention[] {
  const matches: DarkWebMention[] = [];
  const titleRegex = /<h4><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h4>/g;
  const descRegex = /<p class="result-description">([^<]+)<\/p>/g;
  let titleMatch: RegExpExecArray | null;
  while ((titleMatch = titleRegex.exec(html)) !== null) {
    const descMatch = descRegex.exec(html);
    matches.push({
      url: titleMatch[1],
      title: titleMatch[2].trim(),
      description: descMatch ? descMatch[1].trim() : '',
      onionUrl: titleMatch[1].includes('.onion') ? titleMatch[1] : undefined,
      source: 'Ahmia (Tor search index)',
    });
  }
  return matches.slice(0, limit);
}

export function parseAhmiaHtml(html: string, limit = 10): DarkWebMention[] {
  const blocks = parseAhmiaResultBlocks(html, limit);
  if (blocks.length) return blocks;
  return parseAhmiaLegacyHtml(html, limit);
}

export function ahmiaSearchUrl(query: string): string {
  return `${AHMIA_SEARCH_URL}?q=${encodeURIComponent(query)}`;
}

export async function searchAhmia(
  query: string,
  fetchText: (url: string) => Promise<string | null> = defaultFetchText,
): Promise<DarkWebMention[]> {
  const html = await fetchText(ahmiaSearchUrl(query));
  if (!html) return [];
  return parseAhmiaHtml(html);
}

async function defaultFetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OcrowleyDarkweb/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
