/**
 * Thin HTTP API over who() / whoText for SpiderDash and the local WHO web shell.
 *
 * Case auth: X-OCROWLEY-OSINT-CASE header, body/query `case`, or OCROWLEY_OSINT_CASE env.
 * Default-deny when no case reference is present.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { who, whoText, type WhoHints, type WhoResult } from './who.js';
import { whoToSpiderdashImport } from './whoSpiderdash.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface WhoApiSettings {
  caseRef: string;
  hibpApiKey: string;
  companiesHouseApiKey: string;
  deep: boolean;
  spiderfootUrl: string;
  bigbrotherBridgeUrl: string;
  purpose: string;
}

export interface WhoHttpServerOptions {
  host?: string;
  port?: number;
  /** Directory of static web assets (defaults to packages/osint/web). */
  webRoot?: string;
  /** When true, allow missing case in development only if OCROWLEY_OSINT_CASE is set. */
  requireCase?: boolean;
}

const SETTINGS_ENV: Record<keyof Omit<WhoApiSettings, 'deep' | 'caseRef' | 'purpose'>, string> = {
  hibpApiKey: 'HIBP_API_KEY',
  companiesHouseApiKey: 'COMPANIES_HOUSE_API_KEY',
  spiderfootUrl: 'OCROWLEY_SPIDERFOOT_URL',
  bigbrotherBridgeUrl: 'OCROWLEY_BIGBROTHER_BRIDGE',
};

export function readSettings(): WhoApiSettings {
  return {
    caseRef: process.env.OCROWLEY_OSINT_CASE || '',
    hibpApiKey: process.env.HIBP_API_KEY || '',
    companiesHouseApiKey: process.env.COMPANIES_HOUSE_API_KEY || '',
    deep: process.env.OCROWLEY_OSINT_DEEP === '1',
    spiderfootUrl: process.env.OCROWLEY_SPIDERFOOT_URL || '',
    bigbrotherBridgeUrl: process.env.OCROWLEY_BIGBROTHER_BRIDGE || '',
    purpose: process.env.OCROWLEY_OSINT_PURPOSE || 'authorised people research',
  };
}

/** Apply UI/settings payload to process env (local single-operator server). */
export function applySettings(partial: Partial<WhoApiSettings>): WhoApiSettings {
  if (partial.caseRef !== undefined) {
    process.env.OCROWLEY_OSINT_CASE = String(partial.caseRef).trim();
  }
  if (partial.purpose !== undefined) {
    process.env.OCROWLEY_OSINT_PURPOSE = String(partial.purpose).trim() || 'authorised people research';
  }
  if (partial.deep !== undefined) {
    process.env.OCROWLEY_OSINT_DEEP = partial.deep ? '1' : '0';
  }
  if (partial.hibpApiKey !== undefined) {
    process.env.HIBP_API_KEY = String(partial.hibpApiKey).trim();
  }
  if (partial.companiesHouseApiKey !== undefined) {
    process.env.COMPANIES_HOUSE_API_KEY = String(partial.companiesHouseApiKey).trim();
  }
  if (partial.spiderfootUrl !== undefined) {
    process.env.OCROWLEY_SPIDERFOOT_URL = String(partial.spiderfootUrl).trim();
  }
  if (partial.bigbrotherBridgeUrl !== undefined) {
    process.env.OCROWLEY_BIGBROTHER_BRIDGE = String(partial.bigbrotherBridgeUrl).trim();
  }
  return readSettings();
}

export function publicSettings(s: WhoApiSettings = readSettings()) {
  return {
    caseRef: s.caseRef,
    deep: s.deep,
    purpose: s.purpose,
    spiderfootUrl: s.spiderfootUrl,
    bigbrotherBridgeUrl: s.bigbrotherBridgeUrl,
    hibpConfigured: Boolean(s.hibpApiKey),
    companiesHouseConfigured: Boolean(s.companiesHouseApiKey),
    /** Keys never echoed; clients may re-submit to rotate. */
    envHints: Object.values(SETTINGS_ENV),
    classification: REPORT_CLASSIFICATION,
    warning: EVIDENTIAL_WARNING,
  };
}

export function resolveCaseRef(
  headers: IncomingMessage['headers'],
  bodyCase?: string,
  queryCase?: string,
): string {
  const header =
    headerValue(headers['x-ocrowley-osint-case']) ||
    bearerToken(headers.authorization) ||
    '';
  return (header || bodyCase || queryCase || process.env.OCROWLEY_OSINT_CASE || '').trim();
}

function headerValue(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? (v[0] || '') : v;
}

function bearerToken(auth: string | string[] | undefined): string {
  const raw = headerValue(auth);
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || '';
}

export interface WhoRequestBody {
  q?: string;
  query?: string;
  input?: string;
  deep?: boolean;
  case?: string;
  at?: string;
  in?: string;
  email?: string;
  username?: string;
  phone?: string;
  aka?: string | string[];
  country?: 'uk' | 'us' | 'other';
  format?: 'json' | 'text';
}

export function buildHints(body: WhoRequestBody, caseRef: string): WhoHints {
  return {
    at: body.at,
    in: body.in,
    email: body.email,
    username: body.username,
    phone: body.phone,
    aka: body.aka,
    country: body.country,
    case: caseRef,
    deep: body.deep,
  };
}

async function readJsonBody(req: IncomingMessage): Promise<WhoRequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WhoRequestBody;
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OCROWLEY-OSINT-CASE',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, text: string, type = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function mimeFor(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function serveStatic(webRoot: string, urlPath: string, res: ServerResponse): Promise<boolean> {
  const clean = urlPath === '/' ? '/index.html' : urlPath.split('?')[0];
  if (clean.includes('..')) {
    sendText(res, 400, 'Bad path');
    return true;
  }
  const filePath = path.join(webRoot, clean.replace(/^\//, ''));
  if (!filePath.startsWith(path.resolve(webRoot))) {
    sendText(res, 400, 'Bad path');
    return true;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeFor(filePath), 'Cache-Control': 'no-cache' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export function serializeWhoResult(r: WhoResult) {
  return {
    q: r.q,
    name: r.name,
    next: r.next,
    hits: r.hits,
    open: r.open,
    stats: r.stats,
    text: r.text,
    warning: r.warning,
    classification: REPORT_CLASSIFICATION,
    spiderdash: whoToSpiderdashImport(r),
  };
}

export type WhoHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function createWhoApiHandler(opts: WhoHttpServerOptions = {}): WhoHandler {
  const webRoot = opts.webRoot || path.resolve(__dirname, '../web');
  const requireCase = opts.requireCase !== false;

  return async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OCROWLEY-OSINT-CASE',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      });
      res.end();
      return;
    }

    try {
      if (pathname === '/api/health' && method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          service: 'ocrowley-who',
          caseConfigured: Boolean(process.env.OCROWLEY_OSINT_CASE?.trim()),
        });
        return;
      }

      if (pathname === '/api/settings' && method === 'GET') {
        sendJson(res, 200, publicSettings());
        return;
      }

      if (pathname === '/api/settings' && method === 'PUT') {
        const body = (await readJsonBody(req)) as Partial<WhoApiSettings> & WhoRequestBody;
        const next = applySettings({
          caseRef: body.caseRef ?? body.case,
          hibpApiKey: (body as Partial<WhoApiSettings>).hibpApiKey,
          companiesHouseApiKey: (body as Partial<WhoApiSettings>).companiesHouseApiKey,
          deep: body.deep,
          spiderfootUrl: (body as Partial<WhoApiSettings>).spiderfootUrl,
          bigbrotherBridgeUrl: (body as Partial<WhoApiSettings>).bigbrotherBridgeUrl,
          purpose: (body as Partial<WhoApiSettings>).purpose,
        });
        sendJson(res, 200, publicSettings(next));
        return;
      }

      if ((pathname === '/api/who' || pathname === '/api/who/text') && (method === 'GET' || method === 'POST')) {
        const body = method === 'POST' ? await readJsonBody(req) : {};
        const q =
          (body.q || body.query || body.input || url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
        const caseRef = resolveCaseRef(
          req.headers,
          body.case,
          url.searchParams.get('case') || undefined,
        );

        if (requireCase && !caseRef) {
          sendJson(res, 401, {
            error: 'Case authorization required',
            hint: 'Set OCROWLEY_OSINT_CASE, or send X-OCROWLEY-OSINT-CASE / body.case',
          });
          return;
        }

        if (!q) {
          sendJson(res, 400, {
            error: 'Missing query',
            hint: 'Pass q as JSON body or ?q= (name, email, @user, "Name at Org in City")',
          });
          return;
        }

        const deepParam = url.searchParams.get('deep');
        const deep =
          body.deep === true ||
          deepParam === '1' ||
          deepParam === 'true' ||
          (body.deep === undefined && deepParam === null ? undefined : false);

        const hints = buildHints(
          {
            ...body,
            deep: deep === undefined ? body.deep : deep,
            at: body.at || url.searchParams.get('at') || undefined,
            in: body.in || url.searchParams.get('in') || undefined,
            email: body.email || url.searchParams.get('email') || undefined,
            username: body.username || url.searchParams.get('username') || undefined,
          },
          caseRef || 'local-dev',
        );

        if (pathname === '/api/who/text' || body.format === 'text' || url.searchParams.get('format') === 'text') {
          const text = await whoText(q, hints);
          sendText(res, 200, text);
          return;
        }

        const result = await who(q, hints);
        sendJson(res, 200, serializeWhoResult(result));
        return;
      }

      if (method === 'GET') {
        const served = await serveStatic(webRoot, pathname === '/' ? '/' : pathname, res);
        if (served) return;
        if (pathname === '/who' || pathname === '/app') {
          const ok = await serveStatic(webRoot, '/', res);
          if (ok) return;
        }
      }

      sendJson(res, 404, { error: 'Not found', path: pathname });
    } catch (err) {
      const status = typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, status, { error: message });
    }
  };
}

export function createWhoServer(opts: WhoHttpServerOptions = {}): Server {
  const handler = createWhoApiHandler(opts);
  return createServer((req, res) => {
    void handler(req, res);
  });
}

export async function listenWhoServer(opts: WhoHttpServerOptions = {}): Promise<{
  server: Server;
  url: string;
  host: string;
  port: number;
}> {
  const host = opts.host || process.env.OCROWLEY_WHO_HOST || '127.0.0.1';
  const port = opts.port ?? Number(process.env.OCROWLEY_WHO_PORT || 8787);
  const server = createWhoServer(opts);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  return { server, host, port, url: `http://${host}:${port}` };
}
