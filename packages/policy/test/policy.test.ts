import { strict as assert } from 'node:assert';
import test from 'node:test';
import { PolicyEngine, productionWriteRules } from '../src/index.ts';

test('production mutation is denied without release-manager role', () => {
  const engine = new PolicyEngine(productionWriteRules());
  const decision = engine.evaluate({
    actorId: 'operator-1', roles: ['migration-operator'], capability: 'evidence-engine', action: 'commit', environment: 'production',
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.decisiveRuleId, 'deny-production-write-without-release-manager');
});

test('release manager receives allow decision but remains subject to external evidence gates', () => {
  const engine = new PolicyEngine(productionWriteRules());
  const decision = engine.evaluate({
    actorId: 'release-1', roles: ['release-manager'], capability: 'writing-engine', action: 'promote', environment: 'production',
  });
  assert.equal(decision.allowed, true);
});

test('restricted export is always denied', () => {
  const engine = new PolicyEngine(productionWriteRules());
  const decision = engine.evaluate({
    actorId: 'release-1', roles: ['release-manager'], capability: 'evidence-engine', action: 'export', environment: 'production', resourceClassification: 'restricted',
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.decisiveRuleId, 'deny-restricted-export');
});
