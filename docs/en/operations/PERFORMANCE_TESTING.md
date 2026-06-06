# Performance and load testing (enterprise standard)


| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Platform Operator, Backend, Tech Lead |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/PERFORMANCE_TESTING.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-05 |
| **canonical_path** | docs/en/operations/PERFORMANCE_TESTING.md |

---

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Platform Operator, Backend |

**Related:** [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [VERIFICATION.md](../../quality/VERIFICATION.md) · `scripts/load/README.md`

## Purpose

Unified performance-testing standard for the monorepo: tiers, tools, SLOs, JSON reports, CI, and a production approval gate.

**Default target:** **sim-lab** (`infrastructure/sim-lab/`) — local Docker or a separate Railway project. Production requires `ALLOW_PROD_LOAD_TEST=1` and Platform Operator approval.

## Sim-lab (isolated simulation)

See [infrastructure/sim-lab/README.md](../../../infrastructure/sim-lab/README.md). Key scripts: `preflight-sim-lab.ps1`, `sync-sim-lab-profile.ps1`, `run-300k-wipe-batch.ps1`, `railway-load-test-ramp.ps1` (default `SIM_LAB_API_BASE`).

## Harness layout

```
scripts/load/
  README.md              # quick start
  thresholds.json        # SSOT SLOs (smoke, baseline, stress-50k, soak)
  report_schema.json     # unified report v1
  lib/report.py          # build / validate / merge / evaluate
  lib/packets.py         # shared batch body (Locust)
  k6/live-map.js         # live map reads
  k6/ingest-batch.js     # ingest batch POST
  locust/locustfile.py   # HttpUser ingest + map
  suites/*.json          # tier definitions
  run-suite.ps1 / .sh    # orchestrator
  reports/               # gitignored
```

Legacy (backward compatible): `scripts/load-test-telemetry-ingest.py` (`--json-out`), `scripts/load-test-telemetry-map.k6.js` (points to `scripts/load/k6/live-map.js`).

## Tiers and SLOs

Canonical values: `scripts/load/thresholds.json`.

| Tier | Ingest pps min | Map p95 max | Error rate max | Typical duration |
|------|----------------|-------------|----------------|------------------|
| **smoke** | 500 | 3000 ms | 5% | ~10 s ingest |
| **baseline** | 5000 | 1000 ms | 1% | ~30 s |
| **stress-50k** | 45000 | 300 ms | 0.1% | 60 s, throttled 50k |
| **soak** | 10000 | 500 ms | 0.1% | >= 30 min |

A laptop FAIL at `stress-50k` does not automatically mean production FAIL — see [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md).

## Tools

| Tool | Path | When |
|------|------|------|
| **Orchestrator** | `run-suite.ps1` / `run-suite.sh` | smoke/baseline/stress tiers with JSON report |
| **Python httpx** | `load-test-telemetry-ingest.py` | Ingest + map p95, `--json-out` |
| **k6** | `scripts/load/k6/*.js` | Distributed reads/ingest, env thresholds |
| **Locust** | `scripts/load/locust/locustfile.py` | Swarm on staging/cluster |
| **Railway ramp** | `scripts/railway-load-test-ramp.ps1` | Operator window on prod only |

### Smoke (local)

```powershell
docker compose up -d db redis backend telemetry
.\scripts\load\run-suite.ps1 -Suite smoke
```

```bash
./scripts/load/run-suite.sh smoke
```

### Baseline with map (JWT)

```powershell
.\scripts\load\run-suite.ps1 -Suite baseline -Jwt $env:JWT
```

### k6

```bash
k6 run -e JWT="$JWT" -e MAP_P95_MAX=300 scripts/load/k6/live-map.js
k6 run scripts/load/k6/ingest-batch.js
```

## Observability checklist

During every tier >= baseline, capture:

| Signal | Where |
|--------|-------|
| Ingest queue | `GET /api/telemetry/ingest/queue/stats` |
| Celery / simulator | Flower (compose), `celery-worker-simulation` logs |
| Redis shards | `TELEMETRY_SHARD_COUNT`, per-shard latency |
| Datadog | Ingest + live map APM dashboards (observational on prod) |
| Prometheus | Compose profile with exporters (if enabled) |
| Guard engaged | `GLOBAL_PROTECTION_MODE`, Live Map badge |

## Production gate

1. **Do not** run full `stress-50k` / soak on prod without operator approval.
2. Prod: health, Datadog p95, queue observation — no synthetic storm without a scheduled window.
3. Railway ramp: `scripts/railway-load-test-ramp.ps1` only with `ADMIN_PASS` in CI secrets or locally.

## CI

| Workflow | Scope |
|----------|--------|
| `ci.yml` job `scripts-python` | `pytest scripts/test_load_report.py` |
| `performance-smoke.yml` | Ruff `scripts/load` + pytest; optional live smoke (`workflow_dispatch`, `run_live_smoke=true`) |
| Cron | Monthly (1st day, 06:00 UTC) — harness unit tests only |

Live smoke in CI requires Docker on the runner; step is skipped when services are unreachable (`continue-on-error`).

## Report format

Schema: `scripts/load/report_schema.json` v1.

```json
{
  "schema_version": "1",
  "suite": "smoke",
  "tier": "smoke",
  "metrics": { "ingest": { "positions_per_second": 1200, "latency_ms": { "p95": 45 } } },
  "threshold_evaluation": { "tier": "smoke", "pass": true, "checks": [] }
}
```

Reports go to `scripts/load/reports/` (gitignored). Do not commit JWTs.

## When to run

- After ingest / live map / sharding changes
- Before a 50k event (stress-50k on cluster or approved window)
- Monthly smoke in CI (unit) + quarterly live smoke locally
