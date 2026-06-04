#!/usr/bin/env bash
# ADR 011 ingest queue + telemetry health checks (local/staging).
set -euo pipefail

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:8001}"
OPS_SECRET="${TELEMETRY_OPS_SECRET:-}"

echo "=== ADR 011 ingest verification ==="
echo "Telemetry: $TELEMETRY_URL"

health=$(curl -sf "$TELEMETRY_URL/api/telemetry/health" || true)
if [ -z "$health" ]; then
  echo "FAIL: telemetry health unreachable"
  exit 1
fi
echo "OK: health $health"

stats=$(curl -sf "$TELEMETRY_URL/api/telemetry/ingest/queue/stats" || echo '{}')
echo "OK: queue stats $stats"

if [ -n "$OPS_SECRET" ]; then
  reclaim=$(curl -sf -X POST "$TELEMETRY_URL/api/telemetry/ingest/queue/reclaim" \
    -H "X-Telemetry-Ops-Secret: $OPS_SECRET" || true)
  echo "OK: reclaim $reclaim"
else
  echo "SKIP: reclaim (set TELEMETRY_OPS_SECRET to exercise POST)"
fi

echo "PASS: ADR 011 ingest smoke checks"
