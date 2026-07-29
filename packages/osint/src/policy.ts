/**
 * Lawful-use authorization gates for OSINT actions.
 * Default deny; Passive scan type preferred for unattended jobs.
 */

import { PolicyEngine, type PolicyContext, type PolicyDecision, type PolicyRule } from '@ocrowley/policy';
import type { ScanType } from './types.js';

export type OsintAction =
  | 'scan.passive'
  | 'scan.footprint'
  | 'scan.investigate'
  | 'probe.username'
  | 'enrich.person'
  | 'brief.export'
  | 'archive.recover';

export interface OsintAuthorization {
  actorId: string;
  roles: string[];
  /** Explicit case / warrant / instruction reference. */
  authorizationRef: string;
  purpose: string;
  environment?: PolicyContext['environment'];
  scanType?: ScanType;
  resourceClassification?: PolicyContext['resourceClassification'];
}

export function osintPolicyRules(): PolicyRule[] {
  return [
    {
      id: 'deny-missing-authorization-ref',
      description: 'OSINT actions require a non-empty authorization reference.',
      priority: 100,
      effect: 'deny',
      matches: c => !String(c.attributes?.authorizationRef ?? '').trim(),
    },
    {
      id: 'deny-investigate-without-investigator',
      description: 'Investigate-mode OSINT requires investigator or counsel role.',
      priority: 90,
      effect: 'deny',
      matches: c =>
        (c.action === 'scan.investigate' || c.action === 'enrich.person') &&
        !c.roles.some(r => ['investigator', 'counsel', 'osint-operator'].includes(r)),
    },
    {
      id: 'deny-production-probe-without-operator',
      description: 'Production live probes require osint-operator role.',
      priority: 80,
      effect: 'deny',
      matches: c =>
        c.environment === 'production' &&
        ['probe.username', 'scan.footprint', 'scan.investigate'].includes(c.action) &&
        !c.roles.includes('osint-operator'),
    },
    {
      id: 'allow-passive-with-auth-ref',
      description: 'Passive OSINT allowed when authorization reference is present.',
      priority: 20,
      effect: 'allow',
      matches: c =>
        ['scan.passive', 'brief.export', 'archive.recover'].includes(c.action) &&
        Boolean(String(c.attributes?.authorizationRef ?? '').trim()),
    },
    {
      id: 'allow-operator-active-scans',
      description: 'Authorized osint-operators may run footprint/investigate scans.',
      priority: 10,
      effect: 'allow',
      matches: c =>
        c.roles.some(r => ['osint-operator', 'investigator', 'counsel'].includes(r)) &&
        Boolean(String(c.attributes?.authorizationRef ?? '').trim()),
    },
  ];
}

export function evaluateOsintPolicy(action: OsintAction, auth: OsintAuthorization): PolicyDecision {
  const engine = new PolicyEngine(osintPolicyRules());
  const context: PolicyContext = {
    actorId: auth.actorId,
    roles: auth.roles,
    capability: 'osint',
    action,
    environment: auth.environment ?? 'development',
    resourceClassification: auth.resourceClassification ?? 'confidential',
    attributes: {
      authorizationRef: auth.authorizationRef,
      purpose: auth.purpose,
      scanType: auth.scanType,
    },
  };
  return engine.evaluate(context);
}

export function assertOsintAllowed(action: OsintAction, auth: OsintAuthorization): void {
  const decision = evaluateOsintPolicy(action, auth);
  if (!decision.allowed) {
    throw new Error(`OSINT policy denied ${action}: ${decision.reason}`);
  }
}
