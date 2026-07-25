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
| `@ocrowley/literary-rules` | Literary engine standing rules |

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

## Quick start

```bash
# TypeScript
npm install
npm run build
npm test

# Python
pip install -e "python/ocrowley_memory" -e "python/ocrowley_agents" -e "python/ocrowley_policy" \
  -e "python/ocrowley_planner" -e "python/ocrowley_operator" -e "python/ocrowley_audit" -e "python/ocrowley_contracts"
pytest python/tests -q
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/EXTRACTION_MAP.md](docs/EXTRACTION_MAP.md), and [docs/PUBLISH.md](docs/PUBLISH.md).
