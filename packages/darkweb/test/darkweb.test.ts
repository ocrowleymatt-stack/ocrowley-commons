import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAhmiaHtml,
  parseAhmiaLegacyHtml,
  evaluateDarkwebPolicy,
  monitorDarkWeb,
  riskBand,
  unavailableMonitorReport,
  stubBreachProvider,
  stubDarkWebSearchProvider,
} from '../src/index.js';

const auth = {
  actorId: 'u1',
  roles: ['osint-operator'],
  authorizationRef: 'CASE-99',
  purpose: 'authorized monitoring',
  lawfulUseAcknowledged: true,
};

describe('@ocrowley/darkweb', () => {
  it('parses ahmia result blocks and legacy html', () => {
    const blocks = parseAhmiaHtml(`
      <li class="result">
        <h4><a href="http://example.onion">Example Onion</a></h4>
        <p class="result-description">A sample listing</p>
      </li>
    `);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].title, 'Example Onion');

    const legacy = parseAhmiaLegacyHtml(`
      <h4><a href="http://legacy.onion">Legacy</a></h4>
      <p class="result-description">Legacy desc</p>
    `);
    assert.equal(legacy[0].url, 'http://legacy.onion');
  });

  it('enforces darkweb policy', () => {
    const denied = evaluateDarkwebPolicy('monitor.entities', {
      ...auth,
      lawfulUseAcknowledged: false,
    });
    assert.equal(denied.allowed, false);

    const allowed = evaluateDarkwebPolicy('monitor.entities', auth);
    assert.equal(allowed.allowed, true);
  });

  it('monitors entities via injected stub providers', async () => {
    const report = await monitorDarkWeb([{ value: 'a@b.co', type: 'email' }, 'alias'], {
      auth,
      searchProvider: {
        id: 'test',
        async search(q) {
          return q === 'alias'
            ? [{ url: 'http://x.onion', title: 'x', description: '', source: 'test' }]
            : [];
        },
      },
      breachProvider: {
        id: 'test-hibp',
        async check(q) {
          return q.includes('@') ? [{ source: 'hibp', name: 'ExampleBreach' }] : [];
        },
      },
      highRiskThreshold: 0,
    });

    assert.equal(report.available, true);
    assert.equal(report.results.length, 2);
    assert.equal(report.totalMentionsFound, 2);
    assert.equal(riskBand(4), 'high');
  });

  it('returns honest unavailable report and empty stubs', async () => {
    const unavailable = unavailableMonitorReport(2);
    assert.equal(unavailable.reason, 'darkweb_search_unavailable');
    assert.deepEqual(await stubBreachProvider.check('a@b.co'), []);
    assert.deepEqual(await stubDarkWebSearchProvider.search('q'), []);
  });

  it('rejects monitor without policy clearance', async () => {
    await assert.rejects(
      () =>
        monitorDarkWeb(['x'], {
          auth: { ...auth, authorizationRef: '' },
          searchProvider: stubDarkWebSearchProvider,
          breachProvider: stubBreachProvider,
        }),
      /policy denied/i,
    );
  });
});
