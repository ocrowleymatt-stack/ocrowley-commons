/**
 * Iterative seed-expansion loop.
 * Source: spiderfoot-ui server/refinementLoop.ts (portable; LLM optional via inject).
 */

export type ConvergenceReason =
  | 'no-new-refinements'
  | 'diminishing-returns'
  | 'max-sweeps'
  | 'llm-converged'
  | 'budget-exhausted'
  | 'policy-denied'
  | 'error';

export interface RefinementSeed {
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface SweepResult<TRaw = unknown> {
  items: TRaw[];
  itemKeys: string[];
  discoveredSeeds: RefinementSeed[];
}

export interface SweepSummary<TRaw = unknown> {
  sweepNumber: number;
  seeds: RefinementSeed[];
  result: SweepResult<TRaw>;
  newSeedsCount: number;
  overlapRatio: number;
  converged: boolean;
  convergenceReason?: ConvergenceReason;
  durationMs: number;
}

export interface RefinementLoopOptions<TRaw = unknown> {
  initialSeeds: RefinementSeed[];
  queryFn: (seeds: RefinementSeed[], sweepNumber: number) => Promise<SweepResult<TRaw>>;
  extractFn?: (items: TRaw[], existingSeeds: RefinementSeed[]) => Promise<RefinementSeed[]>;
  onSweepDone?: (summary: SweepSummary<TRaw>) => Promise<void> | void;
  maxSweeps?: number;
  overlapThreshold?: number;
  minSeedConfidence?: number;
  /** Soft cap on total unique item keys accumulated. */
  maxItems?: number;
}

export interface RefinementLoopResult<TRaw = unknown> {
  sweeps: SweepSummary<TRaw>[];
  allItems: TRaw[];
  allSeeds: RefinementSeed[];
  convergenceReason: ConvergenceReason;
  totalSweeps: number;
  totalDurationMs: number;
}

export function seedKey(seed: RefinementSeed): string {
  return `${seed.type}:${seed.value.toLowerCase().trim()}`;
}

export function dedupeSeeds(seeds: RefinementSeed[]): RefinementSeed[] {
  const seen = new Set<string>();
  return seeds.filter(s => {
    const key = seedKey(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function overlapRatio(prevKeys: Set<string>, newKeys: string[]): number {
  if (newKeys.length === 0) return 1;
  const overlap = newKeys.filter(k => prevKeys.has(k)).length;
  return overlap / newKeys.length;
}

export async function runRefinementLoop<TRaw = unknown>(
  opts: RefinementLoopOptions<TRaw>,
): Promise<RefinementLoopResult<TRaw>> {
  const {
    initialSeeds,
    queryFn,
    extractFn,
    onSweepDone,
    maxSweeps = 8,
    overlapThreshold = 0.85,
    minSeedConfidence = 60,
    maxItems = 500,
  } = opts;

  const sweeps: SweepSummary<TRaw>[] = [];
  const allItemsMap = new Map<string, TRaw>();
  const allSeeds: RefinementSeed[] = dedupeSeeds(initialSeeds);
  const activeSeeds: RefinementSeed[] = [...allSeeds];
  const usedSeedKeys = new Set<string>(allSeeds.map(seedKey));
  const prevItemKeys = new Set<string>();

  let convergenceReason: ConvergenceReason = 'max-sweeps';
  const loopStart = Date.now();

  for (let sweep = 1; sweep <= maxSweeps; sweep++) {
    const sweepStart = Date.now();
    let result: SweepResult<TRaw>;
    try {
      result = await queryFn([...activeSeeds], sweep);
    } catch {
      convergenceReason = 'error';
      break;
    }

    for (let i = 0; i < result.items.length; i++) {
      const key = result.itemKeys[i] ?? `${sweep}-${i}`;
      if (!allItemsMap.has(key)) allItemsMap.set(key, result.items[i]);
    }

    if (allItemsMap.size >= maxItems) {
      const summary: SweepSummary<TRaw> = {
        sweepNumber: sweep,
        seeds: [...activeSeeds],
        result,
        newSeedsCount: 0,
        overlapRatio: overlapRatio(prevItemKeys, result.itemKeys),
        converged: true,
        convergenceReason: 'budget-exhausted',
        durationMs: Date.now() - sweepStart,
      };
      sweeps.push(summary);
      if (onSweepDone) await onSweepDone(summary);
      convergenceReason = 'budget-exhausted';
      break;
    }

    const overlap = overlapRatio(prevItemKeys, result.itemKeys);
    result.itemKeys.forEach(k => prevItemKeys.add(k));

    let newSeeds: RefinementSeed[] =
      result.discoveredSeeds.length > 0
        ? result.discoveredSeeds
        : extractFn
          ? await extractFn(result.items, allSeeds)
          : [];

    const filteredNew = dedupeSeeds(
      newSeeds.filter(s => {
        if (s.confidence < minSeedConfidence) return false;
        return !usedSeedKeys.has(seedKey(s));
      }),
    );

    for (const s of filteredNew) {
      usedSeedKeys.add(seedKey(s));
      activeSeeds.push(s);
      allSeeds.push(s);
    }

    let converged = false;
    let reason: ConvergenceReason | undefined;
    if (filteredNew.length === 0) {
      converged = true;
      reason = 'no-new-refinements';
    } else if (overlap >= overlapThreshold && sweep > 1) {
      converged = true;
      reason = 'diminishing-returns';
    }

    const summary: SweepSummary<TRaw> = {
      sweepNumber: sweep,
      seeds: [...activeSeeds],
      result,
      newSeedsCount: filteredNew.length,
      overlapRatio: overlap,
      converged,
      convergenceReason: reason,
      durationMs: Date.now() - sweepStart,
    };
    sweeps.push(summary);
    if (onSweepDone) await onSweepDone(summary);

    if (converged) {
      convergenceReason = reason!;
      break;
    }
    if (sweep === maxSweeps) convergenceReason = 'max-sweeps';
  }

  return {
    sweeps,
    allItems: Array.from(allItemsMap.values()),
    allSeeds,
    convergenceReason,
    totalSweeps: sweeps.length,
    totalDurationMs: Date.now() - loopStart,
  };
}
