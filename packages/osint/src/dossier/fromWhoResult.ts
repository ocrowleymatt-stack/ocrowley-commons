import { createHash } from 'node:crypto';
import type { WhoResult } from '../who.js';
import type {
  Dossier,
  DossierIndicators,
  DossierSection,
  DossierTimelineEvent,
  OsintEntity,
} from '../types.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION } from '../types.js';

/** Stable entity id from case + primary name/query. */
export function dossierEntityId(caseRef: string, name: string, q: string): string {
  const material = `${caseRef.trim().toLowerCase()}|${(name || q).trim().toLowerCase()}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 24);
}

export function sanitizeCasePath(caseRef: string): string {
  const cleaned = caseRef.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'case';
}

/** Map a WhoResult into the shared Dossier contract (leads only). */
export function dossierFromWhoResult(
  result: WhoResult,
  caseRef: string,
): Dossier & { caseRef: string; classification: string; warning: string; sourceJob?: string } {
  const entityValue = result.name || result.q;
  const entity: OsintEntity & { riskScore?: number | null; enrichmentStatus?: string | null } = {
    id: dossierEntityId(caseRef, result.name, result.q),
    type: 'person',
    value: entityValue,
    confidence: result.stats.confirmed > 0 ? 0.8 : 0.4,
    tags: ['who', 'people-osint'],
    notes: `Case ${caseRef}. ${EVIDENTIAL_WARNING}`,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    enrichmentStatus: 'who-complete',
    riskScore: null,
  };

  const profileHits = result.hits.filter((h) => h.kind === 'profile' && h.url);
  const breachHits = result.hits.filter((h) => h.kind === 'breach' || h.kind === 'darkweb');
  const archiveHits = result.hits.filter((h) => h.kind === 'archive');

  const sections: DossierSection[] = [
    {
      source: 'who',
      summary: `${result.stats.confirmed} confirmed · ${result.stats.likely} likely · ${result.stats.checked} checked`,
      riskContribution: 0,
      hasFindings: result.hits.length > 0,
      rawData: {
        next: result.next,
        toolsUsed: result.toolsUsed,
        recursive: result.recursive,
        open: result.open.slice(0, 20),
      },
    },
  ];

  if (profileHits.length) {
    sections.push({
      source: 'platform-probe',
      summary: `${profileHits.length} profile leads`,
      riskContribution: 0,
      hasFindings: true,
      rawData: profileHits.slice(0, 100),
    });
  }

  const breaches: DossierSection[] = breachHits.length
    ? [
        {
          source: 'breach-or-darkweb-index',
          summary: `${breachHits.length} index leads (not evidence)`,
          riskContribution: 0,
          hasFindings: true,
          rawData: breachHits.slice(0, 50),
        },
      ]
    : [];

  const history: DossierSection[] = archiveHits.length
    ? [
        {
          source: 'wayback',
          summary: `${archiveHits.length} archive leads`,
          riskContribution: 0,
          hasFindings: true,
          rawData: archiveHits.slice(0, 50),
        },
      ]
    : [];

  const timeline: DossierTimelineEvent[] = [
    {
      date: new Date().toISOString(),
      event: `WHO lookup for ${entityValue}`,
      source: 'who',
      severity: 'info',
    },
  ];

  const indicators: DossierIndicators = {
    breachCount: breachHits.length,
    malwareCount: 0,
    abuseScore: null,
    openPorts: [],
    emails: result.hits.filter((h) => h.kind === 'email').map((h) => h.title).slice(0, 50),
    subdomains: [],
    socialProfiles: profileHits.map((h) => h.url!).filter(Boolean).slice(0, 100),
    geolocation: null,
  };

  return {
    caseRef,
    classification: REPORT_CLASSIFICATION,
    warning: result.warning || EVIDENTIAL_WARNING,
    entity,
    enrichmentStatus: 'who-complete',
    riskScore: 0,
    sections,
    breaches,
    infrastructure: [],
    reputation: [],
    emails: [],
    history,
    related: profileHits.slice(0, 40).map((h, i) => ({
      id: `${entity.id}-rel-${i}`,
      type: 'url',
      value: h.url || h.title,
      riskScore: null,
      relationshipType: h.kind,
      direction: 'from' as const,
    })),
    timeline,
    indicators,
  };
}
