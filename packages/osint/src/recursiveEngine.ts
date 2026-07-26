/**
 * Recursive OSINT engine — discovery loop then critique/improve loop.
 *
 * Phase A (discover): expand seeds until convergence.
 * Phase B (improve): synthesise → critique → enrich until score plateaus.
 *
 * Hosts inject query/enrich adapters (platform probes, archive, darkweb, SpiderFoot).
 * Policy is enforced up front; no self-escalation of permissions.
 */

import { assertOsintAllowed, type OsintAuthorization } from './policy.js';
import {
  deterministicCritique,
  runCritiqueLoop,
  type CritiqueLoopResult,
  type CritiqueReport,
} from './critiqueLoop.js';
import type { EntityFindings } from './prompts.js';
import {
  runRefinementLoop,
  type RefinementLoopResult,
  type RefinementSeed,
  type SweepResult,
} from './refinementLoop.js';
import { extractSeedsFromItems } from './seedExtract.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION } from './types.js';

export interface OsintEvidenceItem {
  key: string;
  entity: string;
  title: string;
  source: string;
  snippet: string;
  url?: string;
  score?: number;
}

export interface RecursiveOsintOptions {
  auth: OsintAuthorization;
  initialSeeds: RefinementSeed[];
  /**
   * One discovery sweep. Should be passive-first unless auth allows investigate.
   * Return itemKeys stable for overlap detection.
   */
  discover: (seeds: RefinementSeed[], sweepNumber: number) => Promise<SweepResult<OsintEvidenceItem>>;
  /** Optional LLM seed extractor; default uses deterministic regex extract. */
  extractSeeds?: (items: OsintEvidenceItem[], existing: RefinementSeed[]) => Promise<RefinementSeed[]>;
  /** Optional LLM critique; default uses deterministicCritique. */
  critique?: (input: {
    round: number;
    findings: EntityFindings[];
    briefText: string;
    previousScore: number;
  }) => Promise<CritiqueReport>;
  /**
   * Run critique follow-ups. Default no-op (score-only improve path).
   * Return how many new evidence items were added to the shared store.
   */
  enrichFromCritique?: (
    report: CritiqueReport,
    ctx: { seeds: RefinementSeed[]; evidence: OsintEvidenceItem[] },
  ) => Promise<OsintEvidenceItem[]>;
  maxDiscoverSweeps?: number;
  maxCritiqueRounds?: number;
  targetScore?: number;
  onProgress?: (event: RecursiveOsintProgress) => void;
}

export type RecursiveOsintProgress =
  | { phase: 'discover'; sweep: number; newSeeds: number; reason?: string }
  | { phase: 'critique'; round: number; score: number }
  | { phase: 'done'; reason: string };

export interface RecursiveOsintResult {
  discovery: RefinementLoopResult<OsintEvidenceItem>;
  critique: CritiqueLoopResult;
  evidence: OsintEvidenceItem[];
  seeds: RefinementSeed[];
  findings: EntityFindings[];
  brief: {
    title: string;
    classification: string;
    executiveSummary: string;
    evidentialWarning: string;
    score: number;
    stopReason: string;
  };
}

function toFindings(evidence: OsintEvidenceItem[], seeds: RefinementSeed[]): EntityFindings[] {
  const byEntity = new Map<string, OsintEvidenceItem[]>();
  for (const seed of seeds) {
    if (!byEntity.has(seed.value)) byEntity.set(seed.value, []);
  }
  for (const item of evidence) {
    const list = byEntity.get(item.entity) ?? [];
    list.push(item);
    byEntity.set(item.entity, list);
  }
  return [...byEntity.entries()].map(([entity, items]) => ({
    entity,
    keptCount: items.length,
    rejectedCount: 0,
    queryCount: items.length,
    findings: items.map(i => ({
      title: i.title,
      source: i.source,
      snippet: i.snippet,
      relevance: { score: i.score ?? 50, grade: (i.score ?? 50) >= 70 ? 'A' : 'B' },
    })),
  }));
}

function synthesiseBrief(findings: EntityFindings[], score: number, discoveryReason: string): string {
  const lines = findings.map(f => {
    const top = (f.findings ?? []).slice(0, 3).map(x => `- ${x.title} (${x.source})`).join('\n');
    return `### ${f.entity}\nKept: ${f.keptCount ?? 0}\n${top}`;
  });
  return [
    `Classification: ${REPORT_CLASSIFICATION}`,
    `Working score: ${score}`,
    `Discovery stopped: ${discoveryReason}`,
    '',
    ...lines,
    '',
    EVIDENTIAL_WARNING,
  ].join('\n');
}

export async function runRecursiveOsint(opts: RecursiveOsintOptions): Promise<RecursiveOsintResult> {
  assertOsintAllowed('scan.passive', opts.auth);

  const evidenceStore: OsintEvidenceItem[] = [];
  const evidenceKeys = new Set<string>();

  const discovery = await runRefinementLoop<OsintEvidenceItem>({
    initialSeeds: opts.initialSeeds,
    maxSweeps: opts.maxDiscoverSweeps ?? 6,
    queryFn: async (seeds, sweepNumber) => {
      const result = await opts.discover(seeds, sweepNumber);
      for (const item of result.items) {
        if (!evidenceKeys.has(item.key)) {
          evidenceKeys.add(item.key);
          evidenceStore.push(item);
        }
      }
      return result;
    },
    extractFn: async (items, existing) => {
      if (opts.extractSeeds) return opts.extractSeeds(items, existing);
      return extractSeedsFromItems(items, existing);
    },
    onSweepDone: summary => {
      opts.onProgress?.({
        phase: 'discover',
        sweep: summary.sweepNumber,
        newSeeds: summary.newSeedsCount,
        reason: summary.convergenceReason,
      });
    },
  });

  const critique = await runCritiqueLoop({
    maxRounds: opts.maxCritiqueRounds ?? 4,
    targetScore: opts.targetScore ?? 80,
    synthesise: async () => {
      const findings = toFindings(evidenceStore, discovery.allSeeds);
      return {
        findings,
        briefText: synthesiseBrief(findings, 0, discovery.convergenceReason),
        evidenceCount: evidenceStore.length,
      };
    },
    critique: async input => {
      const report = opts.critique ? await opts.critique(input) : deterministicCritique(input);
      opts.onProgress?.({ phase: 'critique', round: report.round, score: report.score });
      return report;
    },
    enrich: async report => {
      if (!opts.enrichFromCritique) return { newEvidenceCount: 0 };
      const added = await opts.enrichFromCritique(report, {
        seeds: discovery.allSeeds,
        evidence: evidenceStore,
      });
      let n = 0;
      for (const item of added) {
        if (!evidenceKeys.has(item.key)) {
          evidenceKeys.add(item.key);
          evidenceStore.push(item);
          n += 1;
        }
      }
      return { newEvidenceCount: n };
    },
  });

  const findings = toFindings(evidenceStore, discovery.allSeeds);
  const finalScore = critique.finalScore;
  const briefText = synthesiseBrief(findings, finalScore, discovery.convergenceReason);

  opts.onProgress?.({
    phase: 'done',
    reason: `${discovery.convergenceReason}+${critique.stopReason}`,
  });

  return {
    discovery,
    critique,
    evidence: evidenceStore,
    seeds: discovery.allSeeds,
    findings,
    brief: {
      title: 'Recursive OSINT Lead Pack',
      classification: REPORT_CLASSIFICATION,
      executiveSummary: briefText.split('\n').slice(0, 12).join(' '),
      evidentialWarning: EVIDENTIAL_WARNING,
      score: finalScore,
      stopReason: `${discovery.convergenceReason} / ${critique.stopReason}`,
    },
  };
}
