import { createHash, timingSafeEqual } from 'node:crypto';

export type AuditAction =
  | 'snapshot.opened' | 'snapshot.closed' | 'migration.started' | 'migration.committed'
  | 'migration.rolled_back' | 'record.quarantined' | 'backup.created' | 'restore.verified'
  | 'promotion.requested' | 'promotion.approved' | 'promotion.denied' | 'emergency.rollback'
  | 'who.requested' | 'who.completed' | 'who.denied' | 'who.failed' | 'dossier.written';

export interface AuditEntryInput {
  actorId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEntry extends AuditEntryInput {
  sequence: number;
  previousHash: string;
  hash: string;
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const hashAuditEntry = (entry: Omit<AuditEntry, 'hash'>): string =>
  createHash('sha256').update(stable(entry)).digest('hex');

export class AuditLedger {
  readonly #entries: AuditEntry[] = [];

  append(input: AuditEntryInput): AuditEntry {
    const sequence = this.#entries.length + 1;
    const previousHash = this.#entries.at(-1)?.hash ?? 'GENESIS';
    const unsigned = { ...input, sequence, previousHash };
    const entry = { ...unsigned, hash: hashAuditEntry(unsigned) };
    this.#entries.push(entry);
    return structuredClone(entry);
  }

  entries(): AuditEntry[] { return structuredClone(this.#entries); }

  verify(): { valid: boolean; brokenAt?: number } {
    let previousHash = 'GENESIS';
    for (const entry of this.#entries) {
      const { hash, ...unsigned } = entry;
      const expected = hashAuditEntry(unsigned);
      const hashesMatch = expected.length === hash.length && timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
      if (!hashesMatch || entry.previousHash !== previousHash) return { valid: false, brokenAt: entry.sequence };
      previousHash = hash;
    }
    return { valid: true };
  }
}
