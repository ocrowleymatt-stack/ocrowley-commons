/**
 * Linguistic deception pattern flags (SCAN/CBCA-inspired heuristics).
 * Source: nexus-backend services/deceptionService.js pattern path.
 * Heuristics are investigative leads only — not lie-detector truth claims.
 */

export interface DeceptionPattern {
  pattern: RegExp;
  label: string;
  weight: number;
}

export interface SentenceFlags {
  sentence: string;
  index: number;
  flags: Array<{ label: string; matches: string[]; weight: number }>;
}

export const DECEPTION_PATTERNS: DeceptionPattern[] = [
  {
    pattern: /\b(I don't remember|I can't recall|I'm not sure|to the best of my knowledge)\b/gi,
    label: 'Memory hedging',
    weight: 0.6,
  },
  {
    pattern: /\b(honestly|to be honest|truthfully|frankly|I swear)\b/gi,
    label: 'Truthfulness assertion',
    weight: 0.7,
  },
  { pattern: /\b(never|always|everyone|no one|nobody|everybody)\b/gi, label: 'Absolute quantifier', weight: 0.4 },
  {
    pattern: /\b(kind of|sort of|basically|pretty much|more or less)\b/gi,
    label: 'Distancing qualifier',
    weight: 0.5,
  },
  {
    pattern: /\b(we|they|it)\b.*\b(was|were|happened|occurred)\b/gi,
    label: 'Passive/pronoun distancing',
    weight: 0.5,
  },
  { pattern: /\b(but|however|although|except|unless)\b/gi, label: 'Contradiction bridge', weight: 0.3 },
];

export function analyseDeceptionPatterns(text: string, patterns: DeceptionPattern[] = DECEPTION_PATTERNS): SentenceFlags[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const flags: SentenceFlags[] = [];

  sentences.forEach((sentence, idx) => {
    const sentenceFlags: SentenceFlags['flags'] = [];
    for (const { pattern, label, weight } of patterns) {
      const matches = sentence.match(pattern);
      if (matches) {
        sentenceFlags.push({ label, matches: matches.slice(0, 3), weight });
      }
    }
    if (sentenceFlags.length > 0) {
      flags.push({ sentence: sentence.trim(), index: idx, flags: sentenceFlags });
    }
  });

  return flags;
}

export function computeBaselineDeceptionScore(flags: SentenceFlags[], totalSentences: number): number {
  if (totalSentences === 0) return 0;
  const totalWeight = flags.reduce((sum, s) => sum + s.flags.reduce((w, f) => w + f.weight, 0), 0);
  return Math.min(95, Math.round((totalWeight / totalSentences) * 40));
}

export function analyseDeceptionBaseline(text: string): {
  overallDeceptionScore: number;
  confidenceLevel: 'low';
  patternFlags: SentenceFlags[];
  sentenceCount: number;
  flaggedSentenceCount: number;
  methodology: string;
  disclaimer: string;
} {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const patternFlags = analyseDeceptionPatterns(text);
  const score = computeBaselineDeceptionScore(patternFlags, sentences.length);
  return {
    overallDeceptionScore: score,
    confidenceLevel: 'low',
    patternFlags,
    sentenceCount: sentences.length,
    flaggedSentenceCount: patternFlags.length,
    methodology: 'Pattern-only (SCAN/CBCA-inspired heuristics)',
    disclaimer:
      'Pattern scores are investigative leads, not determinations of truthfulness. Require human review and primary evidence.',
  };
}
