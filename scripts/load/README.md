# Performance / load test harness

Enterprise-standard load testing for the SPORT monorepo. **Default target: local Docker Compose.** Production requires explicit Platform Operator approval.

## Quick start (smoke tier)

```powershell
# 1. Start stack
docker compose up -d db redis backend telemetry

# 2. Run smoke suite (preflight + short ingest)
.\scripts\load\run-suite.ps1 -Suite smoke
```

```bash
chmod +x scripts/load/run-suite.sh
./scripts/load/run-suite.sh smoke
```

Reports are written to `scripts/load/reports/` (gitignored). Schema: `report_schema.json`. SLOs: `thresholds.json`.

## Tool matrix

| Tool | Path | Use case |
|------|------|----------|
| **Suite orchestrator** | `run-suite.ps1` / `run-suite.sh` | Tiered runs, JSON reports |
| **Python async harness** | `../load-test-telemetry-ingest.py` | Ingest + map p95, `--json-out` |
| **k6 live map** | `k6/live-map.js` | Distributed map read, env thresholds |
| **k6 ingest batch** | `k6/ingest-batch.js` | Distributed ingest POST |
| **Locust** | `locust/locustfile.py` | Swarm ingest + optional map |
| **Sim-lab ramp** | `../railway-load-test-ramp.ps1` | Default `SIM_LAB_API_BASE`; prod needs `ALLOW_PROD_LOAD_TEST=1` |
| **Sim-lab map audit** | `run-sim-lab-live-map-audit.ps1` | viewport-admin + stress-50k tiers, WebGL |
| **Sim-lab infra** | `../../infrastructure/sim-lab/README.md` | Isolated Docker / Railway project |

Shared batch body: `lib/packets.py` (`make_batch_body`). Report helpers: `lib/report.py`.

## Tiers

| Tier | Suite file | Ingest pps min | Map p95 max | Error rate max |
|------|------------|----------------|-------------|----------------|
| smoke | `suites/smoke.json` | 500 | 3000 ms | 5% |
| baseline | `suites/baseline.json` | 5000 | 1000 ms | 1% |
| viewport-admin | (thresholds only) | — | 2000 ms | 1% |
| stress-50k | `suites/stress-50k.json` | 45000 | 300 ms | 0.1% |
| soak | (thresholds only) | 10000 | 500 ms | 0.1% |

SSOT values live in `thresholds.json`. Suites reference tools and params; orchestrators evaluate thresholds after each run.

## Examples

```bash
# Legacy Python harness with JSON report
python scripts/load-test-telemetry-ingest.py \
  --workers 10 --duration 15 --batch-size 20 --skip-map \
  --json-out scripts/load/reports/manual-ingest.json

# k6 map (JWT required for auth)
k6 run -e JWT="$JWT" -e MAP_P95_MAX=300 scripts/load/k6/live-map.js

# Locust ingest
locust -f scripts/load/locust/locustfile.py --host http://localhost:8001
```

## CI

- Unit tests: `pytest scripts/test_load_report.py`
- Workflow: `.github/workflows/performance-smoke.yml` (ruff + pytest; optional live smoke on `workflow_dispatch`)

## Documentation

Canonical runbook: [docs/pl/operations/PERFORMANCE_TESTING.md](../../docs/pl/operations/PERFORMANCE_TESTING.md)

Telemetry-specific profiles: [docs/pl/operations/TELEMETRY_LOAD_TEST.md](../../docs/pl/operations/TELEMETRY_LOAD_TEST.md)

## Reports directory

`scripts/load/reports/` is gitignored. Do not commit load-test artifacts or secrets (JWT) embedded in reports.
