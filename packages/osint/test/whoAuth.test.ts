import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setConfig } from '@ocrowley/persistence';
import {
  ensureBootstrapOperator,
  hashToken,
  operatorMayAccessCase,
  resolveOperator,
  saveOperators,
  whoAuthMode,
} from '../src/auth/whoOperators.js';
import { authorizeWhoRequest } from '../src/auth/authorizeRequest.js';

describe('WHO nuclear Phase 3 — operator auth', () => {
  let dataDir: string;
  const prevAuth = process.env.OCROWLEY_WHO_AUTH;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'who-auth-'));
    setConfig({ dataDir });
    process.env.OCROWLEY_DATA_DIR = dataDir;
    process.env.OCROWLEY_WHO_AUTH = 'operators';
    delete process.env.OCROWLEY_WHO_BOOTSTRAP_TOKEN;
  });

  after(async () => {
    if (prevAuth === undefined) delete process.env.OCROWLEY_WHO_AUTH;
    else process.env.OCROWLEY_WHO_AUTH = prevAuth;
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('bootstraps admin operator and resolves token', async () => {
    assert.equal(whoAuthMode(), 'operators');
    const boot = await ensureBootstrapOperator();
    assert.equal(boot.created, true);
    assert.ok(boot.token?.startsWith('who_'));
    const op = await resolveOperator(boot.token!);
    assert.ok(op);
    assert.equal(op!.id, 'op_admin');
    assert.ok(operatorMayAccessCase(op!, 'CASE-ANY'));
    // second bootstrap is no-op
    const again = await ensureBootstrapOperator();
    assert.equal(again.created, false);
  });

  it('enforces case ACL', async () => {
    const token = 'who_limited_test_token_001';
    await saveOperators({
      version: 1,
      updatedAt: new Date().toISOString(),
      operators: [
        {
          id: 'op_limited',
          name: 'Limited',
          tokenHash: hashToken(token),
          roles: ['osint-operator'],
          cases: ['CASE-A'],
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const allowed = await authorizeWhoRequest({
      headers: {
        'x-ocrowley-who-token': token,
        'x-ocrowley-osint-case': 'CASE-A',
      },
      requirePin: false,
      requireCase: true,
    });
    assert.equal(allowed.ok, true);

    const denied = await authorizeWhoRequest({
      headers: {
        'x-ocrowley-who-token': token,
        'x-ocrowley-osint-case': 'CASE-B',
      },
      requirePin: false,
      requireCase: true,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);
  });

  it('rejects missing operator token in operators mode', async () => {
    const denied = await authorizeWhoRequest({
      headers: { 'x-ocrowley-osint-case': 'CASE-A' },
      requirePin: false,
      requireCase: true,
      skipCaseAcl: true,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 401);
  });
});
