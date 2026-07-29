# @ocrowley/osint

## People — one call

```ts
import { who } from '@ocrowley/osint';

const r = await who('Jane Doe at Acme in Manchester');
console.log(r.text);  // printable report
console.log(r.next);  // best URL to open now
```

Also: `who('jane@acme.com')` · `who('@janedoe')` · `who('Jane Doe', { deep: true, case: 'CASE-42' })`

CLI:

```bash
npm run who -w @ocrowley/osint -- "Jane Doe at Acme in Manchester"
# or: ocrowley-who "Jane Doe" --deep
```

## WHO web + HTTP API

SpiderDash / spiderfoot-ui is the preferred product shell when attached. This package ships a thin Node HTTP API and a minimal **OCROWLEY · WHO** web UI when those apps are not in-tree.

```bash
# from repo root
npm install
npm run build -w @ocrowley/osint

export OCROWLEY_OSINT_CASE=CASE-1          # required (default-deny)
# optional:
# export HIBP_API_KEY=...
# export COMPANIES_HOUSE_API_KEY=...
# export OCROWLEY_OSINT_DEEP=1
# export OCROWLEY_SPIDERFOOT_URL=https://…   # bridge only
# export OCROWLEY_BIGBROTHER_BRIDGE=https://… # bridge only — do not vendor

npm run who:server -w @ocrowley/osint
# → http://127.0.0.1:8787
```

### API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Liveness |
| `GET`/`PUT` | `/api/settings` | Case ref, deep toggle, bridge URLs; keys accepted on PUT, never echoed |
| `POST` | `/api/who` | Body `{ "q": "Jane Doe at Acme in Manchester", "deep": false }` |
| `GET` | `/api/who?q=…` | Same as POST |
| `GET`/`POST` | `/api/who/text` | Printable `text/plain` via `whoText()` |

**Case auth:** `X-OCROWLEY-OSINT-CASE` header, `Authorization: Bearer <case>`, body/query `case`, or `OCROWLEY_OSINT_CASE` env. Missing case → `401`.

```bash
curl -sS http://127.0.0.1:8787/api/who \
  -H 'Content-Type: application/json' \
  -H 'X-OCROWLEY-OSINT-CASE: CASE-1' \
  -d '{"q":"Jane Doe at Acme in Manchester"}'
```

Response includes `text`, `next`, `hits` (confirmed / likely / possible), `open` (MORE links), and a `spiderdash` import payload for the iOS / Intel Hub bridge.

### UI

Open `http://127.0.0.1:8787` — brand + one search field + Look up. Results: printable report, confidence buckets, single **Open next**, short MORE list. Settings: case ref, HIBP / Companies House keys, deep toggle, optional SpiderFoot / BigBrother bridge URLs.

## What `who()` does

Parses name / `at` / `in` / email / `@user` from one string, then in parallel:

1. Live-probes high-signal platforms (GET + soft-404)
2. Guesses work emails from employer → Gravatar (+ HIBP if keyed)
3. Companies House officers (if `COMPANIES_HOUSE_API_KEY`)
4. Wayback on confirmed profiles
5. Optional `deep: true` → Ahmia
6. Returns `next` + ranked follow-up links

Prefer `who()` over `findPerson` for people lookup.

Lawful use only. Leads ≠ evidence.
