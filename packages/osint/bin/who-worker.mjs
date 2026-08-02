#!/usr/bin/env node
/**
 * ocrowley-who-worker
 * Standalone durable-job worker for WHO lookups.
 *
 *   OCROWLEY_DATA_DIR=/data OCROWLEY_OSINT_CASE=CASE-1 npm run who:worker -w @ocrowley/osint
 */
import { applyBridgeUrlDefaults } from '../dist/bridgeDefaults.js';
import { ensureWhoDataDir, startWhoWorker, stopWhoWorker } from '../dist/jobs/whoWorker.js';

applyBridgeUrlDefaults();
ensureWhoDataDir();

console.log('OCROWLEY WHO worker starting…');
console.log(`Data dir → ${process.env.OCROWLEY_DATA_DIR || process.env.DATA_DIR || './data'}`);

await startWhoWorker({ pollMs: Number(process.env.OCROWLEY_WHO_WORKER_POLL_MS || 750) });

const shutdown = async (signal) => {
  console.log(`WHO worker received ${signal}; stopping…`);
  await stopWhoWorker();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('WHO worker running (claiming who.lookup jobs).');
// Keep process alive — startWhoWorker runs a background loop.
await new Promise(() => {});
