/**
 * Honest stub web research provider — never fabricates results.
 * Source: Caspa caspa-studio StubWebResearchProvider.
 */
export interface WebResearchResult {
  query: string;
  available: false;
  reason: string;
  results: [];
}

export class StubWebResearchProvider {
  async search(query: string): Promise<WebResearchResult> {
    return {
      query,
      available: false,
      reason: 'web_search_unavailable',
      results: [],
    };
  }
}

export const stubWebResearchProvider = new StubWebResearchProvider();
