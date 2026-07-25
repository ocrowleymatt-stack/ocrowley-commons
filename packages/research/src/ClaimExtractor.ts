export interface ExtractedClaim {
  id: string;
  text: string;
  context: string;
  confidence: number;
}

export class ClaimExtractor {
  extract(text: string): ExtractedClaim[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const factual = sentences.filter((s) =>
      /\b(was|were|is|are|born|died|built|founded|in \d{4})\b/i.test(s),
    );

    return factual.slice(0, 20).map((s, i) => ({
      id: `claim-${i + 1}`,
      text: s.trim(),
      context: 'Extracted from manuscript',
      confidence: 0.6,
    }));
  }
}

export const claimExtractor = new ClaimExtractor();
