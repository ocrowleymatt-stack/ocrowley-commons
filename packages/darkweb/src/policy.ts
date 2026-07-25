/**
 * Authorization gates for dark-web index / breach queries.
 */

import { PolicyEngine, type PolicyContext, type PolicyDecision, type PolicyRule } from '@ocrowley/policy';

export type DarkwebAction = 'monitor.entities' | 'search.ahmia' | 'breach.check' | 'intelx.search';

export interface DarkwebAuthorization {
  actorId: string;
  roles: string[];
  authorizationRef: string;
  purpose: string;
  environment?: PolicyContext['environment'];
  /** Explicit acknowledgement that query is lawful and proportionate. */
  lawfulUseAcknowledged: boolean;
}

export function darkwebPolicyRules(): PolicyRule[] {
  return [
    {
      id: 'deny-missing-authorization-ref',
      description: 'Dark-web / breach queries require a non-empty authorization reference.',
      priority: 100,
      effect: 'deny',
      matches: c => !String(c.attributes?.authorizationRef ?? '').trim(),
    },
    {
      id: 'deny-without-lawful-use-ack',
      description: 'Caller must acknowledge lawful, proportionate use.',
      priority: 95,
      effect: 'deny',
      matches: c => c.attributes?.lawfulUseAcknowledged !== true,
    },
    {
      id: 'deny-without-operator-role',
      description: 'Requires osint-operator, investigator, or counsel role.',
      priority: 90,
      effect: 'deny',
      matches: c => !c.roles.some(r => ['osint-operator', 'investigator', 'counsel'].includes(r)),
    },
    {
      id: 'allow-authorized-monitor',
      description: 'Authorized operators may run clearnet index and breach checks.',
      priority: 10,
      effect: 'allow',
      matches: c =>
        Boolean(String(c.attributes?.authorizationRef ?? '').trim()) &&
        c.attributes?.lawfulUseAcknowledged === true &&
        c.roles.some(r => ['osint-operator', 'investigator', 'counsel'].includes(r)),
    },
  ];
}

export function evaluateDarkwebPolicy(action: DarkwebAction, auth: DarkwebAuthorization): PolicyDecision {
  const engine = new PolicyEngine(darkwebPolicyRules());
  const context: PolicyContext = {
    actorId: auth.actorId,
    roles: auth.roles,
    capability: 'darkweb',
    action,
    environment: auth.environment ?? 'development',
    resourceClassification: 'restricted',
    attributes: {
      authorizationRef: auth.authorizationRef,
      purpose: auth.purpose,
      lawfulUseAcknowledged: auth.lawfulUseAcknowledged,
    },
  };
  return engine.evaluate(context);
}

export function assertDarkwebAllowed(action: DarkwebAction, auth: DarkwebAuthorization): void {
  const decision = evaluateDarkwebPolicy(action, auth);
  if (!decision.allowed) {
    throw new Error(`Darkweb policy denied ${action}: ${decision.reason}`);
  }
}
