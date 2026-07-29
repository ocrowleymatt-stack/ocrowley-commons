# ocrowley-commons

Shared library foundation extracted from the ocrowleymatt-stack repositories.

## Packages (TypeScript)

| Package | Purpose |
|---------|---------|
| `@ocrowley/ai-client` | Ollama-first multi-provider AI client |
| `@ocrowley/intent` | Input/action/output contracts + intent router |
| `@ocrowley/persistence` | Atomic file store, localStore, local-first helpers |
| `@ocrowley/literary-prompts` | Literary AIService prompt surface |
| `@ocrowley/research` | Research desk + claim extraction |
| `@ocrowley/quality` | Quality gates, AI-smell, human-voice |
| `@ocrowley/jobs` | Job queue, worker, SSE broadcaster |
| `@ocrowley/export` | EPUB/PDF helpers + narrative utils |
| `@ocrowley/manuscript` | Intake + minimal manuscript helpers |
| `@ocrowley/story-memory` | Promises, psychology, story bible |
| `@ocrowley/workflow` | Guided next-step + minimal author path |
| `@ocrowley/privacy-kit` | Share sensitivity + evidence-first companion |
| `@ocrowley/ops` | Doctor/diagnostics helpers |
| `@ocrowley/crypto` | AES-256-GCM + HMAC helpers |
| `@ocrowley/policy` | Allow/deny policy engine (Mn) |
| `@ocrowley/audit` | Hash-chained tamper-evident ledger (Mn) |
| `@ocrowley/coherence` | Narrative psych/craft/accuracy libraries |
| `@ocrowley/literary-rules` | Literary engine standing rules |
| `@ocrowley/osint` | `who()` people lookup, dossier/scan contracts, WHO HTTP API + web shell, SpiderDash bridges |
| `@ocrowley/darkweb` | Clearnet Tor-index (Ahmia) + breach adapters with authorization gates |

## People OSINT (WHO)

```bash
npm install && npm run build -w @ocrowley/osint
export OCROWLEY_OSINT_CASE=CASE-1   # required (default-deny)
npm run who:server -w @ocrowley/osint
# open http://127.0.0.1:8787  — brand + one search field
```

Prefer SpiderDash when attached; commons ships the thin `who()` API + minimal UI with **full toolkit** by default (bridges await completion; lookups archived under `$OCROWLEY_DATA_DIR/who-archive`). See [packages/osint/README.md](packages/osint/README.md).

## Packages (Python)

| Package | Purpose |
|---------|---------|
| `ocrowley_memory` | Morpheus TTL memory, context, retrieval |
| `ocrowley_agents` | Mnemosyne registry, dispatcher, coordinator |
| `ocrowley_policy` | Unified risk / no-go / approval gates |
| `ocrowley_planner` | Issue → plan heuristics |
| `ocrowley_operator` | Digsbody draft/review operator |
| `ocrowley_audit` | Decision logs + agent reports |
| `ocrowley_contracts` | Protocols for builder/tester/aegis/iris/reviewer |
| `ocrowley_identity` | Deterministic identity normalisation |
| `ocrowley_search` | Plan-then-execute personal search heuristics |
| `ocrowley_osint` | OSINT module registry + Ahmia parse helpers |

## Quick start

```bash
# TypeScript
npm install
npm run build
npm test

# Python
pip install -e "python/ocrowley_memory" -e "python/ocrowley_agents" -e "python/ocrowley_policy" \
  -e "python/ocrowley_planner" -e "python/ocrowley_operator" -e "python/ocrowley_audit" -e "python/ocrowley_contracts" \
  -e "python/ocrowley_identity" -e "python/ocrowley_search" -e "python/ocrowley_osint"
pytest python/tests -q
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/EXTRACTION_MAP.md](docs/EXTRACTION_MAP.md), [docs/COMPLEMENTARY_OSS.md](docs/COMPLEMENTARY_OSS.md), [docs/PROJECT_SUGGESTIONS.md](docs/PROJECT_SUGGESTIONS.md), and [docs/PUBLISH.md](docs/PUBLISH.md).
