import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLedger } from '../src/index.ts';

describe('@ocrowley/audit', () => {
  it('chains hashes', () => {
    const ledger = new AuditLedger();
    const a = ledger.append({
      actorId: 'u1',
      action: 'backup.created',
      resourceType: 'db',
      resourceId: 'r1',
      occurredAt: new Date().toISOString(),
    });
    const b = ledger.append({
      actorId: 'u1',
      action: 'restore.verified',
      resourceType: 'db',
      resourceId: 'r1',
      occurredAt: new Date().toISOString(),
    });
    assert.equal(a.sequence, 1);
    assert.equal(b.previousHash, a.hash);
    assert.notEqual(a.hash, b.hash);
  });
});
