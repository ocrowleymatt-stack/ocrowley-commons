import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groundEntity, isGrounded } from '../src/grounding.ts';

describe('@ocrowley/research grounding', () => {
  it('exact match scores 100', () => {
    assert.equal(groundEntity('Alice Smith', ['Contact Alice Smith yesterday']), 100);
  });
  it('ungrounded fails threshold', () => {
    assert.equal(isGrounded('Zorgon', ['unrelated text']), false);
  });
});
