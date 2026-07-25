import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimExtractor } from '../src/ClaimExtractor.ts';
import { StubWebResearchProvider } from '../src/StubWebResearchProvider.ts';

describe('@ocrowley/research', () => {
  it('extracts factual claims', () => {
    const claims = claimExtractor.extract('Paris was founded in the 3rd century. Maybe it rains.');
    assert.ok(claims.length >= 1);
  });

  it('never fabricates web results', async () => {
    const result = await new StubWebResearchProvider().search('shakespeare');
    assert.equal(result.available, false);
    assert.equal(result.reason, 'web_search_unavailable');
  });
});
