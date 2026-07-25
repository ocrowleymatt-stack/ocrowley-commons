import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LITERARY_RULES_SUMMARY, loadLiteraryRules } from '../src/rules.ts';

describe('@ocrowley/literary-rules', () => {
  it('has standing summary', () => {
    assert.match(LITERARY_RULES_SUMMARY, /Story first/);
  });
  it('loads RULES.md', () => {
    const rules = loadLiteraryRules();
    assert.match(rules, /LITERARY ENGINE|Story first/i);
  });
});
