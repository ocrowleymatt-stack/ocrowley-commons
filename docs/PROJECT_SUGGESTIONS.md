# Project suggestions (Matt OS archaeology)

Produced after inspecting `ocrowleymatt-stack/ocrowley-commons` (branch
`cursor/ocrowley-commons-f5e3`), `docs/EXTRACTION_MAP.md`, related public/private
repos reachable via GitHub, and complementary OSS notes.

**Scoring axes (0–5):** buyer pain · time-to-first-revenue · reuse of existing
assets · Matthew-time required (lower is better, inverted in score) ·
defensibility · regulatory/reputational risk (lower risk = higher score).

Supreme filters from Matt OS: verified capability only; no solicitor/financial/
medical claims; prefer net £ and Matthew-minutes returned over feature count.

---

## Inspect snapshot (completed)

| Item | Finding |
|------|---------|
| Branches | `main`, `cursor/ocrowley-commons-f5e3` (active) |
| TS packages | 20 under `packages/` including `osint`, `darkweb` |
| Python packages | 10 under `python/` including `ocrowley_osint` |
| Tests | TS suite green; Python pytest suite green (utcnow deprecation warnings only) |
| CI | `.github/workflows/ci.yml` present |
| Lockfile | `package-lock.json` present (npm workspaces) |
| Mission kernel | **Not present** — no Mission/Outcome/Proxy packages yet |
| Matt OS ops docs | `STATUS.md` / `DECISIONS.md` / `RUNBOOK.md` **absent** |
| Kernel status | Strong **library foundation**; not yet an operating system |

---

## Tier 1 — Build / sell next (highest score)

### P1. Unanswered-Point Chase Pack *(productised service)*

| | |
|--|--|
| **Buyer** | Solicitors’ agents, investigators, journalists, aggrieved parties dealing with public bodies / large organisations |
| **Problem** | Multi-thread email chains with unanswered questions, broken promises, drifting ownership |
| **Result** | Recipient-grouped chase pack: unanswered register, draft chasers, escalation ladder, de-escalation route preserved |
| **Assets** | `@ocrowley/intent`, `privacy-kit`, `osint` prompts, Hook evidence language, `policy`/`audit`, Life search planner |
| **Matthew-time** | Low after template exists (review approval cards only) |
| **Price logic** | Fixed pack £400–£1,500 by thread volume; rush uplift |
| **Why first** | Direct “Chase every unanswered point” / “Deal with this” wedge; cash + time-back; no platform bidding |

**Validation:** One synthetic demo pack + 10 warm prospects from existing matters/contacts. Sandbox send only until Proxy exists.

---

### P2. Evidence Chronology & Claims Ledger *(productised service)*

| | |
|--|--|
| **Buyer** | Same as P1; also safety/incident practitioners needing document reconstruction |
| **Problem** | Scattered PDFs/emails/transcripts; allegation vs fact collapsed; no exportable chronology |
| **Result** | Exhibit register, chronology, claims ledger (fact/account/inference/hypothesis), contradiction matrix, unanswered register, disclosure-gap list |
| **Assets** | Evidence portal patterns, Hook annex/guardrails, `@ocrowley/research` grounding, `osint` dossier types, `audit` hash-chain, `ocrowley_identity` |
| **Matthew-time** | Medium (domain judgement on hard contradictions) |
| **Price logic** | £1,500–£8,000 by corpus size; optional update retainers |
| **Why** | Strongest defensibility; matches verified investigation/writing skills; feeds P1 and PR carefully |

**Do not market as legal advice.** Position as analytical reconstruction / briefing pack.

---

### P3. Deal-with-This Mission Kernel *(platform project — Slice 1)*

| | |
|--|--|
| **Buyer** | Matthew (internal); later white-label “executive ops” |
| **Problem** | Commons is libraries, not an OS — no Mission object, no approval cards, no send path |
| **Result** | Mission model + ingest (email/doc/voice text) → draft → Proxy stub → approval card → mock/live mail adapter → follow-up + audit |
| **Assets** | Entire commons kernel; wrap BullMQ/Inngest, LiteLLM, Postgres later |
| **Matthew-time** | Build investment; then sharp drop in interruptions |
| **Commercial path** | Enables P1 automation; later SaaS “Matter Desk” |

**This is the platform bet.** Without it, services stay manual.

---

### P4. Passive Entity Dossier *(productised service / thin SaaS)*

| | |
|--|--|
| **Buyer** | Due-diligence, journalists, corporate security (lawful use) |
| **Problem** | Username/OSINT tools dump noise without case authorisation or evidential language |
| **Result** | Authorised passive dossier: entity card, platform hits, archive hits, optional breach index (HIBP), OSINT brief with unclassified leads disclaimer |
| **Assets** | `@ocrowley/osint`, `@ocrowley/darkweb`, spiderfoot-ui as optional sidecar, `policy` default-deny |
| **Matthew-time** | Low–medium; policy gates do the heavy lifting |
| **Price logic** | £250–£1,000 per entity; subscription for retained monitoring later |
| **Risk** | Must stay passive-first, authorised, non-weaponised; no TheBigBrother resale |

---

## Tier 2 — Strong, sequence after Tier 1

### P5. Literary Quality Gate / Manuscript Polish Desk

- **Buyer:** indie authors, small presses, ghostwriters  
- **Result:** AI-smell + coherence + polish passes + human-voice report; optional EPUB export  
- **Assets:** `quality`, `coherence`, `literary-*`, `manuscript`, `export`, Caspa/Shakespeare/novel-machine  
- **Why wait:** Excellent IP, but less aligned with “net verified money + life back” than P1–P2 unless a warm author pipeline exists  

### P6. Public-Body Discovery Campaign Designer

- **Buyer:** same as P1  
- **Result:** Kernel-and-snippet question sets per recipient (who owns process / what record / which system)  
- **Assets:** influence-graph concepts (NexusPlexus), OSINT briefs, comms strategy from Matt OS prompt  
- **Path:** Feature of P1/P2, not a separate company  

### P7. Repository Archaeology → Internal Product Pack

- **Buyer:** Matthew / small teams with messy monorepos  
- **Result:** Inventory + extract/wrap/replace decisions + one validation candidate  
- **Assets:** This commons process itself; `EXTRACTION_MAP`, `COMPLEMENTARY_OSS`  
- **Commercial:** Niche; better as Engine C input than v1 SKU  

### P8. Authority Brief / Expert Comment Desk

- **Buyer:** journalists, editors (inbound)  
- **Result:** Verified media profile + tailored pitch from real work products  
- **Assets:** PR section of Matt OS; must use only verified bio  
- **Why later:** Visibility ≠ revenue; run after P2 has citable packs  

---

## Tier 3 — Deprioritise / do not build as products yet

| Idea | Reason |
|------|--------|
| Indiscriminate Upwork/Bark bidder | Prompt non-goal; low net £/hour; reputation risk |
| “Full Matt OS” all Layer A surfaces | Premature conglomerate before Slice 1 |
| Weaponised OSINT / TheBigBrother SaaS | Excluded; legal/reputational landmine |
| Handsy intercept / covert tooling | Excluded |
| Generic chatbot wrapper on commons | Non-goal |
| Self-expanding Module Foundry | Premature until 3+ vertical slices work |
| Flipper / Marauder consumer apps | Off supreme metrics |
| Password-recovery public site as core | Domain side-quest |

---

## First commercial experiment (pick one)

**Recommended selection: P1 — Unanswered-Point Chase Pack**

Evidence over enthusiasm:

1. Reuses Hook/OSINT/privacy language already extracted  
2. Matches Matthew’s associative, narrow-enquiry working style  
3. Short path to a billable artefact without platform fees  
4. Directly trains the Mission + Proxy loop needed for Matt OS  
5. Feeds P2 when threads sit on larger corpora  

### Minimum validation kit for P1

1. Service one-pager (buyer, inputs, outputs, exclusions, price band)  
2. Synthetic demo pack (redacted/fake thread)  
3. Qualification questions (thread count, organisations, deadline pressure)  
4. Proposal template + delivery checklist + quality rubric  
5. 10-prospect list from existing relationships (no cold spam)  
6. Sandbox-only send path until autonomy Level 3 policy exists  

---

## Platform project sequence (if building Matt OS proper)

Aligned with prompt Slice 0–2, compressed:

| Order | Project | Done when |
|------:|---------|-----------|
| 0 | Baseline hygiene (`STATUS.md`, env validation, warning cleanup) | Reproducible install/test/CI |
| 1 | Mission + Outcome Contract + audit events | State machine + provenance tests |
| 2 | Matt Proxy profile v0 (rules + rubric, no self-auth) | Edit-distance benchmark on fixtures |
| 3 | Vertical Slice “Deal with this” (mock mail) | E2E with approval bypass tests |
| 4 | “Chase every unanswered point” | Multi-thread grouping + chase drafts |
| 5 | Productise P1 on top of 3–4 | First paid or firmly committed engagement |

Wrap (don’t reinvent): LiteLLM, BullMQ/Inngest, Postgres+pgvector, Presidio, OTel — per `docs/COMPLEMENTARY_OSS.md`.

---

## Decision log (suggested)

| ID | Decision |
|----|----------|
| D1 | Kernel remains `ocrowley-commons`; Matt OS app is a separate consumer repo or `apps/matt-os` later |
| D2 | First external SKU = P1 Chase Pack; first platform slice = Deal-with-This |
| D3 | Freelance Opportunity Scout deferred until Proxy + policy send path exist |
| D4 | OSINT offerings stay authorised/passive; no scanner-farm productisation of TheBigBrother |
| D5 | Literary desk (P5) kept as Engine C/D candidate, not v1 cash engine |

---

## Related docs

- [EXTRACTION_MAP.md](./EXTRACTION_MAP.md)  
- [ARCHITECTURE.md](./ARCHITECTURE.md)  
- [COMPLEMENTARY_OSS.md](./COMPLEMENTARY_OSS.md)  
