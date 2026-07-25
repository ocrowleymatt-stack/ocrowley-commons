import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPromise, loadPromises, setPromiseStatus } from '../src/promiseRegistryService.ts';
import { computePromiseHealth } from '../src/promise.ts';
import { loadStoryBible } from '../src/storyBibleService.ts';

describe('@ocrowley/story-memory', () => {
  it('tracks promises', () => {
    const p = createPromise({ projectId: 'p1', type: 'plot', statement: 'The key must return.' });
    assert.equal(loadPromises('p1').length, 1);
    setPromiseStatus('p1', p.id, 'paid_off');
    const bible = loadStoryBible('p1');
    assert.equal(bible.promises[0].status, 'paid_off');
    const health = computePromiseHealth(bible.promises);
    assert.equal(health.paidOff, 1);
  });
});
