# @ocrowley/darkweb

Clearnet dark-web **index** and breach-monitor adapters extracted from
nexus-backend `darkWebService` and spiderfoot-ui `darkWebSearch`.

## What this is

- Ahmia HTML result parsing (public Tor search index on clearnet)
- Have I Been Pwned / DeHashed / IntelX **adapter interfaces** (keys via env only)
- Entity monitor orchestration with risk banding
- Authorization policy (default deny; no hardcoded secrets)

## What this is not

- A Tor client, onion crawler, or marketplace scraper
- Credential stuffing, exploit, or access tooling
- A substitute for lawful process when handling breach data

## Lawful use

Call `assertDarkwebAllowed` before live queries. Stub providers return
`darkweb_search_unavailable` when keys/network are absent — never fabricate hits.
