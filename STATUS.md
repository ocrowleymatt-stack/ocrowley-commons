# STATUS

Last updated: 2026-07-26

## Platform

- Repository: `ocrowleymatt-stack/ocrowley-commons`
- Active branch: `cursor/ocrowley-commons-f5e3`
- Role today: **shared library kernel**, not yet Matt OS application

## Verified this cycle

- TypeScript workspaces green (osint now includes full toolkit + recursive defaults)
- Python pytest green including BigBrother registry (19 modules)
- Full toolkit: commons + darkweb + bigbrother + spiderfoot + CLI bridges
- `runRecursiveOsint()` uses full toolkit by default; `reportToolkitAvailability()` lists readiness
- Docs: ARCHITECTURE, EXTRACTION_MAP, COMPLEMENTARY_OSS, PUBLISH, PROJECT_SUGGESTIONS

## Missing for Matt OS Slice 0–1

- Mission / Outcome Contract model
- Matt Proxy package
- Approval-card UX / iPad shell
- Mail / calendar adapters (even mocks)
- STATUS-linked ops set (BACKLOG, DECISIONS, RUNBOOK, etc.) — only STATUS + PROJECT_SUGGESTIONS added this cycle

## SpiderDash / Apple

- Native shell improved in `spiderdash-ios` (`com.ocrowley.matt.spiderdash`, team `9ZV5QPNN4M`)
- `@ocrowley/osint` exports `buildSpiderdashImportPayload` + Flipper BLE UUID constants
- TestFlight path documented; requires Mac + App Store Connect app ID + secrets

## Next implementation action

1. On Mac: `npx cap add ios` in spiderdash-ios, sign with Apple team, TestFlight  
2. Mission kernel + “Deal with this” vertical slice (Matt OS)
