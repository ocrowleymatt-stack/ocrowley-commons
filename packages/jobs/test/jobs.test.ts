import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CaspaJobService } from '../src/CaspaJobService.ts';
import { sseBroadcaster } from '../src/SSEBroadcaster.ts';
import { setConfig } from '@ocrowley/persistence';
import os from 'node:os';
import path from 'node:path';

describe('@ocrowley/jobs', () => {
  it('creates a queued job', async () => {
    setConfig({ dataDir: path.join(os.tmpdir(), `ocrowley-jobs-${Date.now()}`) });
    const svc = new CaspaJobService();
    const job = await svc.create({
      type: 'gold',
      stages: [{ id: 'structure', label: 'Structure' }],
      payload: { text: 'hello' },
    });
    assert.equal(job.status, 'queued');
    assert.ok(job.id);
  });

  it('publishes SSE events', () => {
    const chunks: string[] = [];
    const unsub = sseBroadcaster.subscribe('job-1', { id: 'c1', write: (c) => chunks.push(c) });
    sseBroadcaster.publish('job-1', 'progress', { percent: 50 });
    assert.ok(chunks[0].includes('progress'));
    unsub();
  });

  it('claims with lease and heartbeats', async () => {
    setConfig({ dataDir: path.join(os.tmpdir(), `ocrowley-jobs-lease-${Date.now()}`) });
    const svc = new CaspaJobService();
    await svc.create({
      type: 'who.lookup',
      stages: [{ id: 'a', label: 'A' }],
      payload: { q: 'x' },
    });
    const claimed = await svc.claimNextJobWithLease({
      owner: 'worker-a',
      leaseMs: 5_000,
      type: 'who.lookup',
    });
    assert.ok(claimed);
    assert.equal(claimed!.status, 'running');
    assert.equal(claimed!.leaseOwner, 'worker-a');
    assert.ok(claimed!.leaseUntil);

    const beat = await svc.heartbeatLease(claimed!.id, 'worker-a', 5_000);
    assert.ok(beat);
    assert.equal(beat!.leaseOwner, 'worker-a');

    const denied = await svc.heartbeatLease(claimed!.id, 'worker-b', 5_000);
    assert.equal(denied, null);
  });

  it('reclaims expired leases', async () => {
    setConfig({ dataDir: path.join(os.tmpdir(), `ocrowley-jobs-reclaim-${Date.now()}`) });
    const svc = new CaspaJobService();
    const created = await svc.create({
      type: 'who.lookup',
      stages: [{ id: 'a', label: 'A' }],
    });
    await svc.patch(created.id, {
      status: 'running',
      leaseOwner: 'dead-worker',
      leaseUntil: new Date(Date.now() - 1000).toISOString(),
      startedAt: new Date().toISOString(),
    });
    const reclaimed = await svc.claimNextJobWithLease({
      owner: 'worker-b',
      leaseMs: 5_000,
      type: 'who.lookup',
    });
    assert.ok(reclaimed);
    assert.equal(reclaimed!.id, created.id);
    assert.equal(reclaimed!.leaseOwner, 'worker-b');
  });

  it('cancels and retries jobs', async () => {
    setConfig({ dataDir: path.join(os.tmpdir(), `ocrowley-jobs-retry-${Date.now()}`) });
    const svc = new CaspaJobService();
    const job = await svc.create({
      type: 'who.lookup',
      stages: [{ id: 'a', label: 'A' }],
    });
    await svc.markFailed(job.id, 'boom');
    const retried = await svc.retry(job.id);
    assert.equal(retried!.status, 'queued');
    assert.equal(retried!.retryCount, 1);
    const cancelled = await svc.cancel(job.id);
    assert.equal(cancelled!.status, 'cancelled');
  });
});
