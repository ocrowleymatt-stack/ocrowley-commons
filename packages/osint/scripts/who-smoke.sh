#!/usr/bin/env bash
# WHO deploy smoke — run against a live who:server
set -euo pipefail

BASE="${OCROWLEY_WHO_SMOKE_URL:-http://127.0.0.1:8787}"
CASE="${OCROWLEY_OSINT_CASE:-CASE-SMOKE}"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "WHO smoke against $BASE (case=$CASE)"

curl -sf "$BASE/api/health" | grep -q '"ok": true\|"ok":true' || fail "/api/health"
ok "/api/health"

curl -sf "$BASE/api/settings" | grep -q 'caseRef\|spiderdashUrl' || fail "/api/settings"
ok "/api/settings"

curl -sf "$BASE/" | grep -q 'OCROWLEY' || fail "web shell"
ok "web shell"

# Quick lookup (probes only) — must auth
CODE=$(curl -s -o /tmp/who-smoke.json -w '%{http_code}' -X POST "$BASE/api/who" \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $CASE" \
  -d '{"q":"Jane Doe","full":false,"archive":true}')
[[ "$CODE" == "200" ]] || fail "/api/who status=$CODE"
grep -q '"name"' /tmp/who-smoke.json || fail "/api/who body"
grep -q '"next"' /tmp/who-smoke.json || fail "/api/who next"
ok "/api/who"

# Deny without case when env case cleared is host-dependent; at least reject empty q
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/who" \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $CASE" \
  -d '{"q":""}')
[[ "$CODE" == "400" ]] || fail "/api/who empty should 400 (got $CODE)"
ok "/api/who validation"

curl -sf "$BASE/api/archive?limit=5" | grep -q 'entries' || fail "/api/archive"
ok "/api/archive"

echo ""
echo "All WHO smoke tests passed."
