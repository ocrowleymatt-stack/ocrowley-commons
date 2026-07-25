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
});
