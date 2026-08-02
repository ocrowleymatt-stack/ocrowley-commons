/**
 * Entity index — case+entity → latest dossier.
 * JSON local-first; Postgres+pg_trgm when DATABASE_URL is set (Phase 4).
 */

import { listJsonFiles, readJsonFile, writeJsonFile } from '@ocrowley/persistence';
import { sanitizeCasePath } from './fromWhoResult.js';
import { ensureMigrated, isPostgresEnabled, pgQuery } from '../db/pg.js';

export interface EntityIndexEntry {
  entityId: string;
  caseRef: string;
  value: string;
  type: string;
  latestDossierId: string;
  dossierIds: string[];
  jobIds: string[];
  updatedAt: string;
  stats?: { confirmed: number; likely: number; possible: number; checked: number };
  /** Similarity score when using Postgres trigram search */
  score?: number;
}

const ROOT = 'who-entities';

function entityDir(caseRef: string): string {
  return `${ROOT}/${sanitizeCasePath(caseRef)}`;
}

function dualWrite(): boolean {
  return process.env.OCROWLEY_WHO_DUAL_WRITE === '1';
}

async function upsertEntityJson(entry: EntityIndexEntry): Promise<void> {
  await writeJsonFile(entityDir(entry.caseRef), `${entry.entityId}.json`, entry);
}

async function upsertEntityPg(entry: EntityIndexEntry): Promise<void> {
  await ensureMigrated();
  await pgQuery(
    `INSERT INTO who_entities
      (entity_id, case_ref, value, type, latest_dossier_id, dossier_ids, job_ids, stats, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
     ON CONFLICT (case_ref, entity_id) DO UPDATE SET
       value = EXCLUDED.value,
       type = EXCLUDED.type,
       latest_dossier_id = EXCLUDED.latest_dossier_id,
       dossier_ids = EXCLUDED.dossier_ids,
       job_ids = EXCLUDED.job_ids,
       stats = EXCLUDED.stats,
       updated_at = EXCLUDED.updated_at`,
    [
      entry.entityId,
      entry.caseRef,
      entry.value,
      entry.type,
      entry.latestDossierId,
      JSON.stringify(entry.dossierIds),
      JSON.stringify(entry.jobIds),
      entry.stats ? JSON.stringify(entry.stats) : null,
      entry.updatedAt,
    ],
  );
}

export async function upsertEntityIndex(input: {
  caseRef: string;
  entityId: string;
  value: string;
  type: string;
  dossierId: string;
  jobId?: string;
  stats?: EntityIndexEntry['stats'];
}): Promise<EntityIndexEntry> {
  const prev = await getEntityIndex(input.caseRef, input.entityId);
  const dossierIds = prev?.dossierIds?.includes(input.dossierId)
    ? prev.dossierIds
    : [...(prev?.dossierIds ?? []), input.dossierId];
  const jobIds =
    input.jobId && !prev?.jobIds?.includes(input.jobId)
      ? [...(prev?.jobIds ?? []), input.jobId]
      : prev?.jobIds ?? (input.jobId ? [input.jobId] : []);

  const entry: EntityIndexEntry = {
    entityId: input.entityId,
    caseRef: input.caseRef,
    value: input.value,
    type: input.type,
    latestDossierId: input.dossierId,
    dossierIds,
    jobIds,
    updatedAt: new Date().toISOString(),
    stats: input.stats ?? prev?.stats,
  };

  if (isPostgresEnabled()) {
    await upsertEntityPg(entry);
    if (dualWrite()) await upsertEntityJson(entry);
  } else {
    await upsertEntityJson(entry);
  }
  return entry;
}

export async function getEntityIndex(
  caseRef: string,
  entityId: string,
): Promise<EntityIndexEntry | null> {
  if (isPostgresEnabled()) {
    await ensureMigrated();
    const r = await pgQuery<{
      entity_id: string;
      case_ref: string;
      value: string;
      type: string;
      latest_dossier_id: string;
      dossier_ids: string[];
      job_ids: string[];
      stats: EntityIndexEntry['stats'] | null;
      updated_at: Date;
    }>(
      `SELECT entity_id, case_ref, value, type, latest_dossier_id, dossier_ids, job_ids, stats, updated_at
       FROM who_entities WHERE case_ref = $1 AND entity_id = $2`,
      [caseRef, entityId],
    );
    const row = r.rows[0];
    if (row) {
      return {
        entityId: row.entity_id,
        caseRef: row.case_ref,
        value: row.value,
        type: row.type,
        latestDossierId: row.latest_dossier_id,
        dossierIds: row.dossier_ids ?? [],
        jobIds: row.job_ids ?? [],
        updatedAt: new Date(row.updated_at).toISOString(),
        stats: row.stats ?? undefined,
      };
    }
  }
  return readJsonFile<EntityIndexEntry>(entityDir(caseRef), `${entityId}.json`);
}

export async function listEntityIndex(opts?: {
  caseRef?: string;
  limit?: number;
  q?: string;
}): Promise<EntityIndexEntry[]> {
  const limit = Math.max(1, opts?.limit ?? 40);
  const q = opts?.q?.trim();

  if (isPostgresEnabled()) {
    await ensureMigrated();
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.caseRef) {
      params.push(opts.caseRef);
      where.push(`case_ref = $${params.length}`);
    }
    if (q) {
      params.push(q);
      // trigram similarity + ILIKE for short prefixes
      where.push(
        `(value ILIKE '%' || $${params.length} || '%' OR similarity(value, $${params.length}) > 0.15)`,
      );
    }
    const qParamIndex = q ? params.length : null; // q already pushed above when present
    params.push(limit);
    const orderSql =
      qParamIndex !== null
        ? `ORDER BY similarity(value, $${qParamIndex}) DESC NULLS LAST, updated_at DESC`
        : `ORDER BY updated_at DESC`;

    const sql = `SELECT entity_id, case_ref, value, type, latest_dossier_id, dossier_ids, job_ids, stats, updated_at
      ${qParamIndex !== null ? `, similarity(value, $${qParamIndex}) AS score` : ', NULL::float8 AS score'}
      FROM who_entities
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ${orderSql}
      LIMIT $${params.length}`;

    const r = await pgQuery<{
      entity_id: string;
      case_ref: string;
      value: string;
      type: string;
      latest_dossier_id: string;
      dossier_ids: string[];
      job_ids: string[];
      stats: EntityIndexEntry['stats'] | null;
      updated_at: Date;
      score: number | null;
    }>(sql, params);

    return r.rows.map((row) => ({
      entityId: row.entity_id,
      caseRef: row.case_ref,
      value: row.value,
      type: row.type,
      latestDossierId: row.latest_dossier_id,
      dossierIds: row.dossier_ids ?? [],
      jobIds: row.job_ids ?? [],
      updatedAt: new Date(row.updated_at).toISOString(),
      stats: row.stats ?? undefined,
      score: row.score ?? undefined,
    }));
  }

  const qLower = q?.toLowerCase();
  const cases = opts?.caseRef ? [sanitizeCasePath(opts.caseRef)] : await listEntityCaseDirs();
  const out: EntityIndexEntry[] = [];
  for (const c of cases) {
    const files = await listJsonFiles(`${ROOT}/${c}`);
    for (const file of files) {
      const entry = await readJsonFile<EntityIndexEntry>(`${ROOT}/${c}`, file);
      if (!entry) continue;
      if (opts?.caseRef && entry.caseRef !== opts.caseRef) continue;
      if (
        qLower &&
        !entry.value.toLowerCase().includes(qLower) &&
        !entry.entityId.includes(qLower)
      ) {
        continue;
      }
      out.push(entry);
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/** Fuse related entities in a case (shared dossier graph edges by value tokens). */
export async function fuseCaseEntities(opts: {
  caseRef: string;
  entityId: string;
  limit?: number;
}): Promise<EntityIndexEntry[]> {
  const self = await getEntityIndex(opts.caseRef, opts.entityId);
  if (!self) return [];
  const tokens = self.value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  if (isPostgresEnabled()) {
    await ensureMigrated();
    const limit = Math.max(1, opts.limit ?? 20);
    const r = await pgQuery<{
      entity_id: string;
      case_ref: string;
      value: string;
      type: string;
      latest_dossier_id: string;
      dossier_ids: string[];
      job_ids: string[];
      stats: EntityIndexEntry['stats'] | null;
      updated_at: Date;
      score: number;
    }>(
      `SELECT entity_id, case_ref, value, type, latest_dossier_id, dossier_ids, job_ids, stats, updated_at,
              similarity(value, $2) AS score
       FROM who_entities
       WHERE case_ref = $1 AND entity_id <> $3
         AND (similarity(value, $2) > 0.2 OR value ILIKE '%' || $4 || '%')
       ORDER BY score DESC
       LIMIT $5`,
      [opts.caseRef, self.value, opts.entityId, tokens[0], limit],
    );
    return r.rows.map((row) => ({
      entityId: row.entity_id,
      caseRef: row.case_ref,
      value: row.value,
      type: row.type,
      latestDossierId: row.latest_dossier_id,
      dossierIds: row.dossier_ids ?? [],
      jobIds: row.job_ids ?? [],
      updatedAt: new Date(row.updated_at).toISOString(),
      stats: row.stats ?? undefined,
      score: row.score,
    }));
  }

  const all = await listEntityIndex({ caseRef: opts.caseRef, limit: 200 });
  return all
    .filter((e) => e.entityId !== opts.entityId)
    .filter((e) => tokens.some((t) => e.value.toLowerCase().includes(t)))
    .slice(0, opts.limit ?? 20);
}

async function listEntityCaseDirs(): Promise<string[]> {
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
