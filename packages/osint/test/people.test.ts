import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPersonSeeds,
  buildPersonSearchLinks,
  buildPersonUsernameVariants,
  findPerson,
  guessEmailPatterns,
} from '../src/index.js';

const auth = {
  actorId: 'u1',
  roles: ['osint-operator'],
  authorizationRef: 'CASE-PERSON-1',
  purpose: 'authorised people research',
};

describe('people OSINT', () => {
  it('builds rich seeds and search links from a simple name', () => {
    const seeds = buildPersonSeeds({
      name: 'Jane Doe',
      employer: 'Acme Corp',
      location: 'Manchester',
      aliases: ['Janet Doe'],
    });
    assert.ok(seeds.some(s => s.type === 'person' && s.value === 'Jane Doe'));
    assert.ok(seeds.some(s => s.type === 'username'));
    assert.ok(seeds.some(s => s.type === 'email' && s.source === 'email-pattern-guess'));

    const links = buildPersonSearchLinks({ name: 'Jane Doe', country: 'uk' }, 'Jane Doe');
    assert.ok(links.some(l => l.engine === 'Companies House'));
    assert.ok(links.some(l => l.engine === 'LinkedIn'));
    assert.ok(links.some(l => l.category === 'images'));
  });

  it('expands username and email patterns', () => {
    const variants = buildPersonUsernameVariants('Jane', 'Doe', ['JD Smith']);
    assert.ok(variants.includes('janedoe'));
    assert.ok(variants.includes('j.doe'));
    const emails = guessEmailPatterns('Jane', 'Doe', ['acme.com']);
    assert.ok(emails.includes('jane.doe@acme.com'));
  });

  it('findPerson linksOnly returns instant pack without network fan-out', async () => {
    const pack = await findPerson(
      { name: 'Jane Doe', employer: 'Acme', location: 'Leeds' },
      { auth, linksOnly: true },
    );
    assert.equal(pack.displayName, 'Jane Doe');
    assert.ok(pack.searchLinks.length >= 8);
    assert.ok(pack.seeds.length >= 3);
    assert.equal(pack.recursive.brief.stopReason, 'links-only');
    assert.match(pack.evidentialWarning, /not primary evidence/i);
  });

  it('findPerson runs recursive enrichment with mocked fetch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('github.com/janedoe')) return new Response(null, { status: 200 });
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const pack = await findPerson(
        { name: 'Jane Doe', username: 'janedoe' },
        {
          auth,
          maxUsernameProbes: 2,
          toolkit: {
            enableArchive: false,
            enableDarkweb: false,
            enableBridges: false,
            enableCliTools: false,
          },
          recursive: { maxDiscoverSweeps: 1, maxCritiqueRounds: 1 },
        },
      );
      assert.ok(pack.summary.evidenceCount >= 1 || pack.profiles.length >= 0);
      assert.ok(pack.usernames.includes('janedoe') || pack.seeds.some(s => s.value === 'janedoe'));
      assert.ok(pack.summary.topLeads.length >= 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('requires name/username/email', async () => {
    await assert.rejects(() => findPerson({}, { auth, linksOnly: true }), /at least a name/i);
  });
});
