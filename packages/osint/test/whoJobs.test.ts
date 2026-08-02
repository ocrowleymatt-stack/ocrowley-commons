import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setConfig } from '@ocrowley/persistence';
import { enqueueWhoJob, getWhoJob, publicWhoJob } from '../src/jobs/whoJobService.js';
import { processWhoJob, runWhoWorkerOnce } from '../src/jobs/whoWorker.js';
import { dossierFromWhoResult, dossierEntityId } from '../src/dossier/fromWhoResult.js';
import { listDossiers, readDossier } from '../src/dossier/dossierStore.js';
import { appendWhoAudit, listWhoAudit, verifyWhoAudit } from '../src/audit/whoAudit.js';
import type { WhoResult } from '../src/who.js';

describe('WHO nuclear Phase 1 — jobs / dossier / audit', () => {
  let dataDir: string;
  const prevFetch = globalThis.fetch;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'who-nuclear-'));
    setConfig({ dataDir });
    process.env.OCROWLEY_DATA_DIR = dataDir;
    process.env.OCROWLEY_OSINT_CASE = 'CASE-NUCLEAR-1';
    process.env.OCROWLEY_OSINT_QUICK = '1';
    process.env.OCROWLEY_WHO_ARCHIVE = '0';
    // Keep discover fast/offline in worker path
    globalThis.fetch = (async () =>
      new Response('', { status: 404 })) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = prevFetch;
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('maps WhoResult → Dossier with stable entity id', () => {
    const result: WhoResult = {
      q: 'Ada Lovelace',
      name: 'Ada Lovelace',
      hits: [
        {
          kind: 'profile',
          title: 'GitHub',
          detail: 'Live',
          url: 'https://github.com/adalovelace',
          confidence: 'confirmed',
          source: 'platform-probe',
        },
      ],
      next: 'https://github.com/adalovelace',
      open: [],
      stats: { confirmed: 1, likely: 0, possible: 0, checked: 3 },
      text: 'report',
      warning: 'Leads ≠ evidence',
      toolsUsed: ['platform-probe'],
      toolsReady: [],
    };
    const d = dossierFromWhoResult(result, 'CASE-NUCLEAR-1');
    assert.equal(d.caseRef, 'CASE-NUCLEAR-1');
    assert.equal(d.entity.type, 'person');
    assert.equal(d.entity.id, dossierEntityId('CASE-NUCLEAR-1', 'Ada Lovelace', 'Ada Lovelace'));
    assert.ok(d.indicators.socialProfiles.includes('https://github.com/adalovelace'));
    assert.ok(d.sections.length >= 1);
  });

  it('appends and verifies hash-chained audit', async () => {
    const a = await appendWhoAudit({
      actorId: 'tester',
      action: 'who.requested',
      resourceType: 'who.job',
      resourceId: 'job-1',
      metadata: { q: 'Ada' },
    });
    const b = await appendWhoAudit({
      actorId: 'tester',
      action: 'who.completed',
      resourceType: 'who.job',
      resourceId: 'job-1',
    });
    assert.equal(a.sequence, 1);
    assert.equal(b.sequence, 2);
    assert.equal(b.previousHash, a.hash);
    const v = await verifyWhoAudit();
    assert.equal(v.valid, true);
    assert.ok(v.count >= 2);
    const listed = await listWhoAudit(10);
    assert.ok(listed.some((e) => e.action === 'who.completed'));
  });

  it('enqueues and processes who.lookup end-to-end', async () => {
    const job = await enqueueWhoJob({
      q: 'Ada Lovelace',
      caseRef: 'CASE-NUCLEAR-1',
      full: false,
      archive: false,
      actorId: 'tester',
    });
    assert.equal(job.status, 'queued');
    assert.equal(job.type, 'who.lookup');

    const done = await runWhoWorkerOnce();
    assert.ok(done);
    assert.equal(done!.id, job.id);
    assert.equal(done!.status, 'completed');

    const result = done!.result as {
      dossierId?: string;
      who?: { name?: string };
      auditSequence?: number;
    };
    assert.ok(result.dossierId);
    assert.equal(result.who?.name, 'Ada Lovelace');
    assert.ok(typeof result.auditSequence === 'number');

    const dossiers = await listDossiers({ caseRef: 'CASE-NUCLEAR-1' });
    assert.ok(dossiers.some((d) => d.id === result.dossierId));

    const loaded = await readDossier('CASE-NUCLEAR-1', result.dossierId!);
    assert.ok(loaded);
    assert.equal(loaded!.dossier.entity.value, 'Ada Lovelace');

    const pub = publicWhoJob((await getWhoJob(job.id))!);
    assert.equal(pub.status, 'completed');
    assert.equal(pub.caseRef, 'CASE-NUCLEAR-1');
  });

  it('indexes entities and supports cancel + retry', async () => {
    const { listEntityIndex } = await import('../src/dossier/entityIndex.js');
    const { cancelWhoJob, retryWhoJob } = await import('../src/jobs/whoJobService.js');

    const job = await enqueueWhoJob({
      q: 'Grace Hopper',
      caseRef: 'CASE-NUCLEAR-1',
      full: false,
      archive: false,
    });
    const done = await runWhoWorkerOnce();
    assert.ok(done);
    assert.equal(done!.status, 'completed');

    const entities = await listEntityIndex({ caseRef: 'CASE-NUCLEAR-1', q: 'hopper' });
    assert.ok(entities.length >= 1);
    assert.ok(entities[0].latestDossierId);

    const retried = await retryWhoJob(job.id);
    assert.equal(retried!.status, 'queued');
    assert.equal(retried!.retryCount, 1);

    const cancelled = await cancelWhoJob(job.id, 'test cancel');
    assert.equal(cancelled!.status, 'cancelled');
  });

  it('marks denied jobs when case auth fails', async () => {
    const job = await enqueueWhoJob({
      q: 'Nobody',
      caseRef: '   ', // will fail at enqueue... actually enqueue rejects empty
      full: false,
    }).catch((e: Error & { statusCode?: number }) => e);

    // empty case rejected at enqueue
    assert.ok(job instanceof Error);
    assert.equal((job as { statusCode?: number }).statusCode, 401);

    // Force a job with empty case via direct create path is not exported;
    // processWhoJob deny path covered by policy on missing auth ref:
    const forced = await enqueueWhoJob({
      q: 'Nobody',
      caseRef: 'CASE-NUCLEAR-1',
      full: false,
      archive: false,
    });
    // Mutate payload to empty case after enqueue
    const { whoJobService } = await import('../src/jobs/whoJobService.js');
    await whoJobService().patch(forced.id, {
      input: { ...forced.input, caseRef: '' },
      projectId: '',
    });
    const processed = await processWhoJob((await getWhoJob(forced.id))!);
    assert.equal(processed.status, 'failed');
  });
});
