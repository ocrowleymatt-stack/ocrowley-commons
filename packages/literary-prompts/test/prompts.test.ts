import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { outlinePrompt, cutPrompt, LITERARY_SYSTEM } from '../src/prompts.ts';

describe('@ocrowley/literary-prompts', () => {
  it('builds outline prompt', () => {
    const p = outlinePrompt('A thief returns home', 'literary thriller', 12);
    assert.match(p, /chapter-by-chapter/i);
    assert.match(p, /literary thriller/);
  });

  it('includes standing rules', () => {
    assert.match(LITERARY_SYSTEM, /Story first/);
  });

  it('cut prompt asks for text only', () => {
    assert.match(cutPrompt('word '.repeat(50)), /revised text only/i);
  });
});
