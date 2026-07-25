#!/usr/bin/env bash
# Caspa deployment smoke tests — run after npm run deploy with server on :3000
set -euo pipefail

BASE="${CASPA_SMOKE_URL:-http://127.0.0.1:3000}"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "Caspa smoke tests against $BASE"

# Health
curl -sf "$BASE/health" | grep -q '"status"' || fail "/health"
ok "/health"

# Doctor
curl -sf "$BASE/api/doctor" | grep -q '"success":true' || fail "/api/doctor"
curl -sf "$BASE/api/doctor" | grep -q '"status":"ok"' || fail "/api/doctor status"
ok "/api/doctor"

# Ollama smoke (offline is fine)
curl -sf "$BASE/api/ollama/smoke" | grep -q '"success":true' || fail "/api/ollama/smoke"
ok "/api/ollama/smoke"

# Gold passes
curl -sf "$BASE/api/caspa/gold/passes" | grep -q 'structure' || fail "/api/caspa/gold/passes"
ok "/api/caspa/gold/passes"

# Job audit
curl -sf "$BASE/api/caspa/gold/jobs/audit" | grep -q '"activeJobs"' || fail "/api/caspa/gold/jobs/audit"
ok "/api/caspa/gold/jobs/audit"

# Storage backups list
curl -sf "$BASE/api/caspa/storage/backups" | grep -q '"success":true' || fail "/api/caspa/storage/backups"
ok "/api/caspa/storage/backups"

# Novel Write Pro quality pass
QP=$(curl -sf -X POST "$BASE/api/caspa/novel-write-pro/quality-pass" \
  -H 'Content-Type: application/json' \
  -d '{"content":"She felt very sad suddenly. The room was quiet.","mode":"novel","title":"Smoke"}')
echo "$QP" | grep -q '"success":true' || fail "/api/caspa/novel-write-pro/quality-pass"
echo "$QP" | grep -q '"overallScore"' || fail "quality-pass score"
ok "/api/caspa/novel-write-pro/quality-pass"

# Static UI
curl -sf "$BASE/" | grep -q '<html' || fail "index.html"
ok "index.html"

echo ""
echo "All smoke tests passed."
