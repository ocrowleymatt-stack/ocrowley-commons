import { readJsonFile, writeJsonFile, listJsonFiles, generateId } from '@ocrowley/persistence';
import {
  decrypt,
  encrypt,
  isEncrypted,
} from '@ocrowley/crypto';
import type { Dossier } from '../types.js';
import { dossierEntityId, sanitizeCasePath } from './fromWhoResult.js';

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

const ROOT = 'who-dossiers';

function encryptionEnabled(): boolean {
  const key = process.env.ENCRYPTION_MASTER_KEY || '';
  return key.length >= 64;
}

function caseDir(caseRef: string): string {
  return `${ROOT}/${sanitizeCasePath(caseRef)}`;
}

export async function writeDossier(input: {
  caseRef: string;
  dossier: Dossier & { caseRef: string; classification: string; warning: string };
  jobId?: string;
  archiveId?: string;
}): Promise<StoredDossier> {
  const entityId = input.dossier.entity.id || dossierEntityId(input.caseRef, input.dossier.entity.value, input.dossier.entity.value);
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

  await writeJsonFile(caseDir(input.caseRef), `${id}.json`, record);
  return record;
}

export async function readDossier(
  caseRef: string,
  id: string,
): Promise<(StoredDossier & { dossier: Dossier & { caseRef: string; classification: string; warning: string } }) | null> {
  const raw = await readJsonFile<StoredDossier>(caseDir(caseRef), `${id}.json`);
  if (!raw) return null;

  if (raw.encrypted && raw.ciphertext) {
    if (!encryptionEnabled()) {
      throw Object.assign(new Error('Dossier is encrypted; set ENCRYPTION_MASTER_KEY'), {
        statusCode: 503,
      });
    }
    const plain = decrypt(raw.ciphertext);
    const dossier = JSON.parse(plain) as Dossier & {
      caseRef: string;
      classification: string;
      warning: string;
    };
    return { ...raw, dossier };
  }

  if (!raw.dossier) return null;
  return { ...raw, dossier: raw.dossier };
}

export async function listDossiers(opts?: {
  caseRef?: string;
  limit?: number;
}): Promise<Array<Pick<StoredDossier, 'id' | 'caseRef' | 'entityId' | 'savedAt' | 'jobId' | 'archiveId' | 'encrypted'>>> {
  const limit = opts?.limit ?? 40;
  const cases = opts?.caseRef
    ? [sanitizeCasePath(opts.caseRef)]
    : await listCaseDirs();

  const out: Array<Pick<StoredDossier, 'id' | 'caseRef' | 'entityId' | 'savedAt' | 'jobId' | 'archiveId' | 'encrypted'>> = [];

  for (const c of cases) {
    const files = await listJsonFiles(`${ROOT}/${c}`);
    for (const file of files) {
      const entry = await readJsonFile<StoredDossier>(`${ROOT}/${c}`, file);
      if (!entry) continue;
      if (opts?.caseRef && entry.caseRef !== opts.caseRef) continue;
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

  return out
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, Math.max(1, limit));
}

async function listCaseDirs(): Promise<string[]> {
  // listJsonFiles only lists files; peek via persistence data dir
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

/** Re-export for tests / callers that want to know if a blob looks encrypted. */
export { isEncrypted };
