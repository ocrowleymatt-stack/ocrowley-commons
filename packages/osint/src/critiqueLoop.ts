/**
 * Critique / improve loop — recursive quality refinement of an OSINT dossier brief.
 * Complements seed expansion: discovery finds more; critique makes the output better.
 */

import { staticRiskReviewFallback, type EntityFindings } from './prompts.js';

export interface CritiqueFinding {
  entity: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  suggestedSeed?: { type: string; value: string };
}

export interface CritiqueReport {
  round: number;
  score: number;
  gaps: string[];
  risks: string[];
  flags: CritiqueFinding[];
  nextQueries: string[];
  overallAssessment: string;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface CritiqueLoopOptions {
  /** Produce a brief/dossier snapshot from current evidence. */
  synthesise: (round: number) => Promise<{
    findings: EntityFindings[];
    briefText: string;
    evidenceCount: number;
  }>;
  /**
   * Critique the snapshot. Inject LLM or use deterministicScorer.
   * Must return a score 0–100 and actionable nextQueries / suggested seeds.
   */
  critique: (input: {
    round: number;
    findings: EntityFindings[];
    briefText: string;
    previousScore: number;
  }) => Promise<CritiqueReport>;
  /** Execute follow-up queries / probes suggested by critique. */
  enrich: (report: CritiqueReport) => Promise<{ newEvidenceCount: number }>;
  maxRounds?: number;
  /** Stop when score gain < epsilon for plateauRounds. */
  plateauEpsilon?: number;
  plateauRounds?: number;
  targetScore?: number;
  onRoundDone?: (report: CritiqueReport) => Promise<void> | void;
}

export interface CritiqueLoopResult {
  rounds: CritiqueReport[];
  finalScore: number;
  stopReason: 'target-reached' | 'plateau' | 'max-rounds' | 'no-new-evidence';
  totalRounds: number;
}

/** Deterministic critique when no LLM is wired — gap-focused, conservative. */
export function deterministicCritique(input: {
  round: number;
  findings: EntityFindings[];
  briefText: string;
  previousScore: number;
}): CritiqueReport {
  const fallback = staticRiskReviewFallback();
  const findings = input.findings;
  const emptyEntities = findings.filter(f => !(f.findings?.length) && (f.keptCount ?? 0) === 0);
  const thinEntities = findings.filter(f => (f.keptCount ?? f.findings?.length ?? 0) < 2);

  const gaps: string[] = [];
  const flags: CritiqueFinding[] = [];
  const nextQueries: string[] = [];

  if (findings.length === 0) {
    gaps.push('No entities under investigation');
    nextQueries.push('Confirm primary seed (email, domain, or username)');
  }

  for (const e of emptyEntities) {
    gaps.push(`No findings for ${e.entity}`);
    flags.push({
      entity: e.entity,
      issue: 'Empty result set',
      severity: 'high',
      recommendation: 'Run passive archive + username/domain probes',
      suggestedSeed: { type: 'username', value: e.entity.replace(/^@/, '') },
    });
    nextQueries.push(`passive footprint for ${e.entity}`);
  }

  for (const e of thinEntities) {
    if (emptyEntities.includes(e)) continue;
    gaps.push(`Sparse evidence for ${e.entity}`);
    flags.push({
      entity: e.entity,
      issue: 'Fewer than two corroborating findings',
      severity: 'medium',
      recommendation: 'Seek second independent source; check web archive',
    });
    nextQueries.push(`archive recovery for ${e.entity}`);
  }

  if (!/\b(alleged|reported|unverified|source)\b/i.test(input.briefText) && input.briefText.length > 80) {
    flags.push({
      entity: '*',
      issue: 'Brief may overstate confidence (missing evidential hedges)',
      severity: 'medium',
      recommendation: 'Rewrite with alleged/reported language and citations',
    });
  }

  const coverage = findings.length === 0 ? 0 : (findings.length - emptyEntities.length) / findings.length;
  const depth =
    findings.reduce((s, f) => s + (f.keptCount ?? f.findings?.length ?? 0), 0) /
    Math.max(findings.length, 1);
  const score = Math.round(
    Math.min(95, coverage * 55 + Math.min(depth, 5) * 8 - flags.filter(f => f.severity === 'high').length * 10),
  );

  return {
    round: input.round,
    score: Math.max(0, score),
    gaps: gaps.length ? gaps : fallback.gaps.length ? [...fallback.gaps] : ['No critical gaps detected'],
    risks: fallback.risks,
    flags,
    nextQueries: nextQueries.slice(0, 8),
    overallAssessment:
      score >= 75
        ? 'Coverage acceptable for a passive lead pack; verify before operational use.'
        : 'Material gaps remain — further passive sweeps recommended.',
    confidenceLevel: score >= 75 ? 'medium' : score >= 50 ? 'low' : 'low',
  };
}

export async function runCritiqueLoop(opts: CritiqueLoopOptions): Promise<CritiqueLoopResult> {
  const maxRounds = opts.maxRounds ?? 5;
  const plateauEpsilon = opts.plateauEpsilon ?? 3;
  const plateauRoundsNeeded = opts.plateauRounds ?? 2;
  const targetScore = opts.targetScore ?? 85;

  const rounds: CritiqueReport[] = [];
  let previousScore = 0;
  let plateauStreak = 0;
  let stopReason: CritiqueLoopResult['stopReason'] = 'max-rounds';

  for (let round = 1; round <= maxRounds; round++) {
    const snap = await opts.synthesise(round);
    const report = await opts.critique({
      round,
      findings: snap.findings,
      briefText: snap.briefText,
      previousScore,
    });
    rounds.push(report);
    if (opts.onRoundDone) await opts.onRoundDone(report);

    if (report.score >= targetScore) {
      stopReason = 'target-reached';
      break;
    }

    const gain = report.score - previousScore;
    if (round > 1 && gain < plateauEpsilon) plateauStreak += 1;
    else plateauStreak = 0;
    previousScore = report.score;

    if (plateauStreak >= plateauRoundsNeeded) {
      stopReason = 'plateau';
      break;
    }

    const { newEvidenceCount } = await opts.enrich(report);
    if (newEvidenceCount <= 0 && report.nextQueries.length === 0) {
      stopReason = 'no-new-evidence';
      break;
    }
  }

  return {
    rounds,
    finalScore: rounds.length ? rounds[rounds.length - 1].score : 0,
    stopReason,
    totalRounds: rounds.length,
  };
}
