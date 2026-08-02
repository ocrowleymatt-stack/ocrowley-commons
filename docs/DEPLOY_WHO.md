# Deploy WHO (private people OSINT)

Private deploy of the **OCROWLEY · WHO** API + web shell, with a BigBrother sidecar on the internal Docker network.

## Prerequisites

- Docker + Compose v2
- A case reference you are authorised to use
- Optional: HIBP / Companies House / DeHashed / IntelX keys
- Optional private `the_big_brother` Python package (mount or bake into the `bb` image later)

## Quick start (Docker)

```bash
cp deploy/who/.env.example deploy/who/.env
# edit OCROWLEY_OSINT_CASE, OCROWLEY_WHO_PIN (default 3123), and any API keys

docker compose -f deploy/who/docker-compose.yml --env-file deploy/who/.env up -d --build

# health
curl -sS http://127.0.0.1:8787/api/health | jq .

# smoke
OCROWLEY_OSINT_CASE=CASE-PROD-1 OCROWLEY_WHO_PIN=3123 bash packages/osint/scripts/who-smoke.sh
```

Open `http://127.0.0.1:8787` — enter PIN (default `3123`), set the same case in Settings, then Look up.

### Services

| Service | Port | Notes |
|---------|------|--------|
| `who` | host `8787` → container `8787` | API + static UI + in-process job worker; binds `0.0.0.0` |
| `bb` | internal `8798` only | Sidecar on WHO’s network namespace (`127.0.0.1:8798`) — **not published** |

Data volume `who-data` → `/data`:
- `who-archive/` — lead dumps from sync/async lookups
- `who-dossiers/` — case-scoped dossier JSON (optionally encrypted)
- `who-audit/` — hash-chained audit ledger
- `caspa-jobs/` — durable `who.lookup` job queue

### Async jobs (Phase 1)

```bash
# enqueue (returns 202 immediately)
curl -sS -X POST http://127.0.0.1:8787/api/who/jobs \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $OCROWLEY_OSINT_CASE" \
  -H "X-OCROWLEY-WHO-PIN: $OCROWLEY_WHO_PIN" \
  -d '{"q":"Jane Doe","full":false}'

# poll
curl -sS -H "X-OCROWLEY-WHO-PIN: $OCROWLEY_WHO_PIN" \
  http://127.0.0.1:8787/api/who/jobs/<jobId>
```

In-process worker is on by default (`OCROWLEY_WHO_WORKER=1`). Optional at-rest encryption: set `ENCRYPTION_MASTER_KEY` (64 hex chars).

## Local (no Docker)

```bash
npm install
npm run build -w @ocrowley/policy -w @ocrowley/darkweb -w @ocrowley/osint
pip install -e python/ocrowley_osint

export OCROWLEY_OSINT_CASE=CASE-1
export OCROWLEY_WHO_HOST=0.0.0.0   # if exposing beyond localhost
npm run who:server                 # auto-starts BB on :8798 when possible
```

## Production checklist

- [ ] `OCROWLEY_OSINT_CASE` set (non-default, real case ref)
- [ ] `OCROWLEY_WHO_PIN` set (change from default `3123` in real deploys)
- [ ] TLS terminator in front (Caddy / nginx / Cloudflare) — app speaks HTTP
- [ ] Restrict who can reach `:8787` (VPN / IP allowlist / basic auth at edge)
- [ ] Keep BigBrother on private network only (compose already does this)
- [ ] Secrets via env / secret store — never commit `.env`
- [ ] Confirm SpiderDash / SpiderFoot URLs reachable from the host
- [ ] Run `packages/osint/scripts/who-smoke.sh` after deploy
- [ ] `docker compose … logs -f who bb` looks clean; healthchecks green

## Ops commands

```bash
# status
docker compose -f deploy/who/docker-compose.yml ps

# logs
docker compose -f deploy/who/docker-compose.yml logs -f who bb

# restart
docker compose -f deploy/who/docker-compose.yml up -d --build

# stop
docker compose -f deploy/who/docker-compose.yml down
```

## Notes

- Lawful / private use only. Leads ≠ evidence.
- BigBrother scanners are **not** vendored; the sidecar registers modules and calls `the_big_brother` if installed in that image.
- Full toolkit lookups can take minutes when SpiderFoot/SpiderDash bridges are awaiting completion (`OCROWLEY_BRIDGE_TIMEOUT_MS`, default 180s).
