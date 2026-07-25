import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSimilarity, detectEchoes } from '../src/narrativeUtils.ts';

describe('@ocrowley/export', () => {
  it('detects high similarity', () => {
    const a = 'The rain fell on the quiet street outside the window.';
    const b = 'The rain fell on the quiet street outside the window!';
    assert.ok(calculateSimilarity(a, b) > 0.8);
  });

  it('detectEchoes returns array', () => {
    const result = detectEchoes('The quiet street was quiet and the street was dark.');
    assert.ok(Array.isArray(result));
    assert.ok(result.some((e) => e.word === 'quiet' || e.word === 'street'));
  });
});
