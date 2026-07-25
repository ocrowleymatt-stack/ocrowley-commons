import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ingestText } from '../src/intake.ts';

describe('@ocrowley/manuscript', () => {
  it('detects chapter hints', () => {
    const r = ingestText('# Chapter 1\n\nShe opened the door.\n\n# Chapter 2\n\nRain.');
    assert.ok(r.chapterHints.length >= 2);
    assert.ok(r.wordCount > 0);
  });
});
