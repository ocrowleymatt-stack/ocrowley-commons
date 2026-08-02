/**
 * Operator token auth + case ACL (nuclear Phase 3).
 *
 * Modes (OCROWLEY_WHO_AUTH):
 *   pin            — legacy PIN only (default)
 *   operators      — require operator token; PIN optional for web cookie unlock
 *   pin+operators  — require PIN and operator token on API
 *
 * Tokens: header X-OCROWLEY-WHO-TOKEN, or Authorization: Bearer who_<token>
 * Storage: $OCROWLEY_DATA_DIR/who-operators.json (hashed tokens only)
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '@ocrowley/persistence';

export type WhoOperatorRole = 'osint-operator' | 'investigator' | 'counsel' | 'viewer' | 'admin';

export type WhoAuthMode = 'pin' | 'operators' | 'pin+operators';

export interface WhoOperatorRecord {
  id: string;
  name: string;
  /** sha256 hex of token */
  tokenHash: string;
  roles: WhoOperatorRole[];
  /** Case refs this operator may use, or ['*'] for all */
  cases: string[];
  disabled?: boolean;
  createdAt: string;
}

export interface WhoOperatorsFile {
  version: 1;
  operators: WhoOperatorRecord[];
  updatedAt: string;
}

export interface ResolvedOperator {
  id: string;
  name: string;
  roles: WhoOperatorRole[];
  cases: string[];
}

let cache: WhoOperatorsFile | null = null;

export function whoAuthMode(): WhoAuthMode {
  const raw = (process.env.OCROWLEY_WHO_AUTH || 'pin').trim().toLowerCase();
  if (raw === 'operators' || raw === 'operator') return 'operators';
  if (raw === 'pin+operators' || raw === 'pin+operator' || raw === 'both') return 'pin+operators';
  return 'pin';
}

export function operatorsRequired(): boolean {
  const mode = whoAuthMode();
  return mode === 'operators' || mode === 'pin+operators';
}

export function pinStillRequired(): boolean {
  const mode = whoAuthMode();
  return mode === 'pin' || mode === 'pin+operators';
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function operatorsPath(): string {
  return path.join(getConfig().dataDir, 'who-operators.json');
}

export async function loadOperators(force = false): Promise<WhoOperatorsFile> {
  if (cache && !force) return cache;
  try {
    const raw = await readFile(operatorsPath(), 'utf8');
    cache = JSON.parse(raw) as WhoOperatorsFile;
    return cache;
  } catch {
    cache = { version: 1, operators: [], updatedAt: new Date().toISOString() };
    return cache;
  }
}

export async function saveOperators(file: WhoOperatorsFile): Promise<void> {
  const dir = getConfig().dataDir;
  await mkdir(dir, { recursive: true });
  file.updatedAt = new Date().toISOString();
  const tmp = `${operatorsPath()}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), 'utf8');
  const fs = await import('node:fs/promises');
  await fs.rename(tmp, operatorsPath());
  cache = file;
}

export function generateOperatorToken(): string {
  return `who_${randomBytes(24).toString('base64url')}`;
}

/** Bootstrap a default admin operator if none exist. Returns plaintext token once. */
export async function ensureBootstrapOperator(): Promise<{ created: boolean; token?: string; operator?: ResolvedOperator }> {
  const file = await loadOperators(true);
  if (file.operators.length > 0) {
    return { created: false };
  }
  const token = process.env.OCROWLEY_WHO_BOOTSTRAP_TOKEN?.trim() || generateOperatorToken();
  const op: WhoOperatorRecord = {
    id: 'op_admin',
    name: 'Bootstrap Admin',
    tokenHash: hashToken(token),
    roles: ['admin', 'osint-operator', 'investigator'],
    cases: ['*'],
    createdAt: new Date().toISOString(),
  };
  file.operators.push(op);
  await saveOperators(file);
  return {
    created: true,
    token,
    operator: { id: op.id, name: op.name, roles: op.roles, cases: op.cases },
  };
}

export function extractOperatorToken(
  headers: Record<string, string | string[] | undefined>,
): string {
  const header = headerValue(headers['x-ocrowley-who-token']);
  if (header) return header.trim();
  const auth = headerValue(headers.authorization);
  const m = auth.match(/^Bearer\s+(who_[A-Za-z0-9_-]+)$/i);
  if (m?.[1]) return m[1];
  return '';
}

function headerValue(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] || '' : v;
}

function hashesEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length || ab.length === 0) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function resolveOperator(token: string): Promise<ResolvedOperator | null> {
  if (!token) return null;
  const file = await loadOperators();
  const want = hashToken(token);
  for (const op of file.operators) {
    if (op.disabled) continue;
    if (!hashesEqual(op.tokenHash, want)) continue;
    return { id: op.id, name: op.name, roles: op.roles, cases: op.cases };
  }
  return null;
}

export function operatorMayAccessCase(op: ResolvedOperator, caseRef: string): boolean {
  if (!caseRef.trim()) return false;
  if (op.cases.includes('*')) return true;
  return op.cases.some((c) => c === caseRef);
}

export function publicOperator(op: ResolvedOperator) {
  return {
    id: op.id,
    name: op.name,
    roles: op.roles,
    cases: op.cases,
  };
}

/** Env-based operators: OCROWLEY_WHO_OPERATORS='[{"id":"…","token":"who_…","roles":[…],"cases":["*"]}]' */
export async function mergeEnvOperators(): Promise<void> {
  const raw = process.env.OCROWLEY_WHO_OPERATORS?.trim();
  if (!raw) return;
  let parsed: Array<{
    id: string;
    name?: string;
    token: string;
    roles?: WhoOperatorRole[];
    cases?: string[];
  }>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const file = await loadOperators(true);
  for (const row of parsed) {
    if (!row.id || !row.token) continue;
    const existing = file.operators.find((o) => o.id === row.id);
    const record: WhoOperatorRecord = {
      id: row.id,
      name: row.name || row.id,
      tokenHash: hashToken(row.token),
      roles: row.roles?.length ? row.roles : ['osint-operator'],
      cases: row.cases?.length ? row.cases : ['*'],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      file.operators.push(record);
    }
  }
  await saveOperators(file);
}
