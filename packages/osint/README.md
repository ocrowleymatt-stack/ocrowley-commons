# @ocrowley/osint

## People — one call

```ts
import { who } from '@ocrowley/osint';

const r = await who('Jane Doe at Acme in Manchester');
console.log(r.text);       // printable report
console.log(r.next);       // best URL to open now
console.log(r.toolsUsed);  // every tool that fired
console.log(r.archiveId);  // server-side archive entry
```

By default `who()` runs the **full toolkit**: fast people probes + recursive discover/critique across platforms, Wayback, Companies House, HIBP/DeHashed/IntelX (when keyed), Ahmia (deep), and optional SpiderFoot / BigBrother / SpiderDash / CLI bridges. Bridges **poll until finished** (default wait 180s via `OCROWLEY_BRIDGE_TIMEOUT_MS`).

Prefer `who()` over `findPerson`. Pass `{ full: false }` for probes-only.

Also: `who('jane@acme.com')` · `who('@janedoe')` · `who('Jane Doe', { deep: true, case: 'CASE-42' })`

CLI:

```bash
npm run who -w @ocrowley/osint -- "Jane Doe at Acme in Manchester"
# or: ocrowley-who "Jane Doe" --full --cli
# quick: ocrowley-who "Jane Doe" --quick
```

## WHO web + HTTP API

SpiderDash / spiderfoot-ui is the preferred product shell when attached. This package ships a thin Node HTTP API and a minimal **OCROWLEY · WHO** web UI when those apps are not in-tree.

```bash
# from repo root
npm install
npm run build -w @ocrowley/policy -w @ocrowley/darkweb -w @ocrowley/osint

export OCROWLEY_OSINT_CASE=CASE-1          # required (default-deny)
# optional power:
# export HIBP_API_KEY=...
# export COMPANIES_HOUSE_API_KEY=...
# export DEHASHED_API_KEY=... DEHASHED_EMAIL=...
# export INTELX_API_KEY=...
# export OCROWLEY_SPIDERFOOT_URL=https://…   # awaited until done
# export OCROWLEY_BIGBROTHER_BRIDGE=https://… # bridge only — do not vendor
# export OCROWLEY_SPIDERDASH_URL=https://…  # awaited until done
# export OCROWLEY_BRIDGE_TIMEOUT_MS=180000
# export OCROWLEY_ENABLE_CLI_TOOLS=1
# export OCROWLEY_DATA_DIR=./data           # who-archive lives here

npm run who:server -w @ocrowley/osint
# → http://127.0.0.1:8787
```

### API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Liveness |
| `GET`/`PUT` | `/api/settings` | Case, full/deep, bridges, CLI; keys accepted on PUT, never echoed |
| `GET` | `/api/tools` | Ready tool / bridge counts |
| `POST` | `/api/who` | Body `{ "q": "…", "full": true }` — full toolkit by default |
| `GET` | `/api/who?q=…` | Same as POST |
| `GET`/`POST` | `/api/who/text` | Printable `text/plain` via `whoText()` |
| `GET` | `/api/archive` | List saved lookups |
| `GET` | `/api/archive/:id` | Load one archived report |

**Case auth:** `X-OCROWLEY-OSINT-CASE` header, `Authorization: Bearer <case>`, body/query `case`, or `OCROWLEY_OSINT_CASE` env. Missing case → `401`.

Searches run **server-side**. Each lookup is archived under `$OCROWLEY_DATA_DIR/who-archive/` (disable with `OCROWLEY_WHO_ARCHIVE=0` or `{ archive: false }`).

Lawful use only. Leads ≠ evidence.
