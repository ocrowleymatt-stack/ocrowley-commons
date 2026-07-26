/**
 * Recursive OSINT engine — discovery loop then critique/improve loop.
 *
 * By default uses the full toolkit (platforms, archive, darkweb, bridges, CLIs).
 * Pass discover/enrichFromCritique to override.
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
import {
  createFullDiscover,
  createFullEnrich,
  reportToolkitAvailability,
  type ToolkitOptions,
} from './toolkit.js';
import type { DarkwebAuthorization } from '@ocrowley/darkweb';

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
  /** Optional override. Default: full toolkit discover. */
  discover?: (seeds: RefinementSeed[], sweepNumber: number) => Promise<SweepResult<OsintEvidenceItem>>;
  extractSeeds?: (items: OsintEvidenceItem[], existing: RefinementSeed[]) => Promise<RefinementSeed[]>;
  critique?: (input: {
    round: number;
    findings: EntityFindings[];
    briefText: string;
    previousScore: number;
  }) => Promise<CritiqueReport>;
  enrichFromCritique?: (
    report: CritiqueReport,
    ctx: { seeds: RefinementSeed[]; evidence: OsintEvidenceItem[] },
  ) => Promise<OsintEvidenceItem[]>;
  /** Toolkit configuration when using defaults. */
  toolkit?: Omit<ToolkitOptions, 'auth'> & { darkwebAuth?: DarkwebAuthorization };
  /** When true (default), wire full toolkit for discover/enrich if not overridden. */
  useFullToolkit?: boolean;
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
  tools: ReturnType<typeof reportToolkitAvailability>;
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
    if (item.entity === '*') continue;
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

  const toolkitOpts: ToolkitOptions = {
    auth: opts.auth,
    ...opts.toolkit,
  };
  const useToolkit = opts.useFullToolkit !== false;
  const discover =
    opts.discover ??
    (useToolkit
      ? createFullDiscover(toolkitOpts)
      : async () => ({ items: [], itemKeys: [], discoveredSeeds: [] }));
  const enrichFromCritique =
    opts.enrichFromCritique ?? (useToolkit ? createFullEnrich(toolkitOpts) : undefined);

  const tools = reportToolkitAvailability(toolkitOpts);
  const evidenceStore: OsintEvidenceItem[] = [];
  const evidenceKeys = new Set<string>();

  const discovery = await runRefinementLoop<OsintEvidenceItem>({
    initialSeeds: opts.initialSeeds,
    maxSweeps: opts.maxDiscoverSweeps ?? 6,
    queryFn: async (seeds, sweepNumber) => {
      const result = await discover(seeds, sweepNumber);
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
      if (!enrichFromCritique) return { newEvidenceCount: 0 };
      const added = await enrichFromCritique(report, {
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
    tools,
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
