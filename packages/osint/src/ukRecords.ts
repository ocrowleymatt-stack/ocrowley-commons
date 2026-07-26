/**
 * UK public-record helpers for people enrichment (optional API keys).
 */

export interface UkOfficerHit {
  title: string;
  companyName?: string;
  companyNumber?: string;
  role?: string;
  url?: string;
  source: 'companies-house' | 'gazette';
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'OcrowleyOSINT/1.0', ...headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Companies House officer search — uses COMPANIES_HOUSE_API_KEY when set; otherwise empty. */
export async function searchCompaniesHouseOfficers(name: string): Promise<UkOfficerHit[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return [];
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const data = (await fetchJson(
    `https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(name)}&items_per_page=8`,
    { Authorization: `Basic ${auth}` },
  )) as { items?: Array<{ title?: string; description?: string; links?: { self?: string } }> } | null;

  if (!data?.items) return [];
  return data.items.slice(0, 8).map(item => ({
    title: item.title || 'Officer',
    companyName: item.description,
    url: item.links?.self
      ? `https://find-and-update.company-information.service.gov.uk${item.links.self.replace('/officers', '/officers')}`
      : `https://find-and-update.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(name)}`,
    source: 'companies-house' as const,
  }));
}
