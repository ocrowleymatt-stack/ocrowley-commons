#!/usr/bin/env bash
# Topological workspace build — npm --workspaces runs alphabetically and
# breaks packages that depend on sibling dist/ output (jobs→persistence, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

layer0=(
  @ocrowley/policy
  @ocrowley/persistence
  @ocrowley/ai-client
  @ocrowley/intent
  @ocrowley/audit
  @ocrowley/coherence
  @ocrowley/crypto
  @ocrowley/export
  @ocrowley/literary-rules
  @ocrowley/ops
  @ocrowley/privacy-kit
  @ocrowley/quality
  @ocrowley/story-memory
  @ocrowley/workflow
)
layer1=(
  @ocrowley/darkweb
  @ocrowley/jobs
  @ocrowley/research
  @ocrowley/literary-prompts
  @ocrowley/manuscript
)
layer2=(
  @ocrowley/osint
)

for w in "${layer0[@]}" "${layer1[@]}" "${layer2[@]}"; do
  echo "==> build $w"
  npm run build -w "$w" --if-present
done
