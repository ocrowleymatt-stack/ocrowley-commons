import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import {
  applySettings,
  buildHints,
  createWhoServer,
  publicSettings,
  readSettings,
  resolveCaseRef,
  serializeWhoResult,
} from '../src/httpApi.js';
import { parseWhoInput, who } from '../src/index.js';
import { whoToSpiderdashImport } from '../src/whoSpiderdash.js';

describe('who HTTP API helpers', () => {
  it('resolves case from header over body over env', () => {
    const prev = process.env.OCROWLEY_OSINT_CASE;
    process.env.OCROWLEY_OSINT_CASE = 'ENV-CASE';
    try {
      assert.equal(resolveCaseRef({ 'x-ocrowley-osint-case': 'HDR' }, 'BODY', 'Q'), 'HDR');
      assert.equal(resolveCaseRef({}, 'BODY', 'Q'), 'BODY');
      assert.equal(resolveCaseRef({}, undefined, 'Q'), 'Q');
      assert.equal(resolveCaseRef({}, undefined, undefined), 'ENV-CASE');
      assert.equal(resolveCaseRef({ authorization: 'Bearer TOK-1' }, undefined, undefined), 'TOK-1');
    } finally {
      if (prev === undefined) delete process.env.OCROWLEY_OSINT_CASE;
      else process.env.OCROWLEY_OSINT_CASE = prev;
    }
  });

  it('applies settings without echoing secrets', () => {
    const prev = {
      case: process.env.OCROWLEY_OSINT_CASE,
      hibp: process.env.HIBP_API_KEY,
      deep: process.env.OCROWLEY_OSINT_DEEP,
      sf: process.env.OCROWLEY_SPIDERFOOT_URL,
      bb: process.env.OCROWLEY_BIGBROTHER_BRIDGE,
    };
    try {
      applySettings({
        caseRef: 'CASE-SET',
        hibpApiKey: 'secret-hibp',
        deep: true,
        spiderfootUrl: 'http://sf.local',
        bigbrotherBridgeUrl: 'http://bb.local',
      });
      const pub = publicSettings(readSettings());
      assert.equal(pub.caseRef, 'CASE-SET');
      assert.equal(pub.deep, true);
      assert.equal(pub.hibpConfigured, true);
      assert.equal(pub.spiderfootUrl, 'http://sf.local');
      assert.equal(pub.bigbrotherBridgeUrl, 'http://bb.local');
      assert.ok(!JSON.stringify(pub).includes('secret-hibp'));
    } finally {
      restoreEnv('OCROWLEY_OSINT_CASE', prev.case);
      restoreEnv('HIBP_API_KEY', prev.hibp);
      restoreEnv('OCROWLEY_OSINT_DEEP', prev.deep);
      restoreEnv('OCROWLEY_SPIDERFOOT_URL', prev.sf);
      restoreEnv('OCROWLEY_BIGBROTHER_BRIDGE', prev.bb);
    }
  });

  it('buildHints carries case into who()', () => {
    const hints = buildHints({ deep: true, at: 'Acme', in: 'Leeds' }, 'CASE-H');
    assert.equal(hints.case, 'CASE-H');
    assert.equal(hints.deep, true);
    assert.equal(hints.at, 'Acme');
    assert.equal(hints.in, 'Leeds');
  });
});

describe('who HTTP server', () => {
  let server: Server;
  let base: string;
  const originalFetch = globalThis.fetch;

  before(async () => {
    process.env.OCROWLEY_OSINT_CASE = 'CASE-HTTP-1';
    // Mock outbound OSINT probes, but let requests to this test server through.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.includes('127.0.0.1') || url.includes('localhost')) {
        return originalFetch(input, init);
      }
      return new Response('page not found', { status: 404 });
    }) as typeof fetch;
    server = createWhoServer({ requireCase: true });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  });

  it('health + settings', async () => {
    const health = await fetch(`${base}/api/health`).then(r => r.json());
    assert.equal(health.ok, true);
    const settings = await fetch(`${base}/api/settings`).then(r => r.json());
    assert.equal(settings.caseRef, 'CASE-HTTP-1');
  });

  it('rejects who without case when env cleared', async () => {
    const prev = process.env.OCROWLEY_OSINT_CASE;
    delete process.env.OCROWLEY_OSINT_CASE;
    try {
      const res = await fetch(`${base}/api/who`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'Jane Doe' }),
      });
      assert.equal(res.status, 401);
    } finally {
      process.env.OCROWLEY_OSINT_CASE = prev;
    }
  });

  it('POST /api/who returns report + next via who() path', async () => {
    const res = await fetch(`${base}/api/who`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCROWLEY-OSINT-CASE': 'CASE-HTTP-WHO',
      },
      body: JSON.stringify({ q: 'Jane Doe at Acme in Manchester', username: 'janedoe' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Jane Doe');
    assert.ok(String(data.next).startsWith('http'));
    assert.ok(String(data.text).includes('WHO: Jane Doe'));
    assert.ok(Array.isArray(data.hits));
    assert.ok(Array.isArray(data.open));
    assert.ok(data.spiderdash?.entities?.length >= 1);
  });

  it('GET /api/who/text returns printable text', async () => {
    const res = await fetch(
      `${base}/api/who/text?q=${encodeURIComponent('Jane Doe')}&case=CASE-TEXT`,
    );
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /WHO:/);
  });

  it('serves the WHO web shell', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /OCROWLEY/);
    assert.match(html, /id="who-form"/);
  });
});

describe('who() path integration for API serialization', () => {
  it('serializeWhoResult + spiderdash bridge from live who()', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('page not found', { status: 404 })) as typeof fetch;
    try {
      process.env.OCROWLEY_OSINT_CASE = 'CASE-SER';
      const q = parseWhoInput('Ada Lovelace at Analytical in London');
      assert.equal(q.name, 'Ada Lovelace');
      const r = await who('Ada Lovelace at Analytical in London');
      const payload = serializeWhoResult(r);
      assert.equal(payload.name, 'Ada Lovelace');
      assert.ok(payload.spiderdash.entities.some(e => e.type === 'person'));
      const bridge = whoToSpiderdashImport(r);
      assert.ok(bridge.defaultUrl.includes('http'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
