import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../src/result.ts';

describe('@ocrowley/persistence', () => {
  it('ok wraps data', () => {
    const r = ok({ a: 1 }, true);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.data, { a: 1 });
      assert.equal(r.fromCache, true);
    }
  });

  it('fail wraps errors', () => {
    const r = fail(new Error('boom'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, 'boom');
  });
});
