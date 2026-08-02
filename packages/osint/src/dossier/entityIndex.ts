/**
 * Lightweight entity index — latest dossier pointer per case+entity.
 * Local-first JSON; precursor to Postgres/pgvector fusion.
 */

import { listJsonFiles, readJsonFile, writeJsonFile } from '@ocrowley/persistence';
import { sanitizeCasePath } from './fromWhoResult.js';

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
}

const ROOT = 'who-entities';

function entityDir(caseRef: string): string {
  return `${ROOT}/${sanitizeCasePath(caseRef)}`;
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
  const prev = await readJsonFile<EntityIndexEntry>(
    entityDir(input.caseRef),
    `${input.entityId}.json`,
  );
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
  await writeJsonFile(entityDir(input.caseRef), `${input.entityId}.json`, entry);
  return entry;
}

export async function getEntityIndex(
  caseRef: string,
  entityId: string,
): Promise<EntityIndexEntry | null> {
  return readJsonFile<EntityIndexEntry>(entityDir(caseRef), `${entityId}.json`);
}

export async function listEntityIndex(opts?: {
  caseRef?: string;
  limit?: number;
  q?: string;
}): Promise<EntityIndexEntry[]> {
  const limit = opts?.limit ?? 40;
  const q = opts?.q?.trim().toLowerCase();
  const cases = opts?.caseRef
    ? [sanitizeCasePath(opts.caseRef)]
    : await listEntityCaseDirs();

  const out: EntityIndexEntry[] = [];
  for (const c of cases) {
    const files = await listJsonFiles(`${ROOT}/${c}`);
    for (const file of files) {
      const entry = await readJsonFile<EntityIndexEntry>(`${ROOT}/${c}`, file);
      if (!entry) continue;
      if (opts?.caseRef && entry.caseRef !== opts.caseRef) continue;
      if (q && !entry.value.toLowerCase().includes(q) && !entry.entityId.includes(q)) continue;
      out.push(entry);
    }
  }
  return out
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, limit));
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
