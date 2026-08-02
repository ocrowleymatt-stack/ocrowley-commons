/**
 * File-backed hash-chained WHO audit ledger.
 * Reuses @ocrowley/audit hashing; persists under $OCROWLEY_DATA_DIR/who-audit/.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import {
  hashAuditEntry,
  type AuditAction,
  type AuditEntry,
} from '@ocrowley/audit';
import { listJsonFiles, readJsonFile, writeJsonFile } from '@ocrowley/persistence';

const SUB = 'who-audit';
const CHAIN_FILE = 'chain.json';

interface ChainFile {
  entries: AuditEntry[];
  updatedAt: string;
}

async function loadChain(): Promise<AuditEntry[]> {
  const file = await readJsonFile<ChainFile>(SUB, CHAIN_FILE);
  return file?.entries ?? [];
}

async function saveChain(entries: AuditEntry[]): Promise<void> {
  await writeJsonFile(SUB, CHAIN_FILE, {
    entries,
    updatedAt: new Date().toISOString(),
  } satisfies ChainFile);
}

export async function appendWhoAudit(input: {
  actorId: string;
  action: Extract<
    AuditAction,
    'who.requested' | 'who.completed' | 'who.denied' | 'who.failed' | 'dossier.written'
  >;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditEntry> {
  const existing = await loadChain();
  const previousHash = existing.at(-1)?.hash ?? 'GENESIS';
  const sequence = existing.length + 1;
  // Omit undefined metadata so JSON round-trip matches hashAuditEntry input.
  const unsigned: Omit<AuditEntry, 'hash'> = {
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: new Date().toISOString(),
    sequence,
    previousHash,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  const entry: AuditEntry = { ...unsigned, hash: hashAuditEntry(unsigned) };
  existing.push(entry);
  await saveChain(existing);
  await writeJsonFile(SUB, `${String(sequence).padStart(6, '0')}-${entry.hash.slice(0, 8)}.json`, entry);
  return entry;
}

export async function listWhoAudit(limit = 50): Promise<AuditEntry[]> {
  const entries = await loadChain();
  return entries.slice(-Math.max(1, limit)).reverse();
}

export async function verifyWhoAudit(): Promise<{ valid: boolean; brokenAt?: number; count: number }> {
  const entries = await loadChain();
  let previousHash = 'GENESIS';
  for (const entry of entries) {
    const { hash, ...unsigned } = entry;
    const expected = hashAuditEntry(unsigned);
    const hashesMatch =
      expected.length === hash.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
    if (!hashesMatch || entry.previousHash !== previousHash) {
      return { valid: false, brokenAt: entry.sequence, count: entries.length };
    }
    previousHash = hash;
  }
  return { valid: true, count: entries.length };
}

export async function whoAuditShardCount(): Promise<number> {
  const files = await listJsonFiles(SUB);
  return files.filter((f) => f !== CHAIN_FILE).length;
}

/** Deterministic id helper for resource ids when needed. */
export function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export type { AuditEntry };
