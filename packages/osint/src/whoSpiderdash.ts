/**
 * Map who() results → SpiderDash / Intel Hub import payload.
 * Bridges only — does not vendor SpiderDash or BigBrother.
 */

import type { WhoHit, WhoResult } from './who.js';
import type { SpiderdashEntity } from './spiderdashBridge.js';
import { resolveSpiderdashUrl } from './bridgeDefaults.js';

function confidenceScore(c: WhoHit['confidence']): number {
  if (c === 'confirmed') return 92;
  if (c === 'likely') return 72;
  return 48;
}

function hitType(hit: WhoHit): string {
  if (hit.kind === 'profile') return 'username';
  if (hit.kind === 'email' || hit.kind === 'gravatar' || hit.kind === 'breach') return 'email';
  if (hit.kind === 'record') return 'organisation';
  if (hit.kind === 'darkweb') return 'url';
  if (hit.kind === 'archive') return 'url';
  return 'unknown';
}

export function whoHitsToEntities(result: WhoResult): SpiderdashEntity[] {
  const entities: SpiderdashEntity[] = [
    {
      type: 'person',
      value: result.name,
      tags: ['who', `q:${result.q}`],
      notes: `${result.stats.confirmed} confirmed / ${result.stats.likely} likely / ${result.stats.possible} possible`,
      riskScore: Math.min(99, 40 + result.stats.confirmed * 8 + result.stats.likely * 3),
      source: 'ocrowley-recursive-osint',
      evidenceKeys: result.hits.slice(0, 12).map((h, i) => `who:${i}:${h.kind}`),
    },
  ];

  for (const [i, hit] of result.hits.entries()) {
    entities.push({
      type: hitType(hit),
      value: hit.url || hit.title,
      tags: ['who', hit.kind, hit.confidence],
      notes: hit.detail,
      riskScore: confidenceScore(hit.confidence),
      source: 'ocrowley-recursive-osint',
      evidenceKeys: [`who:${i}:${hit.kind}`],
    });
  }

  return entities;
}

export function whoToSpiderdashImport(result: WhoResult): {
  entities: SpiderdashEntity[];
  next: string;
  brief: { title: string; summary: string; warning: string };
  defaultUrl: string;
} {
  return {
    entities: whoHitsToEntities(result),
    next: result.next,
    brief: {
      title: `WHO: ${result.name}`,
      summary: result.text.split('\n').slice(0, 6).join('\n'),
      warning: result.warning,
    },
    defaultUrl: resolveSpiderdashUrl(),
  };
}
