import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PSYCHOLOGY_LIBRARY, selectPsychTechniques, CRAFT_LIBRARY, ACCURACY_LIBRARY } from '../src/libraries.ts';

describe('@ocrowley/coherence', () => {
  it('has psychology techniques', () => {
    assert.ok(PSYCHOLOGY_LIBRARY.length > 5);
  });
  it('selects techniques for a function', () => {
    const picked = selectPsychTechniques('confrontation', 'literary thriller');
    assert.ok(Array.isArray(picked));
  });
  it('has craft and accuracy libraries', () => {
    assert.ok(CRAFT_LIBRARY.length > 0);
    assert.ok(ACCURACY_LIBRARY.length > 0);
  });
});
