import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhoInput, who, whoText } from '../src/index.js';

describe('who()', () => {
  it('parses "Name at Org in City" from one string', () => {
    const q = parseWhoInput('Jane Doe at Acme Ltd in Manchester');
    assert.equal(q.name, 'Jane Doe');
    assert.equal(q.employer, 'Acme Ltd');
    assert.equal(q.location, 'Manchester');
  });

  it('parses email and @username from free text', () => {
    const q = parseWhoInput('Jane Doe jane@acme.com @janedoe');
    assert.equal(q.name, 'Jane Doe');
    assert.equal(q.email, 'jane@acme.com');
    assert.equal(q.username, 'janedoe');
  });

  it('returns printable report + next URL', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('github.com/janedoe')) {
        return new Response('<html><title>janedoe</title></html>', { status: 200 });
      }
      if (url.includes('web.archive.org')) {
        return new Response(JSON.stringify([['timestamp', 'original'], ['20200101000000', url]]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('gravatar.com')) return new Response(null, { status: 404 });
      return new Response('page not found', { status: 404 });
    }) as typeof fetch;

    try {
      process.env.OCROWLEY_OSINT_CASE = 'CASE-WHO-1';
      const r = await who('Jane Doe at Acme in Manchester', { username: 'janedoe', full: false, archive: false });
      assert.equal(r.name, 'Jane Doe');
      assert.ok(r.next.startsWith('http'));
      assert.ok(r.text.includes('WHO: Jane Doe'));
      assert.ok(r.text.includes('NEXT →'));
      assert.ok(r.open.length >= 5);
      assert.ok(r.toolsUsed.length >= 1);
      assert.match(await whoText('Jane Doe', { username: 'janedoe', full: false, archive: false }), /WHO:/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('accepts email and @username shortcuts', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('page not found', { status: 404 })) as typeof fetch;
    try {
      process.env.OCROWLEY_OSINT_CASE = 'CASE-WHO-2';
      const email = await who('someone@example.com', { full: false, archive: false });
      assert.ok(email.q.includes('@') || email.name.includes('@'));
      const user = await who('@someuser99', { full: false, archive: false });
      assert.ok(user.name.includes('someuser') || user.q.includes('someuser'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects empty input', async () => {
    await assert.rejects(() => who(''), /pass a name/i);
  });

  it('full toolkit path merges recursive evidence and archives', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('page not found', { status: 404 })) as typeof fetch;
    const prevData = process.env.OCROWLEY_DATA_DIR;
    process.env.OCROWLEY_DATA_DIR = `/tmp/ocrowley-who-test-${Date.now()}`;
    try {
      process.env.OCROWLEY_OSINT_CASE = 'CASE-WHO-FULL';
      const r = await who('Ada Lovelace', {
        username: 'adal',
        full: true,
        archive: true,
        maxDiscoverSweeps: 2,
        maxCritiqueRounds: 1,
      });
      assert.ok(r.toolsUsed.length >= 3);
      assert.ok(r.recursive);
      assert.ok(r.archiveId);
      assert.ok(r.text.includes('TOOLS'));
    } finally {
      globalThis.fetch = originalFetch;
      if (prevData === undefined) delete process.env.OCROWLEY_DATA_DIR;
      else process.env.OCROWLEY_DATA_DIR = prevData;
    }
  });
});
