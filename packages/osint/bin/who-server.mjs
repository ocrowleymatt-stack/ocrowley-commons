#!/usr/bin/env node
/**
 * ocrowley-who-server
 * Thin HTTP + web UI over who(), with in-process async job worker.
 *
 *   OCROWLEY_OSINT_CASE=CASE-1 npm run who:server -w @ocrowley/osint
 *
 * Set OCROWLEY_WHO_WORKER=0 to disable the in-process worker (use who-worker separately).
 */
import { applyBridgeUrlDefaults } from '../dist/bridgeDefaults.js';
import { ensureBigBrotherBridge } from '../dist/bigbrotherBridge.js';
import { listenWhoServer } from '../dist/httpApi.js';
import { ensureWhoDataDir, startWhoWorker } from '../dist/jobs/whoWorker.js';

const urls = applyBridgeUrlDefaults();
ensureWhoDataDir();

const port = process.argv.includes('--port')
  ? Number(process.argv[process.argv.indexOf('--port') + 1])
  : undefined;

const bb = await ensureBigBrotherBridge({ autoStart: true });

const { url, bootstrapToken } = await listenWhoServer({ port });

const workerEnabled = process.env.OCROWLEY_WHO_WORKER !== '0';
if (workerEnabled) {
  await startWhoWorker();
}

console.log(`OCROWLEY WHO → ${url}`);
console.log(`SpiderDash  → ${urls.spiderdashUrl}`);
console.log(`SpiderFoot  → ${urls.spiderfootUrl}`);
console.log(`BigBrother  → ${bb.url} (${bb.ready ? 'ready' : 'offline'}; ${bb.detail})`);
console.log(`Worker     → ${workerEnabled ? 'in-process (OCROWLEY_WHO_WORKER=0 to disable)' : 'disabled'}`);
console.log(`Auth mode  → ${process.env.OCROWLEY_WHO_AUTH || 'pin'}`);
if (bootstrapToken) {
  console.log(`BOOTSTRAP OPERATOR TOKEN (save now; not shown again): ${bootstrapToken}`);
}
console.log(`API  POST ${url}/api/who         sync lookup`);
console.log(`API  POST ${url}/api/who/jobs    async job (202 + poll)`);
console.log(`Auth header: X-OCROWLEY-OSINT-CASE (or OCROWLEY_OSINT_CASE env)`);
console.log(`Operator:    X-OCROWLEY-WHO-TOKEN / Bearer who_… when OCROWLEY_WHO_AUTH=operators`);
console.log('Private use. Lawful use only. Leads ≠ evidence.');
