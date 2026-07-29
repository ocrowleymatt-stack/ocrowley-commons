#!/usr/bin/env node
/**
 * ocrowley-who-server
 * Thin HTTP + web UI over who().
 *
 *   OCROWLEY_OSINT_CASE=CASE-1 npm run who:server -w @ocrowley/osint
 */
import { listenWhoServer } from '../dist/httpApi.js';

const port = process.argv.includes('--port')
  ? Number(process.argv[process.argv.indexOf('--port') + 1])
  : undefined;

const { url } = await listenWhoServer({ port });
console.log(`OCROWLEY WHO → ${url}`);
console.log(`API  POST ${url}/api/who   { "q": "Jane Doe at Acme in Manchester" }`);
console.log(`Auth header: X-OCROWLEY-OSINT-CASE (or OCROWLEY_OSINT_CASE env)`);
console.log('Lawful use only. Leads ≠ evidence.');
