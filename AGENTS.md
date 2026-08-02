# AGENTS.md

## Cursor Cloud specific instructions

This is a polyglot monorepo. Node (npm workspaces, TypeScript under `packages/*`) plus
Python packages (`python/ocrowley_*`, installed editable). The one runnable end-to-end
product is **WHO** — a people-OSINT Node HTTP server + static web UI in `@ocrowley/osint`.

The startup update script already runs dependency installs (`npm install`, the
`pip install -e ...` editable packages, and `pytest`). It intentionally does **not** build
or start anything. Standard commands live in `package.json` scripts, `README.md`, and
`docs/DEPLOY_WHO.md`; prefer those instead of duplicating them.

### Build before running or testing (non-obvious)
- `npm run build` (topological, via `scripts/build-workspaces.sh`) is **required** before
  running the WHO server or the TS tests. The WHO server imports compiled JS from
  `packages/osint/dist/`, and sibling packages consume each other's `dist/` output, so a
  fresh checkout without a build will fail to start. The update script does not build, so
  run `npm run build` yourself after startup.
- Alphabetical `npm --workspaces` build order breaks sibling `dist/` deps — always use
  `npm run build` (not `npm run build --workspaces`).

### Running the WHO product (dev, no Docker)
- `OCROWLEY_OSINT_CASE` must be set or the API is default-deny (`401`). Example:
  `export OCROWLEY_OSINT_CASE=CASE-DEV-1`.
- The UI/API is PIN-gated; default PIN is `3123` (`OCROWLEY_WHO_PIN`). Send it as header
  `X-OCROWLEY-WHO-PIN` and the case as `X-OCROWLEY-OSINT-CASE`.
- Start with `npm run who:server` → serves `http://127.0.0.1:8787` (API + web shell).
  It auto-starts the Python BigBrother bridge on `:8798` (the editable
  `ocrowley_osint` package provides it — no manual start needed).
- Smoke test: `OCROWLEY_OSINT_CASE=CASE-DEV-1 npm run who:smoke`.
- `full: true` ("full toolkit") lookups await external bridges (SpiderFoot/SpiderDash)
  and can take minutes (`OCROWLEY_BRIDGE_TIMEOUT_MS`, default 180000). For quick checks
  use `full: false` (platform probes only). External bridges/enrichment APIs are optional;
  the product works without them (they may be unreachable from the VM).
- Lookups are archived to disk under `$OCROWLEY_DATA_DIR/who-archive` (defaults to a repo
  path `packages/osint/data/who-archive`, which is git-ignored).

### Tests / lint
- TS: `npm test` (native `node --test` via `tsx`) and `npm run test -w @ocrowley/osint`.
  Lint is type-check only: `npm run lint` (`tsc --noEmit`).
- Python: `python3 -m pytest python/tests -q`. Note `python` is not on PATH — use `python3`.
- `pip`/`pytest` install to `~/.local/bin` (not on PATH); invoke pytest via
  `python3 -m pytest`.

### Docker
- `deploy/who/` has a Docker Compose stack (`who` + `bb`), but Docker is not installed in
  this VM. Use the local (no-Docker) path above.
