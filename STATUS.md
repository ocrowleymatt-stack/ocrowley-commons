# STATUS

Last updated: 2026-07-29

## Platform

- Repository: `ocrowleymatt-stack/ocrowley-commons`
- Active branch: `cursor/ocrowley-commons-f5e3`
- Product path: **WHO** people OSINT (`@ocrowley/osint` + web + BB sidecar)

## Ready for deploy

- Docker Compose: `deploy/who/docker-compose.yml` (`who` + private `bb`)
- Env template: `deploy/who/.env.example`
- Runbook: [docs/DEPLOY_WHO.md](docs/DEPLOY_WHO.md)
- Smoke: `npm run who:smoke` / `packages/osint/scripts/who-smoke.sh`
- Defaults: SpiderDash + SpiderFoot URLs; BigBrother on `127.0.0.1:8798` (compose: internal `bb:8798`)

```bash
cp deploy/who/.env.example deploy/who/.env
# set OCROWLEY_OSINT_CASE
npm run who:up && npm run who:smoke
```

## Verified this cycle

- TypeScript `@ocrowley/osint` tests green (WHO HTTP, full toolkit, archive, bridges)
- Python BigBrother registry + HTTP bridge tests green
- CI builds policy/darkweb/osint explicitly

## SpiderDash / Apple

- Native shell: `spiderdash-ios` (`com.ocrowley.matt.spiderdash`)
- Hosted ARCANUM: `https://spiderdash-mbpjlxnq.manus.space`

## Next

1. Put TLS / access control in front of `:8787`
2. Install private `the_big_brother` into the `bb` image when ready
3. Merge PR #1 when review is satisfied
