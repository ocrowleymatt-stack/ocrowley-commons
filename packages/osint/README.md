# @ocrowley/osint

Portable OSINT layer extracted from spiderfoot-ui, nexus-backend, and Hook.

## Scope

- Entity / dossier / scan-type contracts
- Exact-match entity dedup + alias grouping helpers
- Stylometry metrics + linguistic deception pattern flags
- Geospatial clustering (coords in → clusters out)
- Username variant builder + platform probe registry
- OSINT brief / risk-review prompt builders
- Lawful-use authorization gates (default deny)

## Not included

- TheBigBrother fork modules (username enumeration engines stay app-local)
- CLI runners that shell out to maigret/sherlock/holehe
- Hardcoded API keys

Hosts wire network providers; this package stays stdlib/`fetch`-friendly and stub-safe.

## Lawful use

Intended for authorized investigative / research workflows. Callers must supply an
`OsintAuthorization` that passes `evaluateOsintPolicy` before live probes.
