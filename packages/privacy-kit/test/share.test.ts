import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shareCategories } from '../src/shareEngine.ts';
import { buildRealityCheckResponse } from '../src/reasoningEngine.ts';
import { ENHANCEMENT_LIMITS } from '../src/enhancementLimits.ts';

describe('@ocrowley/privacy-kit', () => {
  it('defaults sensitive categories off', () => {
    const audio = shareCategories.find((c) => c.id === 'audioClips' || c.sensitivity === 'high');
    assert.ok(shareCategories.length > 0);
    const high = shareCategories.filter((c) => c.sensitivity === 'high');
    assert.ok(high.every((c) => c.defaultEnabled === false));
  });

  it('builds evidence-first response', () => {
    const r = buildRealityCheckResponse({ question: 'Did I hear voices?', latestFrame: { speechProbability: 80 } });
    assert.ok(r);
  });

  it('exposes enhancement disclaimer', () => {
    assert.match(ENHANCEMENT_LIMITS.disclaimer, /probabilistic/i);
  });
});
