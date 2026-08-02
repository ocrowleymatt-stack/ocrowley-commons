/**
 * Thin HTTP API over who() / whoText for SpiderDash and the local WHO web shell.
 *
 * Gate: PIN (default 3123 via OCROWLEY_WHO_PIN) on API routes except health/unlock.
 * Case auth: X-OCROWLEY-OSINT-CASE header, body/query `case`, or OCROWLEY_OSINT_CASE env.
 * Default-deny when no case reference is present.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { who, whoText, type WhoHints, type WhoResult } from './who.js';
import { whoToSpiderdashImport } from './whoSpiderdash.js';
import { listWhoArchive, readWhoArchive } from './whoArchive.js';
import { reportToolkitAvailability } from './toolkit.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION } from './types.js';
import { bridgeTimeoutMs } from './bridgeAwait.js';
import {
  applyBridgeUrlDefaults,
  resolveBigbrotherUrl,
  resolveSpiderdashUrl,
  resolveSpiderfootUrl,
} from './bridgeDefaults.js';
import {
  cancelWhoJob,
  enqueueWhoJob,
  getWhoJob,
  listWhoJobs,
  publicWhoJob,
  retryWhoJob,
} from './jobs/whoJobService.js';
import { getWhoWorkerId, isWhoWorkerRunning } from './jobs/whoWorker.js';
import { sseBroadcaster, whoJobChannel } from './jobs/whoProgress.js';
import { listDossiers, readDossier } from './dossier/dossierStore.js';
import { getEntityIndex, listEntityIndex } from './dossier/entityIndex.js';
import { listWhoAudit, verifyWhoAudit } from './audit/whoAudit.js';
import { generateId } from '@ocrowley/persistence';
import {
  authorizeWhoRequest,
  operatorsRequired,
  publicOperator,
  whoAuthMode,
} from './auth/authorizeRequest.js';
import {
  ensureBootstrapOperator,
  mergeEnvOperators,
  operatorMayAccessCase,
  type ResolvedOperator,
} from './auth/whoOperators.js';

function reqAuth(req: IncomingMessage): {
  actorId: string;
  roles: string[];
  operator: ResolvedOperator | null;
} {
  const auth = (req as IncomingMessage & {
    ocrowleyAuth?: { actorId: string; roles: string[]; operator: ResolvedOperator | null };
  }).ocrowleyAuth;
  return {
    actorId: auth?.actorId || process.env.OCROWLEY_OSINT_ACTOR || 'local',
    roles: auth?.roles || ['osint-operator'],
    operator: auth?.operator ?? null,
  };
}

function assertCaseAcl(
  operator: ResolvedOperator | null,
  caseRef: string,
): { ok: true } | { ok: false; status: number; error: string; hint: string } {
  if (!operator || !caseRef) return { ok: true };
  if (operatorMayAccessCase(operator, caseRef)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: 'Case not permitted for this operator',
    hint: `Operator ${operator.id} cannot access case ${caseRef}`,
  };
}

// Ensure hosted bridge URLs are set when env is empty.
applyBridgeUrlDefaults();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface WhoApiSettings {
  caseRef: string;
  hibpApiKey: string;
  companiesHouseApiKey: string;
  deep: boolean;
  full: boolean;
  spiderfootUrl: string;
  bigbrotherBridgeUrl: string;
  spiderdashUrl: string;
  bridgeTimeoutMs: number;
  enableCliTools: boolean;
  purpose: string;
}

export interface WhoHttpServerOptions {
  host?: string;
  port?: number;
  /** Directory of static web assets (defaults to packages/osint/web). */
  webRoot?: string;
  /** When true, allow missing case in development only if OCROWLEY_OSINT_CASE is set. */
  requireCase?: boolean;
  /** Access PIN (defaults to OCROWLEY_WHO_PIN or 3123). */
  pin?: string;
  /** When false, skip PIN checks (tests only). Default true. */
  requirePin?: boolean;
}

/** Access PIN for the WHO shell + API. Override with OCROWLEY_WHO_PIN. */
export function configuredWhoPin(explicit?: string): string {
  return String(explicit || process.env.OCROWLEY_WHO_PIN || '3123').trim();
}

export function extractWhoPin(
  headers: IncomingMessage['headers'],
  bodyPin?: string,
): string {
  const header = headerValue(headers['x-ocrowley-who-pin']);
  if (header) return header.trim();
  const cookie = headerValue(headers.cookie);
  const m = cookie.match(/(?:^|;\s*)ocrowley_who_pin=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();
  return String(bodyPin || '').trim();
}

export function pinAuthorized(
  headers: IncomingMessage['headers'],
  bodyPin?: string,
  expected?: string,
): boolean {
  const got = extractWhoPin(headers, bodyPin);
  const want = configuredWhoPin(expected);
  return Boolean(want) && got === want;
}

const SETTINGS_ENV = [
  'HIBP_API_KEY',
  'COMPANIES_HOUSE_API_KEY',
  'OCROWLEY_SPIDERFOOT_URL',
  'OCROWLEY_BIGBROTHER_BRIDGE',
  'OCROWLEY_SPIDERDASH_URL',
  'OCROWLEY_BRIDGE_TIMEOUT_MS',
  'OCROWLEY_ENABLE_CLI_TOOLS',
] as const;

export function readSettings(): WhoApiSettings {
  applyBridgeUrlDefaults();
  return {
    caseRef: process.env.OCROWLEY_OSINT_CASE || '',
    hibpApiKey: process.env.HIBP_API_KEY || '',
    companiesHouseApiKey: process.env.COMPANIES_HOUSE_API_KEY || '',
    deep: process.env.OCROWLEY_OSINT_DEEP !== '0',
    full: process.env.OCROWLEY_OSINT_QUICK !== '1',
    spiderfootUrl: resolveSpiderfootUrl(),
    bigbrotherBridgeUrl: resolveBigbrotherUrl(),
    spiderdashUrl: resolveSpiderdashUrl(),
    bridgeTimeoutMs: bridgeTimeoutMs(),
    enableCliTools: process.env.OCROWLEY_ENABLE_CLI_TOOLS === '1',
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
  if (partial.full !== undefined) {
    process.env.OCROWLEY_OSINT_QUICK = partial.full ? '0' : '1';
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
  if (partial.spiderdashUrl !== undefined) {
    process.env.OCROWLEY_SPIDERDASH_URL = String(partial.spiderdashUrl).trim();
  }
  if (partial.bridgeTimeoutMs !== undefined) {
    process.env.OCROWLEY_BRIDGE_TIMEOUT_MS = String(partial.bridgeTimeoutMs);
  }
  if (partial.enableCliTools !== undefined) {
    process.env.OCROWLEY_ENABLE_CLI_TOOLS = partial.enableCliTools ? '1' : '0';
  }
  return readSettings();
}

export function publicSettings(s: WhoApiSettings = readSettings()) {
  const tools = reportToolkitAvailability({
    auth: {
      actorId: 'settings',
      roles: ['osint-operator'],
      authorizationRef: s.caseRef || 'settings',
      purpose: s.purpose,
    },
    darkwebAuth: s.deep
      ? {
          actorId: 'settings',
          roles: ['osint-operator'],
          authorizationRef: s.caseRef || 'settings',
          purpose: s.purpose,
          lawfulUseAcknowledged: true,
        }
      : undefined,
    enableCliTools: s.enableCliTools,
  });
  return {
    caseRef: s.caseRef,
    deep: s.deep,
    full: s.full,
    purpose: s.purpose,
    spiderfootUrl: s.spiderfootUrl,
    bigbrotherBridgeUrl: s.bigbrotherBridgeUrl,
    spiderdashUrl: s.spiderdashUrl,
    bridgeTimeoutMs: s.bridgeTimeoutMs,
    enableCliTools: s.enableCliTools,
    hibpConfigured: Boolean(s.hibpApiKey),
    companiesHouseConfigured: Boolean(s.companiesHouseApiKey),
    toolsReady: tools.liveCount,
    bridgesReady: tools.bridgeReadyCount,
    envHints: [...SETTINGS_ENV],
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
  const token = m?.[1]?.trim() || '';
  // Operator tokens (who_…) are not case refs — see auth/whoOperators.ts
  if (/^who_/i.test(token)) return '';
  return token;
}

export interface WhoRequestBody {
  q?: string;
  query?: string;
  input?: string;
  deep?: boolean;
  full?: boolean;
  archive?: boolean;
  case?: string;
  at?: string;
  in?: string;
  email?: string;
  username?: string;
  phone?: string;
  aka?: string | string[];
  country?: 'uk' | 'us' | 'other';
  format?: 'json' | 'text';
  enableCliTools?: boolean;
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
    full: body.full,
    archive: body.archive,
    enableCliTools: body.enableCliTools,
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
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-OCROWLEY-OSINT-CASE, X-OCROWLEY-WHO-PIN, X-OCROWLEY-WHO-TOKEN',
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
    toolsUsed: r.toolsUsed,
    toolsReady: r.toolsReady,
    archiveId: r.archiveId,
    recursive: r.recursive,
    classification: REPORT_CLASSIFICATION,
    spiderdash: whoToSpiderdashImport(r),
  };
}

export type WhoHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function createWhoApiHandler(opts: WhoHttpServerOptions = {}): WhoHandler {
  const webRoot = opts.webRoot || path.resolve(__dirname, '../web');
  const requireCase = opts.requireCase !== false;
  const requirePin = opts.requirePin !== false;
  const pin = configuredWhoPin(opts.pin);

  return async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-OCROWLEY-OSINT-CASE, X-OCROWLEY-WHO-PIN, X-OCROWLEY-WHO-TOKEN',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      });
      res.end();
      return;
    }

    try {
      if (pathname === '/api/health' && method === 'GET') {
        const { pingBigBrotherBridge } = await import('./bigbrotherBridge.js');
        const bb = await pingBigBrotherBridge();
        sendJson(res, 200, {
          ok: true,
          service: 'ocrowley-who',
          pinRequired: requirePin,
          caseConfigured: Boolean(process.env.OCROWLEY_OSINT_CASE?.trim()),
          worker: { running: isWhoWorkerRunning(), id: getWhoWorkerId() || null },
          authMode: whoAuthMode(),
          operatorsRequired: operatorsRequired(),
          bridges: {
            spiderdash: resolveSpiderdashUrl(),
            spiderfoot: resolveSpiderfootUrl(),
            bigbrother: resolveBigbrotherUrl(),
            bigbrotherReady: bb.ok,
            bigbrotherAvailable: bb.bigbrotherAvailable,
          },
        });
        return;
      }

      if (pathname === '/api/unlock' && method === 'POST') {
        const body = await readJsonBody(req);
        const candidate = extractWhoPin(req.headers, (body as { pin?: string }).pin);
        if (!requirePin || candidate === pin) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Set-Cookie': `ocrowley_who_pin=${encodeURIComponent(pin)}; Path=/; SameSite=Strict; HttpOnly`,
          });
          res.end(JSON.stringify({ ok: true, unlocked: true }));
          return;
        }
        sendJson(res, 401, { error: 'Invalid PIN', unlocked: false });
        return;
      }

      const apiPath = pathname.startsWith('/api/');

      if (pathname === '/api/auth/me' && method === 'GET') {
        const gate = await authorizeWhoRequest({
          headers: req.headers,
          requireCase: false,
          requirePin,
          pin,
          skipCaseAcl: true,
        });
        if (!gate.ok) {
          sendJson(res, gate.status, { error: gate.error, hint: gate.hint });
          return;
        }
        sendJson(res, 200, {
          mode: gate.auth.mode,
          operatorsRequired: operatorsRequired(),
          actorId: gate.auth.actorId,
          roles: gate.auth.roles,
          operator: gate.auth.operator ? publicOperator(gate.auth.operator) : null,
        });
        return;
      }

      // Unified PIN + optional operator gate (case ACL checked after body parse where needed)
      if (apiPath) {
        const gate = await authorizeWhoRequest({
          headers: req.headers,
          requireCase: false,
          requirePin,
          pin,
          skipCaseAcl: true,
        });
        if (!gate.ok) {
          sendJson(res, gate.status, { error: gate.error, hint: gate.hint });
          return;
        }
        (req as IncomingMessage & { ocrowleyAuth?: typeof gate.auth }).ocrowleyAuth = gate.auth;
      }

      if (pathname === '/api/settings' && method === 'GET') {
        sendJson(res, 200, { ...publicSettings(), authMode: whoAuthMode() });
        return;
      }

      if (pathname === '/api/settings' && method === 'PUT') {
        const body = (await readJsonBody(req)) as Partial<WhoApiSettings> & WhoRequestBody;
        const next = applySettings({
          caseRef: body.caseRef ?? body.case,
          hibpApiKey: (body as Partial<WhoApiSettings>).hibpApiKey,
          companiesHouseApiKey: (body as Partial<WhoApiSettings>).companiesHouseApiKey,
          deep: body.deep,
          full: (body as Partial<WhoApiSettings>).full ?? body.full,
          spiderfootUrl: (body as Partial<WhoApiSettings>).spiderfootUrl,
          bigbrotherBridgeUrl: (body as Partial<WhoApiSettings>).bigbrotherBridgeUrl,
          spiderdashUrl: (body as Partial<WhoApiSettings>).spiderdashUrl,
          bridgeTimeoutMs: (body as Partial<WhoApiSettings>).bridgeTimeoutMs,
          enableCliTools: (body as Partial<WhoApiSettings>).enableCliTools ?? body.enableCliTools,
          purpose: (body as Partial<WhoApiSettings>).purpose,
        });
        sendJson(res, 200, publicSettings(next));
        return;
      }

      if (pathname === '/api/tools' && method === 'GET') {
        sendJson(res, 200, publicSettings());
        return;
      }

      if (pathname === '/api/archive' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 40);
        sendJson(res, 200, { entries: await listWhoArchive(limit) });
        return;
      }

      if (pathname.startsWith('/api/archive/') && method === 'GET') {
        const id = pathname.slice('/api/archive/'.length);
        const entry = await readWhoArchive(id);
        if (!entry) {
          sendJson(res, 404, { error: 'Archive entry not found' });
          return;
        }
        sendJson(res, 200, entry);
        return;
      }

      // --- Async WHO jobs (nuclear Phase 1) ---
      if (pathname === '/api/who/jobs' && method === 'POST') {
        const body = await readJsonBody(req);
        const q = (body.q || body.query || body.input || '').trim();
        const caseRef = resolveCaseRef(req.headers, body.case, undefined);
        const { actorId, operator } = reqAuth(req);
        if (requireCase && !caseRef) {
          sendJson(res, 401, {
            error: 'Case authorization required',
            hint: 'Set OCROWLEY_OSINT_CASE, or send X-OCROWLEY-OSINT-CASE / body.case',
          });
          return;
        }
        const acl = assertCaseAcl(operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
          return;
        }
        if (!q) {
          sendJson(res, 400, { error: 'Missing query', hint: 'Pass q in JSON body' });
          return;
        }
        const job = await enqueueWhoJob({
          q,
          caseRef: caseRef || 'local-dev',
          deep: body.deep,
          full: body.full,
          archive: body.archive,
          at: body.at,
          in: body.in,
          email: body.email,
          username: body.username,
          phone: body.phone,
          aka: body.aka,
          country: body.country,
          enableCliTools: body.enableCliTools,
          actorId,
        });
        sendJson(res, 202, {
          accepted: true,
          jobId: job.id,
          status: job.status,
          poll: `/api/who/jobs/${job.id}`,
          job: publicWhoJob(job),
        });
        return;
      }

      if (pathname === '/api/who/jobs' && method === 'GET') {
        const caseRef = resolveCaseRef(
          req.headers,
          undefined,
          url.searchParams.get('case') || undefined,
        );
        const limit = Number(url.searchParams.get('limit') || 40);
        const jobs = await listWhoJobs({
          caseRef: caseRef || undefined,
          limit,
        });
        sendJson(res, 200, { jobs: jobs.map(publicWhoJob) });
        return;
      }

      if (pathname.startsWith('/api/who/jobs/') && (method === 'GET' || method === 'POST')) {
        const rest = pathname.slice('/api/who/jobs/'.length);
        const [id, action] = rest.split('/');
        if (!id) {
          sendJson(res, 404, { error: 'Job not found' });
          return;
        }

        if (method === 'GET' && action === 'events') {
          const job = await getWhoJob(id);
          if (!job) {
            sendJson(res, 404, { error: 'Job not found' });
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(`event: hello\ndata: ${JSON.stringify({ jobId: id, status: job.status })}\n\n`);
          const clientId = generateId();
          const unsub = sseBroadcaster.subscribe(whoJobChannel(id), {
            id: clientId,
            write: (chunk) => {
              try {
                res.write(chunk);
              } catch {
                /* closed */
              }
            },
          });
          // Snapshot current status as progress event
          res.write(
            `event: progress\ndata: ${JSON.stringify({
              jobId: id,
              status: job.status,
              currentStage: job.currentStage,
              at: new Date().toISOString(),
            })}\n\n`,
          );
          const keepAlive = setInterval(() => {
            try {
              res.write(': keepalive\n\n');
            } catch {
              clearInterval(keepAlive);
            }
          }, 15000);
          req.on('close', () => {
            clearInterval(keepAlive);
            unsub();
          });
          return;
        }

        if (method === 'POST' && action === 'retry') {
          const job = await retryWhoJob(id);
          if (!job) {
            sendJson(res, 404, { error: 'Job not found' });
            return;
          }
          sendJson(res, 200, { retried: true, job: publicWhoJob(job) });
          return;
        }

        if (method === 'POST' && action === 'cancel') {
          const body = await readJsonBody(req);
          const job = await cancelWhoJob(
            id,
            typeof (body as { reason?: string }).reason === 'string'
              ? (body as { reason: string }).reason
              : undefined,
          );
          if (!job) {
            sendJson(res, 404, { error: 'Job not found' });
            return;
          }
          sendJson(res, 200, { cancelled: true, job: publicWhoJob(job) });
          return;
        }

        if (method === 'GET' && !action) {
          const job = await getWhoJob(id);
          if (!job) {
            sendJson(res, 404, { error: 'Job not found' });
            return;
          }
          sendJson(res, 200, publicWhoJob(job));
          return;
        }

        sendJson(res, 404, { error: 'Not found', path: pathname });
        return;
      }

      if (pathname === '/api/entities' && method === 'GET') {
        const caseRef = resolveCaseRef(
          req.headers,
          undefined,
          url.searchParams.get('case') || undefined,
        );
        const acl = assertCaseAcl(reqAuth(req).operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
          return;
        }
        const limit = Number(url.searchParams.get('limit') || 40);
        const q = url.searchParams.get('q') || undefined;
        sendJson(res, 200, {
          entries: await listEntityIndex({ caseRef: caseRef || undefined, limit, q }),
        });
        return;
      }

      if (pathname.startsWith('/api/entities/') && method === 'GET') {
        const entityId = pathname.slice('/api/entities/'.length);
        const caseRef = resolveCaseRef(
          req.headers,
          undefined,
          url.searchParams.get('case') || undefined,
        );
        if (!caseRef) {
          sendJson(res, 401, { error: 'Case authorization required to read entities' });
          return;
        }
        const acl = assertCaseAcl(reqAuth(req).operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
          return;
        }
        const entry = await getEntityIndex(caseRef, entityId);
        if (!entry) {
          sendJson(res, 404, { error: 'Entity not found' });
          return;
        }
        sendJson(res, 200, entry);
        return;
      }

      if (pathname === '/api/dossiers' && method === 'GET') {
        const caseRef = resolveCaseRef(
          req.headers,
          undefined,
          url.searchParams.get('case') || undefined,
        );
        const acl = assertCaseAcl(reqAuth(req).operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
          return;
        }
        const limit = Number(url.searchParams.get('limit') || 40);
        sendJson(res, 200, {
          entries: await listDossiers({ caseRef: caseRef || undefined, limit }),
        });
        return;
      }

      if (pathname.startsWith('/api/dossiers/') && method === 'GET') {
        const id = pathname.slice('/api/dossiers/'.length);
        const caseRef = resolveCaseRef(
          req.headers,
          undefined,
          url.searchParams.get('case') || undefined,
        );
        if (!caseRef) {
          sendJson(res, 401, { error: 'Case authorization required to read dossiers' });
          return;
        }
        const acl = assertCaseAcl(reqAuth(req).operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
          return;
        }
        const entry = await readDossier(caseRef, id);
        if (!entry) {
          sendJson(res, 404, { error: 'Dossier not found' });
          return;
        }
        sendJson(res, 200, entry);
        return;
      }

      if (pathname === '/api/audit' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 50);
        const verify = url.searchParams.get('verify') === '1';
        const entries = await listWhoAudit(limit);
        sendJson(res, 200, {
          entries,
          ...(verify ? { verification: await verifyWhoAudit() } : {}),
        });
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
        const { operator } = reqAuth(req);
        const acl = assertCaseAcl(operator, caseRef);
        if (!acl.ok) {
          sendJson(res, acl.status, { error: acl.error, hint: acl.hint });
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
        const fullParam = url.searchParams.get('full');
        const deep =
          body.deep === true ||
          deepParam === '1' ||
          deepParam === 'true' ||
          (body.deep === undefined && deepParam === null ? undefined : false);
        const full =
          body.full === false || fullParam === '0' || fullParam === 'false'
            ? false
            : body.full === true || fullParam === '1' || fullParam === 'true'
              ? true
              : undefined;

        const hints = buildHints(
          {
            ...body,
            deep: deep === undefined ? body.deep : deep,
            full,
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
  bootstrapToken?: string;
}> {
  const { ensureWhoDataDir } = await import('./jobs/whoWorker.js');
  ensureWhoDataDir();
  await mergeEnvOperators();
  let bootstrapToken: string | undefined;
  if (operatorsRequired()) {
    const boot = await ensureBootstrapOperator();
    if (boot.created) bootstrapToken = boot.token;
  }

  const host = opts.host || process.env.OCROWLEY_WHO_HOST || '127.0.0.1';
  const port = opts.port ?? Number(process.env.OCROWLEY_WHO_PORT || 8787);
  const server = createWhoServer(opts);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  return { server, host, port, url: `http://${host}:${port}`, bootstrapToken };
}
