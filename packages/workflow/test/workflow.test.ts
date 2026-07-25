import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowState, completeStep, suggestNextStep } from '../src/projectWorkflowService.ts';
import { nextMinimalStep } from '../src/minimalPath.ts';

describe('@ocrowley/workflow', () => {
  it('guides from intake to draft', () => {
    let state = createWorkflowState('p1');
    assert.equal(suggestNextStep(state).id, 'intake');
    state = completeStep(state, 'intake');
    assert.equal(state.currentStep, 'plan');
  });

  it('minimal path advances', () => {
    assert.equal(nextMinimalStep(['seed']).id, 'spine');
  });
});
