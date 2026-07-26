import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listTools,
  reportToolkitAvailability,
  createFullDiscover,
  runRecursiveOsint,
  TOOL_CATALOG,
} from '../src/index.js';

const auth = {
  actorId: 'u1',
  roles: ['osint-operator'],
  authorizationRef: 'CASE-TOOLS-1',
  purpose: 'toolkit availability',
};

describe('full toolkit availability', () => {
  it('catalogues commons, darkweb, bigbrother, spiderfoot and cli tools', () => {
    const families = new Set(listTools().map(t => t.family));
    assert.ok(families.has('commons'));
    assert.ok(families.has('darkweb'));
    assert.ok(families.has('bigbrother'));
    assert.ok(families.has('spiderfoot'));
    assert.ok(families.has('cli'));
    assert.ok(TOOL_CATALOG.length >= 30);
    assert.ok(listTools({ family: 'bigbrother' }).length >= 19);
  });

  it('reports live tools ready without bridges', () => {
    const report = reportToolkitAvailability({ auth });
    const liveReady = report.tools.filter(t => t.ready && t.reason === 'in-process');
    assert.ok(liveReady.length >= 5);
    assert.ok(liveReady.some(t => t.id === 'platform-probe'));
    assert.ok(liveReady.some(t => t.id === 'wayback-cdx'));
    // Darkweb stays gated until lawful-use ack
    assert.equal(report.tools.find(t => t.id === 'ahmia-index')?.ready, false);

    const withDw = reportToolkitAvailability({
      auth,
      darkwebAuth: { ...auth, lawfulUseAcknowledged: true },
    });
    assert.equal(withDw.tools.find(t => t.id === 'ahmia-index')?.ready, true);
  });

  it('full discover fans out with mocked network tools', async () => {
    const discover = createFullDiscover({
      auth,
      enablePlatformProbes: true,
      enableArchive: false,
      enableDarkweb: false,
      enableBridges: false,
      enableCliTools: false,
    });

    // Inject probe via monkeypatching fetch for HEAD checks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('github.com')) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const sweep = await discover(
        [{ type: 'username', value: 'octocat', confidence: 90, source: 'test' }],
        1,
      );
      assert.ok(sweep.items.some(i => i.source === 'platform-probe' || i.source === 'toolkit'));
      assert.ok(sweep.itemKeys.length >= 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('runRecursiveOsint defaults to full toolkit and returns tools report', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    try {
      const result = await runRecursiveOsint({
        auth,
        initialSeeds: [{ type: 'username', value: 'nobody12345xyz', confidence: 90, source: 't' }],
        maxDiscoverSweeps: 1,
        maxCritiqueRounds: 1,
        toolkit: { enableArchive: false, enableDarkweb: false, enableBridges: false, enableCliTools: false },
      });
      assert.ok(result.tools.tools.length >= 30);
      assert.ok(result.tools.liveCount >= 5);
      assert.ok(result.brief.title.includes('OSINT'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
