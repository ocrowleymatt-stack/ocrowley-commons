/**
 * Forensic stylometry metrics + persona consistency scaffolding.
 * Source: nexus-backend services/personaService.js (metrics path; AI optional).
 */

export interface WritingMetrics {
  avgWordLength: number;
  avgSentenceLength: number;
  lexicalDiversity: number;
  punctuationDensity: number;
  wordCount: number;
  sentenceCount: number;
}

export interface WritingSample {
  id: string;
  label: string;
  text: string;
  source?: string;
}

export interface SampleMetrics {
  id: string;
  label: string;
  source?: string;
  metrics: WritingMetrics;
  textPreview: string;
}

export function computeBasicMetrics(text: string): WritingMetrics {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const avgWordLength =
    words.reduce((sum, w) => sum + w.replace(/[^a-z]/gi, '').length, 0) / Math.max(words.length, 1);
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);
  const punctuationDensity = (text.match(/[,;:!?]/g) || []).length / Math.max(words.length, 1);

  return {
    avgWordLength,
    avgSentenceLength,
    lexicalDiversity,
    punctuationDensity,
    wordCount: words.length,
    sentenceCount: sentences.length,
  };
}

export function collectSampleMetrics(samples: WritingSample[]): SampleMetrics[] {
  return samples.map(s => ({
    id: s.id,
    label: s.label,
    source: s.source,
    metrics: computeBasicMetrics(s.text),
    textPreview: s.text.slice(0, 300),
  }));
}

/** Prompt builder for host AI — does not call a model. */
export function buildPersonaConsistencyPrompt(samples: WritingSample[]): string {
  const metrics = collectSampleMetrics(samples);
  return `You are a forensic linguist and stylometric analysis expert. Determine whether multiple writing samples were authored by the same person.

Analyse these ${samples.length} writing samples for authorship consistency:

${metrics
  .map(
    (s, i) => `
SAMPLE ${i + 1} — "${s.label}" (${s.source ?? 'unknown'}):
Text preview: "${s.textPreview}"
Metrics: avg word length=${s.metrics.avgWordLength.toFixed(2)}, avg sentence length=${s.metrics.avgSentenceLength.toFixed(1)}, lexical diversity=${s.metrics.lexicalDiversity.toFixed(3)}, punctuation density=${s.metrics.punctuationDensity.toFixed(3)}
`,
  )
  .join('\n')}

Respond in JSON with: consistencyScore (0-100), verdict (same_author|likely_same|uncertain|likely_different|different_authors), confidence, summary, consistentFeatures, inconsistentFeatures, suspectedAuthors, sampleGroupings, impersonationRisk, ghostwritingRisk, recommendations.`;
}
