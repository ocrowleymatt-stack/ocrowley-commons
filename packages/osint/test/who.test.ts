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
      const r = await who('Jane Doe at Acme in Manchester', { username: 'janedoe' });
      assert.equal(r.name, 'Jane Doe');
      assert.ok(r.next.startsWith('http'));
      assert.ok(r.text.includes('WHO: Jane Doe'));
      assert.ok(r.text.includes('NEXT →'));
      assert.ok(r.open.length >= 5);
      assert.match(await whoText('Jane Doe', { username: 'janedoe' }), /WHO:/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('accepts email and @username shortcuts', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('page not found', { status: 404 })) as typeof fetch;
    try {
      process.env.OCROWLEY_OSINT_CASE = 'CASE-WHO-2';
      const email = await who('someone@example.com');
      assert.ok(email.q.includes('@') || email.name.includes('@'));
      const user = await who('@someuser99');
      assert.ok(user.name.includes('someuser') || user.q.includes('someuser'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects empty input', async () => {
    await assert.rejects(() => who(''), /pass a name/i);
  });
});
