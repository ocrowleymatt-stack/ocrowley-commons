import { readJsonFile, writeJsonFile, listJsonFiles, generateId } from '@ocrowley/persistence';
import { decrypt, encrypt, isEncrypted } from '@ocrowley/crypto';
import type { Dossier } from '../types.js';
import { dossierEntityId, sanitizeCasePath } from './fromWhoResult.js';
import { ensureMigrated, isPostgresEnabled, pgQuery } from '../db/pg.js';

export interface StoredDossier {
  id: string;
  caseRef: string;
  entityId: string;
  savedAt: string;
  jobId?: string;
  archiveId?: string;
  /** When ENCRYPTION_MASTER_KEY is set, dossier body is stored encrypted. */
  encrypted: boolean;
  dossier?: Dossier & { caseRef: string; classification: string; warning: string };
  ciphertext?: string;
}

export type DossierBody = Dossier & { caseRef: string; classification: string; warning: string };

const ROOT = 'who-dossiers';

function encryptionEnabled(): boolean {
  const key = process.env.ENCRYPTION_MASTER_KEY || '';
  return key.length >= 64;
}

function dualWrite(): boolean {
  return process.env.OCROWLEY_WHO_DUAL_WRITE === '1';
}

function caseDir(caseRef: string): string {
  return `${ROOT}/${sanitizeCasePath(caseRef)}`;
}

function buildRecord(input: {
  caseRef: string;
  dossier: DossierBody;
  jobId?: string;
  archiveId?: string;
}): StoredDossier {
  const entityId =
    input.dossier.entity.id ||
    dossierEntityId(input.caseRef, input.dossier.entity.value, input.dossier.entity.value);
  const id = `${entityId}-${generateId().slice(0, 8)}`;
  const savedAt = new Date().toISOString();
  const useCrypto = encryptionEnabled();
  const record: StoredDossier = {
    id,
    caseRef: input.caseRef,
    entityId,
    savedAt,
    jobId: input.jobId,
    archiveId: input.archiveId,
    encrypted: useCrypto,
  };
  if (useCrypto) {
    record.ciphertext = encrypt(JSON.stringify(input.dossier));
  } else {
    record.dossier = input.dossier;
  }
  return record;
}

async function writeDossierJson(record: StoredDossier): Promise<void> {
  await writeJsonFile(caseDir(record.caseRef), `${record.id}.json`, record);
}

async function writeDossierPg(record: StoredDossier): Promise<void> {
  await ensureMigrated();
  await pgQuery(
    `INSERT INTO who_dossiers
      (id, case_ref, entity_id, saved_at, job_id, archive_id, encrypted, dossier, ciphertext)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     ON CONFLICT (id) DO UPDATE SET
       case_ref = EXCLUDED.case_ref,
       entity_id = EXCLUDED.entity_id,
       saved_at = EXCLUDED.saved_at,
       job_id = EXCLUDED.job_id,
       archive_id = EXCLUDED.archive_id,
       encrypted = EXCLUDED.encrypted,
       dossier = EXCLUDED.dossier,
       ciphertext = EXCLUDED.ciphertext`,
    [
      record.id,
      record.caseRef,
      record.entityId,
      record.savedAt,
      record.jobId ?? null,
      record.archiveId ?? null,
      record.encrypted,
      record.dossier ? JSON.stringify(record.dossier) : null,
      record.ciphertext ?? null,
    ],
  );
}

export async function writeDossier(input: {
  caseRef: string;
  dossier: DossierBody;
  jobId?: string;
  archiveId?: string;
}): Promise<StoredDossier> {
  const record = buildRecord(input);
  if (isPostgresEnabled()) {
    await writeDossierPg(record);
    if (dualWrite()) await writeDossierJson(record);
  } else {
    await writeDossierJson(record);
  }
  return record;
}

function hydrate(
  raw: StoredDossier,
): (StoredDossier & { dossier: DossierBody }) | null {
  if (raw.encrypted && raw.ciphertext) {
    if (!encryptionEnabled()) {
      throw Object.assign(new Error('Dossier is encrypted; set ENCRYPTION_MASTER_KEY'), {
        statusCode: 503,
      });
    }
    const plain = decrypt(raw.ciphertext);
    const dossier = JSON.parse(plain) as DossierBody;
    return { ...raw, dossier };
  }
  if (!raw.dossier) return null;
  return { ...raw, dossier: raw.dossier };
}

async function readDossierJson(
  caseRef: string,
  id: string,
): Promise<(StoredDossier & { dossier: DossierBody }) | null> {
  const raw = await readJsonFile<StoredDossier>(caseDir(caseRef), `${id}.json`);
  if (!raw) return null;
  return hydrate(raw);
}

async function readDossierPg(
  caseRef: string,
  id: string,
): Promise<(StoredDossier & { dossier: DossierBody }) | null> {
  await ensureMigrated();
  const r = await pgQuery<{
    id: string;
    case_ref: string;
    entity_id: string;
    saved_at: Date;
    job_id: string | null;
    archive_id: string | null;
    encrypted: boolean;
    dossier: DossierBody | null;
    ciphertext: string | null;
  }>(
    `SELECT id, case_ref, entity_id, saved_at, job_id, archive_id, encrypted, dossier, ciphertext
     FROM who_dossiers WHERE id = $1 AND case_ref = $2`,
    [id, caseRef],
  );
  const row = r.rows[0];
  if (!row) return null;
  return hydrate({
    id: row.id,
    caseRef: row.case_ref,
    entityId: row.entity_id,
    savedAt: new Date(row.saved_at).toISOString(),
    jobId: row.job_id ?? undefined,
    archiveId: row.archive_id ?? undefined,
    encrypted: row.encrypted,
    dossier: row.dossier ?? undefined,
    ciphertext: row.ciphertext ?? undefined,
  });
}

export async function readDossier(
  caseRef: string,
  id: string,
): Promise<(StoredDossier & { dossier: DossierBody }) | null> {
  if (isPostgresEnabled()) {
    const fromPg = await readDossierPg(caseRef, id);
    if (fromPg) return fromPg;
    // fallback to JSON if dual-written historically
    return readDossierJson(caseRef, id);
  }
  return readDossierJson(caseRef, id);
}

export async function listDossiers(opts?: {
  caseRef?: string;
  limit?: number;
  entityId?: string;
}): Promise<Array<Pick<StoredDossier, 'id' | 'caseRef' | 'entityId' | 'savedAt' | 'jobId' | 'archiveId' | 'encrypted'>>> {
  const limit = Math.max(1, opts?.limit ?? 40);
  if (isPostgresEnabled()) {
    await ensureMigrated();
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.caseRef) {
      params.push(opts.caseRef);
      where.push(`case_ref = $${params.length}`);
    }
    if (opts?.entityId) {
      params.push(opts.entityId);
      where.push(`entity_id = $${params.length}`);
    }
    params.push(limit);
    const sql = `SELECT id, case_ref, entity_id, saved_at, job_id, archive_id, encrypted
      FROM who_dossiers
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY saved_at DESC
      LIMIT $${params.length}`;
    const r = await pgQuery<{
      id: string;
      case_ref: string;
      entity_id: string;
      saved_at: Date;
      job_id: string | null;
      archive_id: string | null;
      encrypted: boolean;
    }>(sql, params);
    return r.rows.map((row) => ({
      id: row.id,
      caseRef: row.case_ref,
      entityId: row.entity_id,
      savedAt: new Date(row.saved_at).toISOString(),
      jobId: row.job_id ?? undefined,
      archiveId: row.archive_id ?? undefined,
      encrypted: row.encrypted,
    }));
  }

  const cases = opts?.caseRef ? [sanitizeCasePath(opts.caseRef)] : await listCaseDirs();
  const out: Array<Pick<StoredDossier, 'id' | 'caseRef' | 'entityId' | 'savedAt' | 'jobId' | 'archiveId' | 'encrypted'>> = [];
  for (const c of cases) {
    const files = await listJsonFiles(`${ROOT}/${c}`);
    for (const file of files) {
      const entry = await readJsonFile<StoredDossier>(`${ROOT}/${c}`, file);
      if (!entry) continue;
      if (opts?.caseRef && entry.caseRef !== opts.caseRef) continue;
      if (opts?.entityId && entry.entityId !== opts.entityId) continue;
      out.push({
        id: entry.id,
        caseRef: entry.caseRef,
        entityId: entry.entityId,
        savedAt: entry.savedAt,
        jobId: entry.jobId,
        archiveId: entry.archiveId,
        encrypted: entry.encrypted,
      });
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, limit);
}

async function listCaseDirs(): Promise<string[]> {
  const { getConfig } = await import('@ocrowley/persistence');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.join(getConfig().dataDir, ROOT);
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export { isEncrypted };
