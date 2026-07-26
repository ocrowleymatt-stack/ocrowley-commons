import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpiderdashImportPayload,
  FLIPPER_BLE,
  SPIDERDASH_DEFAULT_URL,
  suggestFlipperCommands,
} from '../src/index.js';

describe('spiderdash bridge', () => {
  it('exposes Flipper BLE UUIDs and default URL', () => {
    assert.match(FLIPPER_BLE.serviceUuid, /fef6/i);
    assert.equal(SPIDERDASH_DEFAULT_URL, 'https://spiderdash-mbpjlxnq.manus.space');
  });

  it('maps recursive results to SpiderDash entities', () => {
    const payload = buildSpiderdashImportPayload({
      discovery: {
        sweeps: [],
        allItems: [],
        allSeeds: [{ type: 'username', value: 'alice', confidence: 90, source: 't' }],
        convergenceReason: 'max-sweeps',
        totalSweeps: 1,
        totalDurationMs: 1,
      },
      critique: { rounds: [], finalScore: 70, stopReason: 'max-rounds', totalRounds: 0 },
      evidence: [
        {
          key: 'p1',
          entity: 'alice',
          title: 'GitHub',
          source: 'platform-probe',
          snippet: 'reported profile',
          score: 72,
        },
      ],
      seeds: [{ type: 'username', value: 'alice', confidence: 90, source: 't' }],
      findings: [],
      tools: { tools: [{ id: 'platform-probe', ready: true, reason: 'in-process', family: 'commons' }], liveCount: 1, bridgeReadyCount: 0 },
      brief: {
        title: 'Recursive OSINT Lead Pack',
        classification: 'UNCLASSIFIED',
        executiveSummary: 'test',
        evidentialWarning: 'warn',
        score: 70,
        stopReason: 'ok',
      },
    });

    assert.ok(payload.entities.some(e => e.value === 'alice'));
    assert.ok(payload.toolsReady.includes('platform-probe'));
    assert.ok(suggestFlipperCommands(payload.entities.map(e => ({ type: e.type, value: e.value, confidence: 80, source: 't' }))).length >= 1);
  });
});
