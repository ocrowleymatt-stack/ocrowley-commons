#!/usr/bin/env node
/**
 * ocrowley-who "Jane Doe at Acme in Manchester"
 * ocrowley-who "Jane Doe" --deep --case CASE-1
 * ocrowley-who "Jane Doe" --quick   # probes only
 */
import { who } from '../dist/who.js';

const args = process.argv.slice(2);
if (!args.length || args[0] === '-h' || args[0] === '--help') {
  console.log('Usage: ocrowley-who "Name at Org in City" [--deep] [--full|--quick] [--case REF] [--json] [--cli]');
  process.exit(args.length ? 0 : 1);
}

const hints = {};
let json = false;
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--at') hints.at = args[++i];
  else if (a === '--in') hints.in = args[++i];
  else if (a === '--email') hints.email = args[++i];
  else if (a === '--username') hints.username = args[++i];
  else if (a === '--case') hints.case = args[++i];
  else if (a === '--deep') hints.deep = true;
  else if (a === '--full') hints.full = true;
  else if (a === '--quick') hints.full = false;
  else if (a === '--cli') hints.enableCliTools = true;
  else if (a === '--no-archive') hints.archive = false;
  else if (a === '--json') json = true;
  else positional.push(a);
}

const r = await who(positional.join(' '), hints);
if (json) {
  console.log(
    JSON.stringify(
      {
        name: r.name,
        next: r.next,
        stats: r.stats,
        toolsUsed: r.toolsUsed,
        archiveId: r.archiveId,
        recursive: r.recursive,
        hits: r.hits,
        open: r.open,
      },
      null,
      2,
    ),
  );
} else {
  console.log(r.text);
  if (r.archiveId) console.error(`archived: ${r.archiveId}`);
}
