/**
 * Optional Brave web search provider (from novel-machine webSearch shape).
 * Never fabricates — returns web_search_unavailable without BRAVE_API_KEY.
 */
export interface WebHit {
  title: string;
  url: string;
  snippet: string;
}

export async function braveSearch(query: string, count = 5): Promise<{ available: boolean; results: WebHit[]; reason?: string }> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return { available: false, results: [], reason: 'web_search_unavailable' };
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    });
    if (!res.ok) return { available: false, results: [], reason: `brave_http_${res.status}` };
    const data = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
    const results = (data.web?.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
    }));
    return { available: true, results };
  } catch (e) {
    return { available: false, results: [], reason: e instanceof Error ? e.message : 'web_search_error' };
  }
}
