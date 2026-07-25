import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AIOrchestrator, NoProviderAvailableError } from '../src/AIOrchestrator.ts';
import { OllamaClient } from '../src/OllamaClient.ts';

describe('@ocrowley/ai-client', () => {
  it('throws NoProviderAvailableError when nothing is configured', async () => {
    const stub = Object.create(OllamaClient.prototype) as OllamaClient;
    stub.isAvailable = async () => false;
    stub.generate = async () => ({ text: '', provider: 'ollama' });
    const orch = new AIOrchestrator(stub);
    await assert.rejects(
      () => orch.generate({ prompt: 'hello' }),
      (err: unknown) => err instanceof NoProviderAvailableError
    );
  });

  it('lists no providers when none configured', async () => {
    const stub = Object.create(OllamaClient.prototype) as OllamaClient;
    stub.isAvailable = async () => false;
    const orch = new AIOrchestrator(stub);
    const list = await orch.listAvailableProviders();
    assert.deepEqual(list, []);
  });
});
