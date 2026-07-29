export type PolicyEffect = 'allow' | 'deny';

export interface PolicyContext {
  actorId: string;
  roles: string[];
  capability: string;
  action: string;
  environment: 'development' | 'staging' | 'production';
  resourceClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  attributes?: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  description: string;
  priority: number;
  effect: PolicyEffect;
  matches(context: PolicyContext): boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  matchedRuleIds: string[];
  decisiveRuleId?: string;
  reason: string;
}

export class PolicyEngine {
  readonly #rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    const ids = new Set<string>();
    for (const rule of rules) {
      if (ids.has(rule.id)) throw new Error(`Duplicate policy rule: ${rule.id}`);
      ids.add(rule.id);
    }
    this.#rules = [...rules].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  evaluate(context: PolicyContext): PolicyDecision {
    const matched = this.#rules.filter(rule => rule.matches(context));
    const deny = matched.find(rule => rule.effect === 'deny');
    if (deny) return { allowed: false, matchedRuleIds: matched.map(r => r.id), decisiveRuleId: deny.id, reason: deny.description };

    const allow = matched.find(rule => rule.effect === 'allow');
    if (allow) return { allowed: true, matchedRuleIds: matched.map(r => r.id), decisiveRuleId: allow.id, reason: allow.description };

    return { allowed: false, matchedRuleIds: [], reason: 'No allow rule matched; default deny applied.' };
  }
}

export const productionWriteRules = (): PolicyRule[] => [
  {
    id: 'deny-production-write-without-release-manager',
    description: 'Production mutation requires the release-manager role.',
    priority: 100,
    effect: 'deny',
    matches: c => c.environment === 'production' && ['commit', 'promote', 'rollback', 'delete'].includes(c.action) && !c.roles.includes('release-manager'),
  },
  {
    id: 'deny-restricted-export',
    description: 'Restricted data cannot be exported by this policy surface.',
    priority: 90,
    effect: 'deny',
    matches: c => c.action === 'export' && c.resourceClassification === 'restricted',
  },
  {
    id: 'allow-non-production-operator',
    description: 'Migration operators may execute controlled non-production actions.',
    priority: 20,
    effect: 'allow',
    matches: c => c.environment !== 'production' && c.roles.includes('migration-operator'),
  },
  {
    id: 'allow-production-release-manager',
    description: 'Release managers may execute production release actions subject to external evidence gates.',
    priority: 10,
    effect: 'allow',
    matches: c => c.environment === 'production' && c.roles.includes('release-manager'),
  },
];
