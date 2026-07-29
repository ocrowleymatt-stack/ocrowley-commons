import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAwaitableBridge, bridgeTimeoutMs } from '../src/bridgeAwait.js';
import { archiveWhoResult, listWhoArchive, readWhoArchive } from '../src/whoArchive.js';
import {
  applyBridgeUrlDefaults,
  resolveSpiderdashUrl,
  resolveSpiderfootUrl,
  SPIDERDASH_DEFAULT_URL,
  SPIDERFOOT_DEFAULT_URL,
} from '../src/bridgeDefaults.js';

describe('bridge defaults', () => {
  it('resolves hosted SpiderDash + SpiderFoot URLs', () => {
    const prevSd = process.env.OCROWLEY_SPIDERDASH_URL;
    const prevSf = process.env.OCROWLEY_SPIDERFOOT_URL;
    delete process.env.OCROWLEY_SPIDERDASH_URL;
    delete process.env.OCROWLEY_SPIDERFOOT_URL;
    try {
      assert.equal(resolveSpiderdashUrl(), SPIDERDASH_DEFAULT_URL);
      assert.equal(resolveSpiderfootUrl(), SPIDERFOOT_DEFAULT_URL);
      const applied = applyBridgeUrlDefaults();
      assert.equal(applied.spiderdashUrl, SPIDERDASH_DEFAULT_URL);
      assert.equal(applied.spiderfootUrl, SPIDERFOOT_DEFAULT_URL);
      assert.match(process.env.OCROWLEY_SPIDERDASH_URL || '', /spiderdash/);
      assert.match(process.env.OCROWLEY_SPIDERFOOT_URL || '', /165\.227\.237\.155/);
    } finally {
      if (prevSd === undefined) delete process.env.OCROWLEY_SPIDERDASH_URL;
      else process.env.OCROWLEY_SPIDERDASH_URL = prevSd;
      if (prevSf === undefined) delete process.env.OCROWLEY_SPIDERFOOT_URL;
      else process.env.OCROWLEY_SPIDERFOOT_URL = prevSf;
    }
  });
});

describe('bridge await', () => {
  it('defaults to a long enough SpiderFoot/SpiderDash wait window', () => {
    const prev = process.env.OCROWLEY_BRIDGE_TIMEOUT_MS;
    delete process.env.OCROWLEY_BRIDGE_TIMEOUT_MS;
    try {
      assert.ok(bridgeTimeoutMs() >= 120_000);
    } finally {
      if (prev !== undefined) process.env.OCROWLEY_BRIDGE_TIMEOUT_MS = prev;
    }
  });

  it('polls until scan finishes', async () => {
    process.env.OCROWLEY_BRIDGE_POLL_MS = '20';
    process.env.OCROWLEY_BRIDGE_TIMEOUT_MS = '2000';
    let polls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/api/scan')) {
        return new Response(JSON.stringify({ scanId: 'SF-1', status: 'RUNNING' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/scanstatus/SF-1')) {
        polls += 1;
        const status = polls >= 2 ? 'FINISHED' : 'RUNNING';
        return new Response(JSON.stringify({ status, scanId: 'SF-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/scaneventresults/SF-1')) {
        return new Response(
          JSON.stringify({
            items: [{ key: 'sf:1', entity: 'ada', title: 'SF hit', source: 'spiderfoot-scan', snippet: 'ok', score: 80 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('no', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await runAwaitableBridge({
        baseUrl: 'http://sf.test',
        startPath: '/api/scan',
        body: { seeds: [] },
        timeoutMs: 2000,
        pollMs: 20,
      });
      assert.ok(result);
      assert.equal(result.status, 'FINISHED');
      assert.ok(Array.isArray(result.items));
      assert.ok(polls >= 2);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.OCROWLEY_BRIDGE_POLL_MS;
      delete process.env.OCROWLEY_BRIDGE_TIMEOUT_MS;
    }
  });
});

describe('who archive', () => {
  it('persists and lists lookups', async () => {
    const prev = process.env.OCROWLEY_DATA_DIR;
    process.env.OCROWLEY_DATA_DIR = `/tmp/ocrowley-archive-${Date.now()}`;
    try {
      const entry = await archiveWhoResult(
        {
          q: 'Jane Doe',
          name: 'Jane Doe',
          next: 'https://example.com',
          hits: [],
          open: [],
          stats: { confirmed: 0, likely: 0, possible: 0, checked: 1 },
          text: 'WHO: Jane Doe',
          warning: 'warn',
          toolsUsed: ['platform-probe'],
          toolsReady: [],
        },
        'CASE-A',
      );
      assert.ok(entry.id);
      const listed = await listWhoArchive(10);
      assert.ok(listed.some(e => e.id === entry.id));
      const loaded = await readWhoArchive(entry.id);
      assert.equal(loaded?.name, 'Jane Doe');
      assert.equal(loaded?.caseRef, 'CASE-A');
    } finally {
      if (prev === undefined) delete process.env.OCROWLEY_DATA_DIR;
      else process.env.OCROWLEY_DATA_DIR = prev;
    }
  });
});
