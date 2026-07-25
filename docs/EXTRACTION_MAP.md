# Extraction Map

Maps each shared package back to its origin (repo / branch / path) and usefulness rank
from the stack catalogue.

## TypeScript packages

| Package | Rank | Origin | Notes |
|---------|-----:|--------|-------|
| `@ocrowley/ai-client` | 1 | Caspa `caspa-studio` `src/modules/ai/{OllamaClient,CloudProviders,AIOrchestrator}.ts`; Caspa `main` `src/services/llmRouter.ts` | Orchestrator DB/event wiring removed for portability |
| `@ocrowley/intent` | 4 | Caspa `caspa-rewire-working` `src/services/{output-contract,intent-router,review-ingest}.ts` | Pure, testable |
| `@ocrowley/persistence` | 8 | Caspa `caspa-studio` `src/shared/fileStore.ts` + `config`; Shakespeare- `main` `src/lib/localStore.ts`; Shakespeare- `fix/local-first-persistence` result/cache pattern; Caspa `main` `dataPaths.ts` | Firebase-coupled `persistenceService` reduced to `PersistResult` + cache helpers |
| `@ocrowley/literary-prompts` | 6 | Caspa/Shakespeare `src/services/ai.ts` patterns + `AGENTS.md` | Curated prompt builders + `LiteraryAI` wrapper over ai-client |
| `@ocrowley/quality` | 7 | Caspa `main` `qualityGateService.ts` + `types/gold`; studio `AISmellDetector` (inlined, no qualityOrchestrator dep) | Deterministic gates |
| `@ocrowley/research` | 9 | Caspa studio `ClaimExtractor.ts`, `StubWebResearchProvider`; Caspa `main` research library shape | Honest stub search |
| `@ocrowley/jobs` | 10 | Caspa studio `CaspaJobService.ts`; studio SSE pattern; simplified broadcaster | Depends on `@ocrowley/persistence` |
| `@ocrowley/export` | 12 | Shakespeare-/Caspa identical `narrativeUtils.ts`, `epubExport.ts` | JSZip peer for EPUB |
| `@ocrowley/manuscript` | 10–11 | Studio intake ideas + `@ocrowley/intent` | Lightweight `ingestText` |
| `@ocrowley/story-memory` | 15 | Caspa `main` `promiseRegistryService`, psychology/story bible types | In-memory adapters; host wires AI later |
| `@ocrowley/workflow` | 16 | Caspa `cursor/simplify-studio-workflow-71b0` + studio minimal path contract | Decoupled state machine |
| `@ocrowley/privacy-kit` | 14 / 18 | craigs-navigator `shareEngine`, `reasoningEngine`, `notificationEngine`, `calmLibrary`, enhancement limits | Consent / evidence-first |
| `@ocrowley/ops` | 17 | Caspa `main` `doctorService` (portable subset) + `scripts/deploy-smoke.sh` | No secrets in reports |
| `@ocrowley/literary-rules` | — | Caspa/Shakespeare identical `AGENTS.md` | Standing literary policy |

## Python packages

| Package | Rank | Origin | Notes |
|---------|-----:|--------|-------|
| `ocrowley_memory` | 2 | Life-os `main` `daedalus/memory/*` + `tests/test_memory_d07.py` | Cornerstone; 47 tests |
| `ocrowley_agents` | 3 | Life-os `main` `daedalus/orchestrator/*` + `tests/test_orchestrator_d08.py` | Registry, DLQ, snapshots |
| `ocrowley_policy` | 5 | Life-os `themis/approval_gate_v1.py` + `digsbody/policy.py` | Unifies triplicated risk concepts |
| `ocrowley_planner` | 11 | Life-os `daedalus/planner/*` + planner tests | Issue → plan |
| `ocrowley_operator` | 13 | Life-os `daedalus/digsbody/*` (policy re-exported from `ocrowley_policy`) | Execute disabled by design |
| `ocrowley_audit` | — | Life-os `daedalus/reporter/*` | Decision logs / reports |
| `ocrowley_contracts` | — | Life-os builder/tester/aegis/iris/reviewer as **Protocols** + `stubs/` | Mocks not default behavior |

## Explicitly not extracted

| Asset | Reason |
|-------|--------|
| TheBigBrother | Unmodified fork of `chadi0x/TheBigBrother` (Sherlock-derived OSINT) |
| handsy-ios CallRecorder / SMS stubs | Aspirational; legal/App Store risk |
| handy-ios | Empty repo |
| Nested `Caspa/Caspa`, `Shakespeare-/Shakespeare` | Outdated AI Studio dumps |
| Phase-6 show-theatre modules | Optional future package |
| Always-pass mock agents as library behavior | Protocols/stubs only |
| Cursor commission/doctor branches | Already merged to Caspa `main` |

## Branch coverage

| Repo | Branches consulted |
|------|-------------------|
| Caspa | `main`, `caspa-studio`, `caspa-rewire-working`, `cursor/simplify-studio-workflow-71b0`, `cursor/commission-model-phase-a-d713`, `cursor/doctor-library-ollama-d713`, `caspa1-local-first-build`, `repair-output-research-intake` |
| Shakespeare- | `main`, `fix/local-first-persistence` |
| Life-os | `main` (superset of all feature branches) |
| craigs-navigator | `main` |
| handsy-ios / handy-ios / TheBigBrother | Inspected; excluded from extraction |

## Usefulness ranking (top 20)

1. Multi-provider AI client + Ollama  
2. Life-os memory (Morpheus) + tests  
3. Life-os orchestrator (Mnemosyne) + tests  
4. Intent/output contract + router  
5. Unified policy/HITL  
6. Literary prompt library  
7. Quality + gold pass definitions  
8. Persistence primitives  
9. Research desk (honest search)  
10. Jobs + SSE  
11. Planner  
12. Export / EPUB / narrative utils  
13. Digsbody operator  
14. Share-sensitivity + evidence-first companion  
15. Story memory  
16. Guided/minimal workflow  
17. Doctor/ops  
18. Local acoustic enhancement limits (privacy honesty)  
19. Prize/content intelligence — *deferred* (still in Caspa app)  
20. Show-production / Phase-6 — *deferred*
