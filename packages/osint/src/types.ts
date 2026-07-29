/**
 * Shared OSINT contracts.
 * Sources: spiderfoot-ui shared/{dossier,types}.ts; nexus-backend entity shapes.
 */

export type ScanStatus =
  | 'RUNNING'
  | 'FINISHED'
  | 'ABORTED'
  | 'ERROR-FAILED'
  | 'STARTING'
  | 'STARTED'
  | 'ABORT-REQUESTED';

/** Passive = no direct contact with target. */
export type ScanType = 'All' | 'Footprint' | 'Investigate' | 'Passive';

export const SCAN_TYPE_OPTIONS: ScanType[] = ['All', 'Footprint', 'Investigate', 'Passive'];

export const SCAN_TYPE_DESCRIPTIONS: Record<ScanType, string> = {
  All: 'Run all available modules against the target',
  Footprint: "Map the target's digital footprint and infrastructure",
  Investigate: 'Deep investigation including threat intelligence lookups',
  Passive: 'Passive reconnaissance only — no direct contact with target',
};

export type EntityType =
  | 'person'
  | 'email'
  | 'username'
  | 'domain'
  | 'ip'
  | 'phone'
  | 'location'
  | 'address'
  | 'organisation'
  | 'url'
  | 'crypto'
  | 'unknown';

export interface OsintEntity {
  id: string;
  type: EntityType | string;
  value: string;
  confidence?: number;
  tags?: string[];
  notes?: string;
  firstSeen?: string | null;
  lastSeen?: string | null;
}

export interface DossierSection {
  source: string;
  summary: string;
  riskContribution: number;
  hasFindings: boolean;
  rawData: unknown;
  error?: string | null;
}

export interface DossierRelated {
  id: string | number;
  type: string;
  value: string;
  riskScore: number | null;
  relationshipType: string;
  direction: 'from' | 'to';
}

export interface DossierIndicators {
  breachCount: number;
  malwareCount: number;
  abuseScore: number | null;
  openPorts: number[];
  emails: string[];
  subdomains: string[];
  socialProfiles: string[];
  geolocation: { country?: string; city?: string; lat?: number; lon?: number } | null;
}

export interface DossierTimelineEvent {
  date: string;
  event: string;
  source: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

export interface Dossier {
  entity: OsintEntity & { riskScore?: number | null; enrichmentStatus?: string | null };
  enrichmentStatus: string;
  riskScore: number;
  sections: DossierSection[];
  breaches: DossierSection[];
  infrastructure: DossierSection[];
  reputation: DossierSection[];
  emails: DossierSection[];
  history: DossierSection[];
  related: DossierRelated[];
  timeline: DossierTimelineEvent[];
  indicators: DossierIndicators;
}

export interface PlatformProbe {
  site: string;
  urlTemplate: string;
  category?: string;
}

export interface PlatformHit {
  site: string;
  url: string;
  found: boolean;
  confirmed?: boolean;
}

export interface SocialProfile {
  platform: string;
  url: string;
  username: string;
  displayName?: string;
  bio?: string;
  confirmed: boolean;
}

export const EVIDENTIAL_WARNING =
  'Generated output is analysis/control material, not primary evidence. All leads require verification against primary sources before use.';

export const REPORT_CLASSIFICATION = 'UNCLASSIFIED - OPEN SOURCE LEADS ONLY';
