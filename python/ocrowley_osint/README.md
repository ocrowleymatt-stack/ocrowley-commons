# ocrowley_osint

Python OSINT module registry and scan contracts.

Inspired by TheBigBrother / spiderfoot module layouts, but **does not vendor**
third-party scanners into git. For **private authorised use**, run the local
HTTP bridge so `@ocrowley/osint` `who()` can call registered BigBrother modules
when `the_big_brother` is installed on the machine.

## Private BigBrother bridge

```bash
pip install -e python/ocrowley_osint
# optional: install your private the_big_brother package on PYTHONPATH
python -m ocrowley_osint --port 8798
# or: ocrowley-bb-bridge --port 8798
```

- `GET /health` — readiness + module counts  
- `GET /modules` — registry list + people-focused ids  
- `POST /scan` — `{ "authorizationRef": "CASE-1", "q": "Jane Doe", "scanType": "Passive" }`

Default URL used by WHO: `http://127.0.0.1:8798` (`OCROWLEY_BIGBROTHER_BRIDGE`).
`npm run who:server` will try to auto-start this bridge.
