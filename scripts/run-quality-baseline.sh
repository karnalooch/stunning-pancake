#!/usr/bin/env bash
# Faza 0 — quality baseline (entire monorepo). See docs/quality/README.md
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
failed=0

step() {
  local name="$1"
  shift
  echo ""
  echo "=== $name ==="
  if "$@"; then
    echo "OK: $name"
  else
    echo "FAIL: $name"
    failed=$((failed + 1))
  fi
}

step "backend: ruff check" ruff check backend
step "backend: ruff format --check" ruff format --check backend
step "telemetry: ruff check" ruff check telemetry
step "telemetry: ruff format --check" ruff format --check telemetry
step "scripts: ruff check (maintained)" ruff check scripts/check_docs_links.py scripts/load-test-telemetry-ingest.py scripts/release/pre_release_check.py --config pyproject.toml
step "telemetry: pytest" python -m pytest telemetry -q --tb=no
step "backend: pytest (light)" bash -c 'cd backend && python run_pytest.py core/test_load_guard.py activities/test_live_map_read_policy.py activities/test_telemetry_shard.py -m simulator_light -q --tb=no'
step "docs: link check" python scripts/check_docs_links.py
step "admin: eslint" bash -c 'cd admin && npm run lint'
step "admin: tsc" bash -c 'cd admin && npx tsc --noEmit'
step "mobile: jest" bash -c 'cd mobile && npm test -- --ci --passWithNoTests'
step "repo: tokens check" npm run tokens:check

echo ""
if [[ "$failed" -eq 0 ]]; then
  echo "Baseline: all steps passed."
  exit 0
fi
echo "Baseline: $failed step(s) failed."
exit 1
