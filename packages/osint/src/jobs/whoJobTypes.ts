/** Async WHO job contract — durable via @ocrowley/jobs. */

export const WHO_JOB_TYPE = 'who.lookup' as const;

export const WHO_JOB_STAGES = [
  { id: 'policy', label: 'Authorize case' },
  { id: 'discover', label: 'Run who()' },
  { id: 'dossier', label: 'Write dossier' },
  { id: 'audit', label: 'Append audit' },
] as const;

export type WhoJobStageId = (typeof WHO_JOB_STAGES)[number]['id'];

export interface WhoJobPayload {
  q: string;
  caseRef: string;
  deep?: boolean;
  full?: boolean;
  archive?: boolean;
  at?: string;
  in?: string;
  email?: string;
  username?: string;
  phone?: string;
  aka?: string | string[];
  country?: 'uk' | 'us' | 'other';
  enableCliTools?: boolean;
  actorId?: string;
}

export interface WhoJobResult {
  who: {
    q: string;
    name: string;
    next: string;
    stats: { confirmed: number; likely: number; possible: number; checked: number };
    toolsUsed: string[];
    archiveId?: string;
    recursive?: {
      score: number;
      sweeps: number;
      evidenceCount: number;
      stopReason: string;
    };
  };
  dossierId?: string;
  auditSequence?: number;
  warning: string;
}
