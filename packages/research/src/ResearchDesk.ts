import { claimExtractor, type ExtractedClaim } from './ClaimExtractor.js';
import { StubWebResearchProvider } from './StubWebResearchProvider.js';

export class ResearchDesk {
  private readonly searchProvider = new StubWebResearchProvider();

  extractClaims(text: string): ExtractedClaim[] {
    return claimExtractor.extract(text);
  }

  async searchWeb(query: string) {
    return this.searchProvider.search(query);
  }
}

export const researchDesk = new ResearchDesk();
