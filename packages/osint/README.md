# @ocrowley/osint

Portable OSINT layer extracted from spiderfoot-ui, nexus-backend, and Hook.

## Scope

- Entity / dossier / scan-type contracts
- Exact-match entity dedup + alias grouping helpers
- Stylometry metrics + linguistic deception pattern flags
- Geospatial clustering (coords in → clusters out)
- Username variant builder + platform probe registry
- OSINT brief / risk-review prompt builders
- Lawful-use authorization gates (default deny)
- **Recursive engine** — discovery seed expansion + critique/improve loops

## Recursive OSINT

```ts
import { runRecursiveOsint, probeUsernamePlatforms } from '@ocrowley/osint';

const result = await runRecursiveOsint({
  auth: {
    actorId: 'matt',
    roles: ['osint-operator'],
    authorizationRef: 'CASE-42',
    purpose: 'authorised passive enrichment',
  },
  initialSeeds: [{ type: 'username', value: 'example', confidence: 95, source: 'operator' }],
  discover: async (seeds) => {
    // Host wires probes / archive / SpiderFoot / darkweb adapters here
    const items = [];
    const keys = [];
    for (const s of seeds.filter(x => x.type === 'username')) {
      const hit = await probeUsernamePlatforms(s.value);
      for (const f of hit.found) {
        keys.push(f.url);
        items.push({
          key: f.url,
          entity: s.value,
          title: f.site,
          source: 'platform-probe',
          snippet: `reported profile url ${f.url}`,
          url: f.url,
          score: 70,
        });
      }
    }
    return { items, itemKeys: keys, discoveredSeeds: [] };
  },
});
```

### Loop phases

1. **Discover** (`runRefinementLoop`) — query → extract seeds → re-query until no new seeds, diminishing returns, max sweeps, or budget.
2. **Improve** (`runCritiqueLoop`) — synthesise brief → critique gaps → enrich → rescore until target, plateau, or no new evidence.

Deterministic extractors/critiques work without an LLM. Inject LLM `extractSeeds` / `critique` for stronger recursion.

## Not included

- TheBigBrother fork modules (username enumeration engines stay app-local)
- CLI runners that shell out to maigret/sherlock/holehe
- Hardcoded API keys

## Lawful use

Intended for authorized investigative / research workflows. Callers must supply an
`OsintAuthorization` that passes `evaluateOsintPolicy` before live probes.
