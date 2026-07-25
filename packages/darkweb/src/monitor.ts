/**
 * Dark-web entity monitor orchestration.
 * Source: nexus-backend services/darkWebService.js (scrubbed; no hardcoded keys).
 */

import { searchAhmia } from './ahmia.js';
import { assertDarkwebAllowed, type DarkwebAuthorization } from './policy.js';
import {
  createHibpProvider,
  stubBreachProvider,
  stubDarkWebSearchProvider,
  type BreachProvider,
  type DarkWebSearchProvider,
} from './providers.js';
import type { DarkWebEntityInput, DarkWebEntityResult, DarkWebMonitorReport } from './types.js';

export interface MonitorOptions {
  auth: DarkwebAuthorization;
  searchProvider?: DarkWebSearchProvider;
  breachProvider?: BreachProvider;
  entityLimit?: number;
  highRiskThreshold?: number;
  /** Optional AI summariser injected by host. */
  summarise?: (report: Omit<DarkWebMonitorReport, 'aiSummary'>) => Promise<string>;
}

export function riskBand(totalMentions: number): 'none' | 'low' | 'medium' | 'high' {
  if (totalMentions <= 0) return 'none';
  if (totalMentions <= 1) return 'low';
  if (totalMentions <= 3) return 'medium';
  return 'high';
}

export async function monitorDarkWeb(
  entities: DarkWebEntityInput[] | string[],
  options: MonitorOptions,
): Promise<DarkWebMonitorReport> {
  assertDarkwebAllowed('monitor.entities', options.auth);

  const searchProvider =
    options.searchProvider ??
    ({
      id: 'ahmia',
      search: (q: string) => searchAhmia(q),
    } satisfies DarkWebSearchProvider);

  const breachProvider = options.breachProvider ?? createHibpProvider();
  const limit = options.entityLimit ?? 5;
  const threshold = options.highRiskThreshold ?? 3;

  const normalised: DarkWebEntityInput[] = entities.map(e =>
    typeof e === 'string' ? { value: e, type: e.includes('@') ? 'email' : 'unknown' } : e,
  );

  const results: DarkWebEntityResult[] = [];
  for (const entity of normalised.slice(0, limit)) {
    const value = entity.value;
    const type = entity.type ?? (value.includes('@') ? 'email' : 'unknown');
    const darkWebMentions = await searchProvider.search(value);
    const breachData =
      type === 'email' || value.includes('@') ? await breachProvider.check(value) : [];

    results.push({
      entity: value,
      type,
      darkWebMentions,
      breachData,
      totalMentions: darkWebMentions.length + breachData.length,
    });
  }

  const totalMentionsFound = results.reduce((sum, r) => sum + r.totalMentions, 0);
  const base: Omit<DarkWebMonitorReport, 'aiSummary'> = {
    results,
    totalEntitiesChecked: normalised.length,
    totalMentionsFound,
    highRiskEntities: results.filter(r => r.totalMentions > threshold),
    checkedAt: new Date().toISOString(),
    available: true,
  };

  let aiSummary: string | undefined;
  if (options.summarise && totalMentionsFound > 0) {
    try {
      aiSummary = await options.summarise(base);
    } catch {
      aiSummary = undefined;
    }
  }

  return { ...base, aiSummary };
}

/** Honest unavailable report when host has not configured providers. */
export function unavailableMonitorReport(entityCount = 0): DarkWebMonitorReport {
  return {
    results: [],
    totalEntitiesChecked: entityCount,
    totalMentionsFound: 0,
    highRiskEntities: [],
    checkedAt: new Date().toISOString(),
    available: false,
    reason: 'darkweb_search_unavailable',
  };
}

export { stubBreachProvider, stubDarkWebSearchProvider };
