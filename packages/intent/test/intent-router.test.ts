import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectRequestedAction, routeCaspaIntent } from '../src/intent-router.ts';

describe('@ocrowley/intent', () => {
  it('detects write chapter action', () => {
    assert.equal(detectRequestedAction('write the next chapter'), 'WRITE_CHAPTER');
  });

  it('blocks plan output unless explicitly requested', () => {
    const decision = routeCaspaIntent('Once upon a time...', 'write a scene');
    assert.equal(decision.shouldBlockPlan, true);
    assert.equal(decision.outputMode, 'write');
  });

  it('allows plan when asked', () => {
    const decision = routeCaspaIntent('', 'make an outline');
    assert.equal(decision.requestedAction, 'MAKE_PLAN');
    assert.equal(decision.shouldBlockPlan, false);
  });
});
