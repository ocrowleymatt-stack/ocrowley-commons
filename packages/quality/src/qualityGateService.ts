/**
 * Quality gate heuristics for Novel Write Pro
 */

import type { QualityGateFinding, QualityGateStatus, NovelWriteProMode } from './types.js';

const FILLER_PATTERNS = [
  /\bvery\b/gi,
  /\breally\b/gi,
  /\bquite\b/gi,
  /\bsuddenly\b/gi,
  /\bseemed to\b/gi,
  /\bfelt like\b/gi,
  /\ba sense of\b/gi,
  /\bin that moment\b/gi,
];

const PASSIVE_HINT = /\b(was|were|is|are|been|being)\s+\w+ed\b/gi;

function scoreToStatus(score: number): QualityGateStatus {
  if (score >= 75) return 'pass';
  if (score >= 50) return 'warn';
  return 'fail';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function runQualityGates(content: string, mode: NovelWriteProMode = 'novel'): QualityGateFinding[] {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const dialogueLines = (content.match(/^["“]/gm) || []).length;
  const findings: QualityGateFinding[] = [];

  // Length gate
  const minWords = mode === 'script' ? 80 : 120;
  const lengthScore = wordCount >= minWords ? clamp(60 + wordCount / 40, 60, 100) : clamp(wordCount / minWords * 50, 0, 49);
  findings.push({
    gate: 'Length & substance',
    status: scoreToStatus(lengthScore),
    score: Math.round(lengthScore),
    issues:
      wordCount < minWords
        ? [`Only ${wordCount} words — expand scenes or paste a fuller excerpt.`]
        : [],
  });

  // Filler gate
  let fillerHits = 0;
  for (const pattern of FILLER_PATTERNS) {
    fillerHits += (content.match(pattern) || []).length;
  }
  const fillerRatio = wordCount ? fillerHits / wordCount : 0;
  const fillerScore = clamp(100 - fillerRatio * 800, 0, 100);
  findings.push({
    gate: 'Filler & hedge words',
    status: scoreToStatus(fillerScore),
    score: Math.round(fillerScore),
    issues:
      fillerHits > 3
        ? [`${fillerHits} weak hedge/filler hits — cut "very", "suddenly", "seemed to".`]
        : [],
  });

  // Specificity gate (concrete nouns vs abstract)
  const abstractHits = (content.match(/\b(feel|feeling|emotion| sadness|anger| fear| love| grief| pain)\b/gi) || []).length;
  const specificityScore = clamp(100 - abstractHits * 4, 20, 100);
  findings.push({
    gate: 'Concrete specificity',
    status: scoreToStatus(specificityScore),
    score: Math.round(specificityScore),
    issues:
      abstractHits > 5
        ? ['Too many emotion labels — show behaviour and objects instead.']
        : [],
  });

  // Dialogue / rhythm (mode-aware)
  if (mode === 'script' || mode === 'musical') {
    const dialogueScore = dialogueLines >= 3 ? 85 : dialogueLines >= 1 ? 60 : 35;
    findings.push({
      gate: 'Playable dialogue',
      status: scoreToStatus(dialogueScore),
      score: dialogueScore,
      issues: dialogueLines < 2 ? ['Add more speakable lines — stage pieces need audible conflict.'] : [],
    });
  } else {
    const avgSentenceLen = sentences.length ? wordCount / sentences.length : wordCount;
    const rhythmScore = avgSentenceLen > 28 ? 55 : avgSentenceLen < 6 ? 50 : 82;
    findings.push({
      gate: 'Rhythm & pacing',
      status: scoreToStatus(rhythmScore),
      score: rhythmScore,
      issues:
        avgSentenceLen > 28
          ? ['Sentences run long — vary length for tension.']
          : avgSentenceLen < 6
            ? ['Too many staccato fragments — let weather sentences breathe.']
            : [],
    });
  }

  // Passive voice hint
  const passiveHits = (content.match(PASSIVE_HINT) || []).length;
  const passiveScore = clamp(100 - passiveHits * 6, 30, 100);
  findings.push({
    gate: 'Active voice',
    status: scoreToStatus(passiveScore),
    score: Math.round(passiveScore),
    issues: passiveHits > 4 ? [`~${passiveHits} passive constructions detected.`] : [],
  });

  return findings;
}

export function aggregateQuality(findings: QualityGateFinding[]): {
  overallScore: number;
  status: QualityGateStatus;
} {
  if (!findings.length) return { overallScore: 0, status: 'fail' };
  const overallScore = Math.round(findings.reduce((sum, f) => sum + f.score, 0) / findings.length);
  const hasFail = findings.some((f) => f.status === 'fail');
  const hasWarn = findings.some((f) => f.status === 'warn');
  const status: QualityGateStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
  return { overallScore, status };
}

const MODE_HINTS: Record<NovelWriteProMode, string> = {
  novel: 'Award-target literary fiction: vivid specificity, earned emotion, no AI sludge.',
  script: 'Stage/screen dialogue: playable lines, clear beats, minimal unfilmable exposition.',
  musical: 'Musical theatre: singable lyric clarity, stageable action, song placement logic.',
  adaptation: 'Faithful adaptation: preserve source intent while sharpening dramatic shape.',
  polish: 'Manuscript polish: tighten rhythm, cut filler, preserve author voice and story.',
  chaos: 'High-voltage experimental prose while keeping readable through-line.',
};

export function modeHint(mode: NovelWriteProMode): string {
  return MODE_HINTS[mode];
}
