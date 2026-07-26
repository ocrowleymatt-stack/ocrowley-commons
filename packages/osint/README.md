# @ocrowley/osint

Portable OSINT layer with a **full toolkit** recursive engine and a **people-first** API.

## Find a person (easiest)

```ts
import { findPerson } from '@ocrowley/osint';

const pack = await findPerson(
  { name: 'Jane Doe', employer: 'Example Ltd', location: 'Manchester' },
  {
    auth: {
      actorId: 'matt',
      roles: ['osint-operator'],
      authorizationRef: 'CASE-42',
      purpose: 'authorised people research',
    },
  },
);

// pack.profiles · pack.searchLinks · pack.emails · pack.summary.topLeads
```

Instant link pack (no live probes): `findPerson(query, { auth, linksOnly: true })`.

## Quick start — full recursive toolkit

```ts
import { runRecursiveOsint, reportToolkitAvailability } from '@ocrowley/osint';

const auth = {
  actorId: 'matt',
  roles: ['osint-operator'],
  authorizationRef: 'CASE-42',
  purpose: 'authorised passive enrichment',
};

// See what is live vs bridge-ready
console.log(reportToolkitAvailability({
  auth,
  darkwebAuth: {
    ...auth,
    lawfulUseAcknowledged: true,
  },
}));

const result = await runRecursiveOsint({
  auth,
  initialSeeds: [{ type: 'username', value: 'example', confidence: 95, source: 'operator' }],
  toolkit: {
    darkwebAuth: { ...auth, lawfulUseAcknowledged: true },
    enableDarkweb: true,
    enableArchive: true,
    enablePlatformProbes: true,
    enableBridges: true,   // OCROWLEY_BIGBROTHER_BRIDGE / OCROWLEY_SPIDERFOOT_URL
    enableCliTools: false, // set true or OCROWLEY_ENABLE_CLI_TOOLS=1 for sherlock/maigret/holehe
  },
});

console.log(result.tools);
console.log(result.brief);
```

## Tool families

| Family | Examples | How enabled |
|---|---|---|
| **commons** | platform-probe, wayback-cdx, username-variants, seed-extract, entity-dedup | Always (in-process) |
| **darkweb** | ahmia-index, hibp-breach, dehashed, intelx, darkweb-monitor | `darkwebAuth.lawfulUseAcknowledged` + optional API keys |
| **bigbrother** | 19 module adapters (`bb-phantom-id`, …) | Python `the_big_brother` **or** `OCROWLEY_BIGBROTHER_BRIDGE` |
| **spiderfoot** | spiderfoot-scan | `OCROWLEY_SPIDERFOOT_URL` |
| **cli** | sherlock, maigret, holehe | `OCROWLEY_ENABLE_CLI_TOOLS=1` |

## Python BigBrother bridge

```bash
pip install -e python/ocrowley_osint
# optional: install TheBigBrother package on PYTHONPATH
```

```python
from ocrowley_osint import create_bigbrother_registry, run_bridge_scan, ScanRequest, ScanType

reg = create_bigbrother_registry()
reg.run(ScanRequest(target="alice", scan_type=ScanType.PASSIVE, authorization_ref="CASE-1"))

run_bridge_scan({
  "authorizationRef": "CASE-1",
  "seeds": [{"type": "username", "value": "alice"}],
})
```

Point `OCROWLEY_BIGBROTHER_BRIDGE` at an HTTP service that POSTs to your bridge and returns `{ items, seeds }`.

## Lawful use

Default-deny policy. Dark-web tools require explicit lawful-use acknowledgement. Passive-first; non-passive BigBrother modules are skipped in Passive scans.
