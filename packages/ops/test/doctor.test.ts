import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runDoctor } from '../src/doctorService.ts';

describe('@ocrowley/ops', () => {
  it('returns a report shape', async () => {
    const report = await runDoctor({ ollamaUrl: 'http://127.0.0.1:9', healthUrl: 'http://127.0.0.1:9/health' });
    assert.ok(report.checks.length >= 2);
    assert.ok(report.checkedAt);
  });
});
