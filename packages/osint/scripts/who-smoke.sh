#!/usr/bin/env bash
# WHO deploy smoke — run against a live who:server
set -euo pipefail

BASE="${OCROWLEY_WHO_SMOKE_URL:-http://127.0.0.1:8787}"
CASE="${OCROWLEY_OSINT_CASE:-CASE-SMOKE}"
PIN="${OCROWLEY_WHO_PIN:-3123}"
PIN_HDR="X-OCROWLEY-WHO-PIN: $PIN"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "WHO smoke against $BASE (case=$CASE)"

curl -sf "$BASE/api/health" | grep -q '"ok": true\|"ok":true' || fail "/api/health"
ok "/api/health"

# PIN gate — wrong pin rejected; unlock + header accepted
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/unlock" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"0000"}')
[[ "$CODE" == "401" ]] || fail "/api/unlock wrong pin should 401 (got $CODE)"
ok "/api/unlock reject"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/unlock" \
  -H 'Content-Type: application/json' \
  -d "{\"pin\":\"$PIN\"}")
[[ "$CODE" == "200" ]] || fail "/api/unlock status=$CODE"
ok "/api/unlock"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/settings")
[[ "$CODE" == "401" ]] || fail "/api/settings without PIN should 401 (got $CODE)"
ok "/api/settings PIN gate"

curl -sf -H "$PIN_HDR" "$BASE/api/settings" | grep -q 'caseRef\|spiderdashUrl' || fail "/api/settings"
ok "/api/settings"

curl -sf "$BASE/" | grep -q 'pin-form\|OCROWLEY' || fail "web shell"
ok "web shell"

# Quick lookup (probes only) — must auth with case + PIN
CODE=$(curl -s -o /tmp/who-smoke.json -w '%{http_code}' -X POST "$BASE/api/who" \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $CASE" \
  -H "$PIN_HDR" \
  -d '{"q":"Jane Doe","full":false,"archive":true}')
[[ "$CODE" == "200" ]] || fail "/api/who status=$CODE"
grep -q '"name"' /tmp/who-smoke.json || fail "/api/who body"
grep -q '"next"' /tmp/who-smoke.json || fail "/api/who next"
ok "/api/who"

# Deny without case when env case cleared is host-dependent; at least reject empty q
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/who" \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $CASE" \
  -H "$PIN_HDR" \
  -d '{"q":""}')
[[ "$CODE" == "400" ]] || fail "/api/who empty should 400 (got $CODE)"
ok "/api/who validation"

curl -sf -H "$PIN_HDR" "$BASE/api/archive?limit=5" | grep -q 'entries' || fail "/api/archive"
ok "/api/archive"

# Async job path (worker must be running — who:server default)
JOB_JSON=$(curl -sf -X POST "$BASE/api/who/jobs" \
  -H 'Content-Type: application/json' \
  -H "X-OCROWLEY-OSINT-CASE: $CASE" \
  -H "$PIN_HDR" \
  -d '{"q":"Jane Doe","full":false,"archive":true}')
echo "$JOB_JSON" | grep -q '"jobId"' || fail "/api/who/jobs enqueue"
JOB_ID=$(echo "$JOB_JSON" | sed -n 's/.*"jobId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[[ -n "$JOB_ID" ]] || fail "/api/who/jobs jobId parse"
ok "/api/who/jobs enqueue"

# Poll up to ~60s for completion
DONE=0
for _ in $(seq 1 30); do
  STATUS_JSON=$(curl -sf -H "$PIN_HDR" "$BASE/api/who/jobs/$JOB_ID" || true)
  if echo "$STATUS_JSON" | grep -q '"status"[[:space:]]*:[[:space:]]*"completed"'; then
    DONE=1
    break
  fi
  if echo "$STATUS_JSON" | grep -q '"status"[[:space:]]*:[[:space:]]*"failed"'; then
    fail "/api/who/jobs/$JOB_ID failed: $STATUS_JSON"
  fi
  sleep 2
done
[[ "$DONE" == "1" ]] || fail "/api/who/jobs/$JOB_ID did not complete in time"
ok "/api/who/jobs complete"

curl -sf -H "$PIN_HDR" -H "X-OCROWLEY-OSINT-CASE: $CASE" "$BASE/api/dossiers?limit=5" | grep -q 'entries' || fail "/api/dossiers"
ok "/api/dossiers"
curl -sf -H "$PIN_HDR" "$BASE/api/audit?limit=5&verify=1" | grep -q '"valid": true\|"valid":true' || fail "/api/audit"
ok "/api/audit"

echo ""
echo "All WHO smoke tests passed."
