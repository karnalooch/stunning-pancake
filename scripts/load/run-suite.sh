#!/usr/bin/env bash
# Run a performance test suite tier and emit a JSON report.
# Usage: ./scripts/load/run-suite.sh smoke
set -euo pipefail

SUITE="${1:-}"
if [[ -z "$SUITE" ]]; then
  echo "Usage: $0 <smoke|baseline|stress-50k>" >&2
  exit 1
fi

LOAD_ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$LOAD_ROOT/../.." && pwd)"
SUITE_PATH="$LOAD_ROOT/suites/$SUITE.json"
REPORTS_DIR="${REPORTS_DIR:-$LOAD_ROOT/reports}"
INGEST_URL="${INGEST_URL:-http://localhost:8001/api/telemetry/ingest/batch}"
MAP_URL="${MAP_URL:-http://localhost:8000/api/activities/telemetry/live/}"
JWT="${JWT:-}"

mkdir -p "$REPORTS_DIR"
export PYTHONPATH="$LOAD_ROOT"

TIER="$(python -c "import json; print(json.load(open('$SUITE_PATH'))['tier'])")"
TARGET="$(python -c "import json; print(json.load(open('$SUITE_PATH'))['environment']['target'])")"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PARTIAL_LIST="$REPORTS_DIR/.${SUITE}-partials.txt"
: > "$PARTIAL_LIST"

preflight_pass=false
if python -c "import json; exit(0 if json.load(open('$SUITE_PATH')).get('preflight') else 1)"; then
  echo "=== Preflight ==="
  preflight_pass=true
  telemetry_health="${INGEST_URL%/api/telemetry/ingest/batch}/api/telemetry/health"
  if ! curl -sf "$telemetry_health" >/dev/null 2>&1; then
    echo "Telemetry health unreachable: $telemetry_health"
    preflight_pass=false
  fi
  backend_health="$(python -c "from urllib.parse import urlparse; u=urlparse('$MAP_URL'); print(f'{u.scheme}://{u.netloc}/health/')")"
  if ! curl -sf "$backend_health" >/dev/null 2>&1; then
    echo "Backend health unreachable: $backend_health"
    preflight_pass=false
  fi
else
  preflight_pass=true
fi

INGEST_SCRIPT="$REPO_ROOT/scripts/load-test-telemetry-ingest.py"
read -r WORKERS DURATION BATCH_SIZE TARGET_RATE < <(
  python -c "
import json
s = [x for x in json.load(open('$SUITE_PATH'))['steps'] if x['tool'] == 'python-ingest'][0]['params']
print(s['workers'], s['duration'], s['batch_size'], s['target_rate'])
"
)

if [[ "$preflight_pass" == "true" ]]; then
  json_out="$REPORTS_DIR/${SUITE}-python-ingest-$(date -u +%Y%m%d-%H%M%S).json"
  args=(
    "$INGEST_SCRIPT"
    --url "$INGEST_URL"
    --workers "$WORKERS"
    --duration "$DURATION"
    --batch-size "$BATCH_SIZE"
    --target-rate "$TARGET_RATE"
    --skip-map
    --json-out "$json_out"
  )
  [[ -n "$JWT" ]] && args+=(--token "$JWT")
  python "${args[@]}" || true
  echo "$json_out" >> "$PARTIAL_LIST"
else
  echo "Preflight failed - emitting report with empty metrics"
fi

FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REPORT_OUT="$REPORTS_DIR/${SUITE}-${FINISHED_AT//:/}.json"
PF_FLAG=""
[[ "$preflight_pass" == "true" ]] && PF_FLAG="--preflight-pass"

python "$LOAD_ROOT/merge_partial_reports.py" \
  --suite "$SUITE" \
  --tier "$TIER" \
  --started-at "$STARTED_AT" \
  --finished-at "$FINISHED_AT" \
  --ingest-url "$INGEST_URL" \
  --map-url "$MAP_URL" \
  --target "$TARGET" \
  $PF_FLAG \
  --partials-file "$PARTIAL_LIST" \
  --out "$REPORT_OUT"

rm -f "$PARTIAL_LIST"
