# Complementary open-source landscape

What exists elsewhere that maps onto `@ocrowley/*` and `ocrowley_*` packages — adopt, wrap, or keep proprietary.

Last updated: 2026-07-25

---

## Decision legend

| Verdict | Meaning |
|---|---|
| **Adopt / wrap** | Prefer upstream; keep a thin Ocrowley adapter |
| **Hybrid** | Use upstream for hard parts; keep Ocrowley domain layer |
| **Keep proprietary** | Domain IP; do not replace with a generic OSS swap |
| **Watch** | Useful reference; not a drop-in yet |

---

## Tier 1 — Closest matches (high leverage)

### AI gateway → `@ocrowley/ai-client`

| Project | Notes |
|---|---|
| [LiteLLM](https://github.com/BerriAI/litellm) | Multi-provider OpenAI-compatible proxy; routing, fallbacks, spend tracking. Python-first; JS clients talk OpenAI API shape. |
| [Portkey Gateway](https://github.com/Portkey-AI/gateway) | Edge AI gateway; configs, guardrails, observability. |
| [OpenRouter](https://openrouter.ai/) | Hosted multi-model router (not self-hosted core). |

**Verdict:** **Adopt / wrap.** Keep Ocrowley types + `createAIClient` façade; optionally point transport at LiteLLM/Portkey.

Also watch: [Vercel AI SDK](https://github.com/vercel/ai), [LangChain.js](https://github.com/langchain-ai/langchainjs) model layer.

---

### Agent / DAG orchestration → `@ocrowley/workflow`, `ocrowley_agents`, `ocrowley_planner`

| Project | Notes |
|---|---|
| [LangGraph](https://github.com/langchain-ai/langgraph) (+ JS) | Stateful graphs, checkpoints, human-in-the-loop. De-facto agent runtime. |
| [Temporal](https://github.com/temporalio/temporal) | Production durable workflows (heavy ops). |
| [Inngest](https://github.com/inngest/inngest) | Event-driven durable steps; DX-friendly. |
| [Prefect](https://github.com/PrefectHQ/prefect) / [Dagster](https://github.com/dagster-io/dagster) | Data/ML orchestration cousins. |
| [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | AutoGen + Semantic Kernel lineage. |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Multi-agent crews (opinionated). |

**Verdict:** **Hybrid.** Use LangGraph/Temporal/Inngest as runtime; keep Ocrowley agent roles, planner, and literary stage machine as domain graphs.

---

### Intent / NLP routing → `@ocrowley/intent`

| Project | Notes |
|---|---|
| [spaCy](https://github.com/explosion/spaCy) | Mature NLP; custom pipelines. |
| [Rasa NLU](https://rasa.com/) | Intent + entity classic stack. |
| [Hugging Face](https://huggingface.co/) zero-shot / text-class | Modern LLM-era intent. |
| LLM structured output | Often replaces regex/keyword routers. |

**Verdict:** **Hybrid.** Keep Ocrowley intent taxonomy + handlers; optionally back classifiers with HF/spaCy/LLM JSON.

---

### Memory / RAG → `ocrowley_memory`, `@ocrowley/story-memory`, `@ocrowley/research`

| Project | Notes |
|---|---|
| [Mem0](https://github.com/mem0ai/mem0) | Popular memory layer for AI apps. |
| [Zep](https://github.com/getzep/zep) | Long-term memory / knowledge graph angle. |
| [LlamaIndex](https://github.com/run-llama/llama_index) | Data framework for RAG. |
| [Haystack](https://github.com/deepset-ai/haystack) | Production NLP/RAG pipelines. |
| [Chroma](https://github.com/chroma-core/chroma) / [Qdrant](https://github.com/qdrant/qdrant) / [Weaviate](https://github.com/weaviate/weaviate) / [pgvector](https://github.com/pgvector/pgvector) | Vector stores. |
| [Microsoft GraphRAG](https://github.com/microsoft/graphrag) | Graph-centric retrieval. |
| LangGraph store / checkpoint memory | Ties into agent runtime. |

**Verdict:** **Hybrid.** Vectors/chunking from Chroma/Qdrant/LlamaIndex; keep Ocrowley episodic/semantic/procedural model + story-memory schemas.

---

### Jobs / queues → `@ocrowley/jobs`

| Project | Notes |
|---|---|
| [BullMQ](https://github.com/taskforcesh/bullmq) | Redis jobs for Node — closest practical match. |
| [Graphile Worker](https://github.com/graphile/worker) | Postgres-backed jobs. |
| [Temporal](https://github.com/temporalio/temporal) / [Inngest](https://github.com/inngest/inngest) | Durable work over “queue + status.” |
| [Celery](https://github.com/celery/celery) / [RQ](https://github.com/rq/rq) / [Dramatiq](https://github.com/dramatiq/dramatiq) | Python side. |
| [DBOS](https://github.com/dbos-inc/dbos-transact) | Lightweight durable execution. |

**Verdict:** **Adopt / wrap.** Keep job status types; implement with BullMQ or Graphile Worker.

---

### Sync / local-first → `@ocrowley/persistence`

| Project | Notes |
|---|---|
| [RxDB](https://github.com/pubkey/rxdb) | Reactive client DB + replication. |
| [ElectricSQL](https://github.com/electric-sql/electric) | Postgres sync to clients. |
| [PowerSync](https://github.com/powersync-ja/powersync) | SQLite sync layer. |
| [Automerge](https://github.com/automerge/automerge) / [Yjs](https://github.com/yjs/yjs) | CRDT collaboration. |
| [WatermelonDB](https://github.com/Nozbe/WatermelonDB) | Mobile/local-first. |

**Verdict:** **Hybrid.** Keep project/document model; use RxDB/Electric/CRDT for sync guts.

---

### Policy / authZ → `ocrowley_policy`, `@ocrowley/policy`

| Project | Notes |
|---|---|
| [Open Policy Agent (OPA)](https://github.com/open-policy-agent/opa) | General policy engine (Rego). |
| [Cedar](https://github.com/cedar-policy/cedar) | Amazon’s policy language. |
| [Casbin](https://github.com/casbin/casbin) | RBAC/ABAC library (many languages). |
| [Cerbos](https://github.com/cerbos/cerbos) | AuthZ as a service. |
| [OpenFGA](https://github.com/openfga/openfga) / [SpiceDB](https://github.com/authzed/spicedb) | Relationship/Zanzibar style. |
| [Permit.io](https://github.com/permitio/permit-js) | Productized authZ (OSS + cloud). |

**Verdict:** **Hybrid.** Enforce with OPA/Cedar/Casbin; keep Ocrowley literary + safety rule content.

---

### AI guardrails → `@ocrowley/policy`, `@ocrowley/coherence`, quality gates

| Project | Notes |
|---|---|
| [NVIDIA NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) | Dialogical rails. |
| [Guardrails AI](https://github.com/guardrails-ai/guardrails) | Validators around LLM I/O. |
| [Lakera](https://github.com/lakeraai) / prompt-injection defenses | Security-focused. |
| [LLM Guard](https://github.com/protectai/llm-guard) | Scanner toolkit. |
| [OpenAI / Anthropic / Vertex safety APIs] | Hosted classifiers. |

**Verdict:** **Hybrid.** Use NeMo/Guardrails/LLM Guard as engines; Ocrowley owns product policies + literary coherence rules.

---

### PII / privacy → `@ocrowley/privacy-kit`

| Project | Notes |
|---|---|
| [Microsoft Presidio](https://github.com/microsoft/presidio) | Detect + anonymize PII — strongest OSS default. |
| [Private AI](https://www.private-ai.com/) | Commercial alternative. |
| Cloud DLP (AWS/GCP) | Hosted redaction. |

**Verdict:** **Adopt / wrap.** Presidio (or cloud DLP) under Ocrowley privacy API.

---

### Audit / compliance trail → `@ocrowley/audit`, `ocrowley_audit`

| Project | Notes |
|---|---|
| [OpenTelemetry](https://opentelemetry.io/) | Traces/logs/metrics standard. |
| [Sigstore](https://www.sigstore.dev/) / [in-toto](https://in-toto.io/) | Supply-chain provenance. |
| [OSV](https://osv.dev/) / [Syft](https://github.com/anchore/syft) / [Grype](https://github.com/anchore/grype) | SBOM + vuln (ops adjacent). |
| Immutable log patterns | AWS QLDB-style, Kafka audit topics, Certificate Transparency inspiration. |

**Verdict:** **Hybrid.** OTel for telemetry; keep Ocrowley audit event schema + hash-chain semantics.

---

### Ops / health / metrics → `@ocrowley/ops`

| Project | Notes |
|---|---|
| [Prometheus](https://prometheus.io/) client libs | Metrics. |
| OpenTelemetry | Unified observability. |
| [healthchecks](https://github.com/healthchecks/healthchecks) / k8s probes | Liveness patterns. |
| [Sentry](https://github.com/getsentry/sentry) | Error tracking. |

**Verdict:** **Adopt / wrap.** Thin Ocrowley helpers over OTel/Prometheus.

---

### Crypto / identity → `@ocrowley/crypto`, `ocrowley_identity`

| Project | Notes |
|---|---|
| [libsodium](https://libsodium.gitbook.io/) / [PyNaCl](https://github.com/pyca/pynacl) / Web Crypto | Primitives. |
| [OIDC](https://openid.net/connect/) / [Keycloak](https://www.keycloak.org/) / [Auth.js](https://authjs.dev/) / [Ory](https://www.ory.sh/) | Identity providers. |
| [WebAuthn](https://webauthn.guide/) | Passkeys. |

**Verdict:** **Adopt / wrap.** Never reinvent crypto; Ocrowley keeps envelopes + identity model only.

---

### Search → `ocrowley_search`

| Project | Notes |
|---|---|
| [Meilisearch](https://github.com/meilisearch/meilisearch) | Fast product search. |
| [Typesense](https://github.com/typesense/typesense) | Similar DX. |
| [OpenSearch](https://github.com/opensearch-project/OpenSearch) / Elasticsearch | Heavy search. |
| [Typesense + vectors](https://typesense.org/) / hybrid search stacks | Keyword + semantic. |
| [Sonic](https://github.com/valeriansaliou/sonic) | Lightweight search. |

**Verdict:** **Adopt / wrap** for indexing backend; keep Ocrowley query/domain API if thin.

---

### Export / manuscript formats → `@ocrowley/export`, `@ocrowley/manuscript`

| Project | Notes |
|---|---|
| [Pandoc](https://github.com/jgm/pandoc) | Universal doc converter. |
| [ProseMirror](https://prosemirror.net/) / [TipTap](https://tiptap.dev/) / [CodexMirror](https://codemirror.net/) | Editors (manuscript UX). |
| [docx](https://github.com/dolanmihails/docx) / [pdfkit](https://github.com/foliojs/pdfkit) / [mdast](https://github.com/syntax-tree/mdast) | Format writers. |
| [novel](https://github.com/steven-tey/novel) | Notion-style editor (unrelated to novel-writing OS). |

**Verdict:** **Hybrid.** Pandoc/docx/pdfkit for bytes; Ocrowley manuscript model stays.

---

## Tier 2 — Domain-adjacent (writing / creative OS)

These overlap **product shape**, not just infra.

| Project | Overlaps | Gap vs Ocrowley |
|---|---|---|
| [InkOS](https://github.com/get-inkos/inkos) | AI novel writing, multi-agent feel | Not your Caspa/Life-os stack; good UX/reference |
| [Novel-OS](https://github.com/ronantakizawa/novel-os) + [Claude Code plugin](https://github.com/ronantakizawa/novel-os-claude-code) | Spec/state kit for AI novelists | Prompt/process kit, not full commons |
| [BookAI](https://github.com/athrael-soju/BookAI) / similar “AI book” repos | Generation pipelines | Usually thinner memory/policy |
| [NovelCrafter](https://www.novelcrafter.com/) (product) | Planning + prose tooling | Closed product |
| [Scrivener](https://www.literatureandlatte.com/scrivener) ecosystem | Manuscript structure metaphors | Desktop, not agentic |
| [Obsidian](https://obsidian.md/) + writing plugins | Local-first notes/knowledge | Not agent runtime |
| LangChain “generative agents” papers/impls | Memory + planning inspiration | Research prototypes |

**Verdict:** **Watch / steal ideas.** Do **not** replace `@ocrowley/literary-*`, story-memory, or manuscript with these; treat as competitive/UX references.

---

## Tier 3 — “Almost the whole commons” platforms

| Project | Why it looks similar | Why it isn’t a drop-in |
|---|---|---|
| [LangChain / LangGraph platform](https://github.com/langchain-ai/langgraph) | Agents + memory + tools | Not literary/Caspa domain |
| [Haystack + pipelines](https://github.com/deepset-ai/haystack) | Research/RAG OS | Weak on manuscript/workflow product |
| [Dify](https://github.com/langgenius/dify) / [Flowise](https://github.com/FlowiseAI/Flowise) / [n8n](https://github.com/n8n-io/n8n) | Visual AI/workflow apps | App builders, not embeddable domain libs |
| [Open WebUI](https://github.com/open-webui/open-webui) | Chat + tools + RAG | UI product |
| [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | Skills/plugins/agents | Enterprise agent SDK |

**Verdict:** Possible **hosts** for Ocrowley plugins; not replacements for the monorepo.

---

## Package-by-package cheat sheet

| Ocrowley package | Best OSS complements | Strategy |
|---|---|---|
| `@ocrowley/ai-client` | LiteLLM, Portkey, Vercel AI SDK | Wrap gateway |
| `@ocrowley/intent` | spaCy, HF, LLM JSON | Hybrid taxonomy |
| `@ocrowley/persistence` | RxDB, Electric, Yjs/Automerge | Hybrid sync |
| `@ocrowley/literary-prompts` | *(few true comps)* Novel-OS, InkOS as refs | **Keep proprietary** |
| `@ocrowley/research` | LlamaIndex, Haystack, Chroma/Qdrant | Hybrid RAG |
| `@ocrowley/quality` | Guardrails AI, rubric eval harnesses | Hybrid gates |
| `@ocrowley/jobs` | BullMQ, Graphile Worker, Temporal | Wrap queue |
| `@ocrowley/export` | Pandoc, docx, pdfkit | Wrap converters |
| `@ocrowley/manuscript` | ProseMirror/TipTap, Pandoc AST | Keep model |
| `@ocrowley/story-memory` | Mem0/Zep ideas; custom schemas | **Keep proprietary** |
| `@ocrowley/workflow` | LangGraph, Temporal, Inngest | Domain graph on durable runtime |
| `@ocrowley/privacy-kit` | **Presidio** | Wrap |
| `@ocrowley/ops` | OTel, Prometheus | Wrap |
| `@ocrowley/crypto` | libsodium, Web Crypto | Wrap only |
| `@ocrowley/policy` | OPA, Cedar, Casbin, NeMo | Hybrid |
| `@ocrowley/audit` | OTel + hash-chain patterns | Hybrid |
| `@ocrowley/coherence` | Guardrails + custom literary rules | **Keep proprietary** core |
| `@ocrowley/literary-rules` | groundrails-style engines | **Keep rules**; optional engine |
| `ocrowley_memory` | Mem0, Zep, LlamaIndex, vectors | Hybrid |
| `ocrowley_agents` | LangGraph, Agent Framework, CrewAI | Hybrid |
| `ocrowley_policy` | OPA/Cedar + NeMo | Hybrid |
| `ocrowley_planner` | LangGraph, classical planners | Hybrid |
| `ocrowley_operator` | Temporal/Inngest/tools | Hybrid |
| `ocrowley_audit` | OTel + compliance logs | Hybrid |
| `ocrowley_contracts` | Pydantic/Zod ecosystems, OpenAPI | Keep contracts |
| `ocrowley_identity` | OIDC, Keycloak, Ory, Auth.js | Wrap IdP |
| `ocrowley_search` | Meilisearch, Typesense, OpenSearch | Wrap engine |

---

## What is still uniquely Ocrowley

Worth preserving even when wrapping OSS:

1. **Literary domain model** — manuscript stages, story-memory, coherence, literary-rules/prompts  
2. **Caspa product contracts** — intent taxonomy, project/doc shapes, export presets tied to studio  
3. **Life-os cognitive split** — memory/policy/planner/operator as one opinionated agent OS  
4. **Cross-language commons layout** — TS + Python packages with one extraction map  

Everything else (gateways, queues, vectors, PII, OTel, CRDTs) should trend toward **thin adapters over mature OSS**.

---

## Suggested adoption order

1. **Presidio** behind `@ocrowley/privacy-kit`  
2. **BullMQ** (or Graphile Worker) behind `@ocrowley/jobs`  
3. **LiteLLM/Portkey** behind `@ocrowley/ai-client`  
4. **OTel** behind `@ocrowley/ops` + audit sinks  
5. **LangGraph or Inngest** as runtime for `@ocrowley/workflow` / `ocrowley_agents`  
6. **Qdrant/Chroma + LlamaIndex/Haystack** under research/memory  
7. **OPA/Cedar** for non-literary authorization; keep literary rules in-house  

---

## OSINT / dark-web complements (`@ocrowley/osint`, `@ocrowley/darkweb`)

| Project | Notes | Strategy |
|---|---|---|
| [SpiderFoot](https://github.com/smicallef/spiderfoot) | Full OSINT automation platform | Host/runtime; commons keeps dossier/scan contracts + API helpers |
| [Sherlock](https://github.com/sherlock-project/sherlock) / [Maigret](https://github.com/soxoj/maigret) / [Holehe](https://github.com/megadose/holehe) | Username/email presence CLIs | App-local runners; commons HTTP probe registry only |
| [Ahmia](https://ahmia.fi/) | Public Tor search **index** (clearnet) | Wrap parser in `@ocrowley/darkweb` |
| [Have I Been Pwned](https://haveibeenpwned.com/) / DeHashed / Intelligence X | Breach / leak indexes | Adapter interfaces; keys via env |
| [Wayback CDX](https://github.com/internetarchive/wayback) / Common Crawl | Web archive recovery | `@ocrowley/osint` archive helpers |
| Nominatim / geo stacks | Geocoding for heatmaps | Inject `GeocodeFn`; cluster locally |
| OPA / Cedar | AuthZ for investigate mode | Already hybrid via `@ocrowley/policy` |

**Keep proprietary:** case authorization model, evidential language in OSINT briefs, nexus risk banding, lawful-use gates.

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — package layout and boundaries  
- [EXTRACTION_MAP.md](./EXTRACTION_MAP.md) — source repos and ranking  
- [PUBLISH.md](./PUBLISH.md) — release notes  
