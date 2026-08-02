import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setConfig } from '@ocrowley/persistence';
import { closePool, databaseUrl, ensureMigrated, isPostgresEnabled, pgHealth } from '../src/db/pg.js';
import { writeDossier, listDossiers, readDossier } from '../src/dossier/dossierStore.js';
import { upsertEntityIndex, listEntityIndex, fuseCaseEntities } from '../src/dossier/entityIndex.js';
import { dossierFromWhoResult } from '../src/dossier/fromWhoResult.js';
import type { WhoResult } from '../src/who.js';

const hasDb = Boolean(
  process.env.OCROWLEY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
);

describe('WHO nuclear Phase 4 — Postgres store', { skip: !hasDb }, () => {
  let dataDir: string;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'who-pg-'));
    setConfig({ dataDir });
    process.env.OCROWLEY_DATA_DIR = dataDir;
    await ensureMigrated();
  });

  after(async () => {
    await closePool();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('reports healthy postgres with pg_trgm', async () => {
    assert.equal(isPostgresEnabled(), true);
    assert.ok(databaseUrl());
    const h = await pgHealth();
    assert.equal(h.enabled, true);
    assert.equal(h.ok, true);
    assert.equal(h.trgm, true);
  });

  it('writes dossiers + entities and searches with trigram', async () => {
    const result: WhoResult = {
      q: 'Alan Turing',
      name: 'Alan Turing',
      hits: [
        {
          kind: 'profile',
          title: 'GitHub',
          detail: 'Live',
          url: 'https://github.com/alanturing',
          confidence: 'confirmed',
        },
      ],
      next: 'https://github.com/alanturing',
      open: [],
      stats: { confirmed: 1, likely: 0, possible: 0, checked: 2 },
      text: 'report',
      warning: 'Leads ≠ evidence',
      toolsUsed: ['platform-probe'],
      toolsReady: [],
    };
    const dossier = dossierFromWhoResult(result, 'CASE-PG-1');
    const stored = await writeDossier({
      caseRef: 'CASE-PG-1',
      dossier,
      jobId: 'job-pg-1',
    });
    await upsertEntityIndex({
      caseRef: 'CASE-PG-1',
      entityId: stored.entityId,
      value: 'Alan Turing',
      type: 'person',
      dossierId: stored.id,
      jobId: 'job-pg-1',
      stats: result.stats,
    });

    // second nearby entity for fusion
    const result2: WhoResult = {
      ...result,
      q: 'A Turing',
      name: 'A Turing',
    };
    const d2 = dossierFromWhoResult(result2, 'CASE-PG-1');
    const stored2 = await writeDossier({ caseRef: 'CASE-PG-1', dossier: d2 });
    await upsertEntityIndex({
      caseRef: 'CASE-PG-1',
      entityId: stored2.entityId,
      value: 'A Turing',
      type: 'person',
      dossierId: stored2.id,
    });

    const listed = await listDossiers({ caseRef: 'CASE-PG-1', limit: 10 });
    assert.ok(listed.some((d) => d.id === stored.id));

    const loaded = await readDossier('CASE-PG-1', stored.id);
    assert.ok(loaded);
    assert.equal(loaded!.dossier.entity.value, 'Alan Turing');

    const search = await listEntityIndex({ caseRef: 'CASE-PG-1', q: 'Turing' });
    assert.ok(search.length >= 1);
    assert.ok(search.some((e) => e.value.includes('Turing')));

    const related = await fuseCaseEntities({
      caseRef: 'CASE-PG-1',
      entityId: stored.entityId,
      limit: 10,
    });
    assert.ok(related.some((e) => e.entityId === stored2.entityId));
  });
});
