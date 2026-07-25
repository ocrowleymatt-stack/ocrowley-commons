import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runQualityGates, aggregateQuality } from '../src/qualityGateService.ts';
import { aiSmellDetector } from '../src/AISmellDetector.ts';

describe('@ocrowley/quality', () => {
  it('returns findings for prose', () => {
    const findings = runQualityGates('He walked into the room and looked at the glass.');
    assert.ok(findings.length >= 3);
    const agg = aggregateQuality(findings);
    assert.ok(typeof agg.overallScore === 'number');
  });

  it('detects AI smell patterns', () => {
    const r = aiSmellDetector.detect("In today's fast-paced world, it's worth noting the tapestry of life.");
    assert.ok(r.signals.length >= 2);
    assert.ok(r.score < 75);
  });
});
