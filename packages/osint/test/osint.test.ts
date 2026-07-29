import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUsernameVariants,
  detectExactDuplicates,
  computeBasicMetrics,
  analyseDeceptionBaseline,
  clusterGeoPoints,
  normalizeSpiderfootTarget,
  inferEntityType,
  evaluateOsintPolicy,
  parseWaybackCdx,
  staticRiskReviewFallback,
  resolvePlatformUrl,
  DEFAULT_USERNAME_PLATFORMS,
} from '../src/index.js';

describe('@ocrowley/osint', () => {
  it('infers entity types and spiderfoot name quoting', () => {
    assert.equal(inferEntityType('a@b.co'), 'email');
    assert.equal(inferEntityType('example.com'), 'domain');
    assert.equal(normalizeSpiderfootTarget('Jane Doe'), '"Jane Doe"');
    assert.equal(normalizeSpiderfootTarget('example.com'), 'example.com');
  });

  it('builds username variants', () => {
    const variants = buildUsernameVariants('Jane', 'Doe');
    assert.ok(variants.includes('janedoe'));
    assert.ok(variants.includes('j.doe'));
  });

  it('dedups exact normalised entities', () => {
    const result = detectExactDuplicates([
      { id: '1', type: 'person', value: 'John Smith' },
      { id: '2', type: 'person', value: 'john  smith' },
      { id: '3', type: 'person', value: 'Alice' },
    ]);
    assert.equal(result.stats.duplicateGroups, 1);
    assert.equal(result.stats.savings, 1);
    assert.equal(result.ungrouped.length, 1);
  });

  it('computes stylometry and deception baselines', () => {
    const metrics = computeBasicMetrics('Honestly, I never saw anything. To be honest, I do not remember.');
    assert.ok(metrics.wordCount > 5);
    const deception = analyseDeceptionBaseline('Honestly, I never saw anything. To be honest, I do not remember.');
    assert.ok(deception.flaggedSentenceCount >= 1);
    assert.match(deception.disclaimer, /investigative leads/i);
  });

  it('clusters nearby geo points', () => {
    const result = clusterGeoPoints([
      { id: 'a', value: 'A', lat: 51.5, lon: -0.12 },
      { id: 'b', value: 'B', lat: 51.501, lon: -0.121 },
      { id: 'c', value: 'C', lat: 53.4, lon: -2.2 },
    ]);
    assert.equal(result.clusters.length, 2);
    assert.ok(result.bounds);
  });

  it('denies OSINT without authorization ref', () => {
    const denied = evaluateOsintPolicy('scan.passive', {
      actorId: 'u1',
      roles: ['osint-operator'],
      authorizationRef: '',
      purpose: 'test',
    });
    assert.equal(denied.allowed, false);

    const allowed = evaluateOsintPolicy('scan.passive', {
      actorId: 'u1',
      roles: ['osint-operator'],
      authorizationRef: 'CASE-42',
      purpose: 'authorized research',
    });
    assert.equal(allowed.allowed, true);
  });

  it('parses wayback CDX rows', () => {
    const artefacts = parseWaybackCdx([
      ['timestamp', 'original', 'statuscode', 'mimetype', 'length'],
      ['20200101120000', 'https://example.com/', '200', 'text/html', '123'],
    ]);
    assert.equal(artefacts.length, 1);
    assert.match(artefacts[0].archiveUrl, /web\.archive\.org/);
  });

  it('resolves platform urls and provides static risk fallback', () => {
    const url = resolvePlatformUrl(DEFAULT_USERNAME_PLATFORMS[0], 'alice');
    assert.equal(url, 'https://github.com/alice');
    const fallback = staticRiskReviewFallback();
    assert.equal(fallback.confidenceLevel, 'low');
  });
});
