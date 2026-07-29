import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('@ocrowley/crypto', () => {
  before(() => {
    process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
  });

  it('round-trips encrypt/decrypt', async () => {
    const { encrypt, decrypt } = await import('../src/encryption.ts');
    const enc = encrypt('secret-text');
    assert.notEqual(enc, 'secret-text');
    assert.equal(decrypt(enc), 'secret-text');
  });
});
