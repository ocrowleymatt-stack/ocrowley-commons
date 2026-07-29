/**
 * Exact-match entity dedup (AI-free pre-filter).
 * Source: nexus-backend services/intelligenceService.js detectDuplicates JS path.
 */

import { normalizeEntityValue } from './normalize.js';
import type { OsintEntity } from './types.js';

export interface DuplicateGroup {
  canonical: string;
  type: string;
  members: string[];
  memberEntities: OsintEntity[];
  confidence: number;
  reason: string;
}

export interface DedupResult {
  groups: DuplicateGroup[];
  ungrouped: OsintEntity[];
  stats: { total: number; duplicateGroups: number; savings: number };
}

export function detectExactDuplicates(entities: OsintEntity[]): DedupResult {
  if (!entities.length) {
    return { groups: [], ungrouped: [], stats: { total: 0, duplicateGroups: 0, savings: 0 } };
  }

  const normalised = entities.map(e => ({
    ...e,
    norm: normalizeEntityValue(e.value),
  }));

  const map = new Map<string, typeof normalised>();
  for (const e of normalised) {
    const key = `${e.type}::${e.norm}`;
    const bucket = map.get(key) ?? [];
    bucket.push(e);
    map.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];
  const groupedIds = new Set<string>();

  for (const bucket of map.values()) {
    if (bucket.length < 2) continue;
    const canonical = bucket.reduce((best, e) => (e.value.length > best.value.length ? e : best), bucket[0]).value;
    for (const e of bucket) groupedIds.add(e.id);
    groups.push({
      canonical,
      type: bucket[0].type,
      members: bucket.map(e => e.id),
      memberEntities: bucket.map(({ norm: _n, ...rest }) => rest),
      confidence: 99,
      reason: 'Exact duplicate (identical normalised value)',
    });
  }

  const ungrouped = entities.filter(e => !groupedIds.has(e.id));
  const savings = groups.reduce((acc, g) => acc + (g.members.length - 1), 0);

  return {
    groups,
    ungrouped,
    stats: { total: entities.length, duplicateGroups: groups.length, savings },
  };
}
