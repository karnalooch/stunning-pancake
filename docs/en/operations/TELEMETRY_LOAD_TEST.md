# Telemetry load test — 50k ingest scaffold

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/TELEMETRY_LOAD_TEST.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/TELEMETRY_LOAD_TEST.md |

---

| | |
|--|--|
| **Status** | Scaffold — run on local/staging only |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Related:** [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) · [TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md) · [../EVENT_BURST_50K.md](../EVENT_BURST_50K.md) · [../SCALE_TEST_300K.md](../SCALE_TEST_300K.md)

## Goal

Validate the platform can sustain:

| Metric | Target |
|--------|--------|
| Telemetry ingest | **≥ 50 000 positions/s** sustained (burst may be higher) |
| Live map API p95 | **< 300 ms** at country zoom (`/api/activities/telemetry/live/`) |
| Error rate | < 0.1% (429 acceptable under deliberate over-cap) |

**Do not run the full 50k profile against production without explicit Platform Operator approval.**

## Prerequisites

- Target environment: **local Docker Compose** or **staging** with telemetry sharding (`TELEMETRY_SHARD_COUNT=4+`).
- FastAPI telemetry service reachable (`TELEMETRY_URL`).
- Django backend reachable for live-map reads (`BACKEND_URL` or `API_URL`).
- Optional: Redis monitoring, Datadog dashboards.

## Procedure

### 1. Enable sharding on the target environment

```env
TELEMETRY_SHARD_COUNT=4
REDIS_TELEMETRY_SHARD_NODES=redis://redis:6379/0,redis://redis:6379/1,redis://redis:6379/2,redis://redis:6379/3
TELEMETRY_DB_POOL_MAX=30
TELEMETRY_INGEST_BATCH_SIZE=200
GLOBAL_MAX_INGEST_PER_SECOND=60000
```

Restart **backend**, **celery-worker-simulation**, and **telemetry** after changing vars.

### 2. Warm simulator positions (Redis live index)

Use the admin simulator or API to publish ≥ 10k active riders into Redis so the live-map read path has data. For ingest-only tests, skip this step.

**JWT for map reads:** the live-map endpoint requires auth. Obtain a staff JWT (Django admin or API token) and pass it to the load script:

```bash
python scripts/load-test-telemetry-ingest.py \
  --preflight --preflight-count \
  --token "$JWT" \
  --map-url http://localhost:8000/api/activities/telemetry/live/
```

### 3. Run ingest load script

```bash
python scripts/load-test-telemetry-ingest.py \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 50 \
  --duration 60 \
  --batch-size 50 \
  --target-rate 50000
```

The script reports achieved req/s and positions/s, p50/p95/p99 POST latency, and 429 count (backpressure).

### 4. Measure live-map p95

```bash
python scripts/load-test-telemetry-ingest.py \
  --map-url http://localhost:8000/api/activities/telemetry/live/ \
  --token "$JWT" \
  --map-workers 10 \
  --map-duration 30 \
  --map-only
```

Record p95; target **< 300 ms** at country zoom (`?zoom=6` or default bbox).

### 5. Fill results template

| Field | Value |
|-------|-------|
| Date | 2026-06-04 |
| Environment | local Podman Compose |
| `TELEMETRY_SHARD_COUNT` | 4 |
| Ingest positions/s (sustained) | see post-fix table |
| Live map p95 ms | see post-fix table |
| Pass / Fail | harness vs targets (not prod SLO) |

## Interpreting FAIL at `--target-rate 50000`

A **FAIL** at `--target-rate 50000` often means the **client or laptop is the bottleneck**, not that production cannot reach 50k:

- The script throttles workers to approximate the target; flat throughput as you add workers indicates a **local limit** (CPU, httpx, loopback).
- Use **`--target-rate 0`** (unlimited) for max-laptop throughput.
- Set **`TELEMETRY_SKIP_DB=1`** on telemetry to isolate HTTP + Redis guard (no Timescale writes).
- Compare **req/s** vs **positions/s** (`batch-size` multiplier).

PASS/FAIL at a fixed target is a **harness check**, not a production SLO sign-off.

## ADR 011 — ingest engaged + mobile outbox

When `GLOBAL_MAX_INGEST_PER_SECOND` is exceeded (or `GLOBAL_PROTECTION_MODE=on`):

1. Telemetry returns **202** (queued) or **429/503** with `Retry-After` — not silent drops for authenticated active sessions when the queue admits work.
2. Mobile clients with outbox enabled must retain points until ACK (`202` with `acked` / `inserted`).
3. Verify queue drain: `curl $TELEMETRY_URL/api/telemetry/ingest/queue/stats` — [TELEMETRY_INGEST_QUEUE.md](./TELEMETRY_INGEST_QUEUE.md).

```bash
python scripts/load-test-telemetry-ingest.py \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 30 --duration 45 --batch-size 20 --target-rate 0 \
  --assert-outbox

./scripts/verify-adr011-ingest.sh
```

## ADR 011 — live map read shedding

When `guard_snapshot().signals.ingest.engaged` is true:

1. `GET /api/activities/telemetry/live/` `meta` includes `ingest_engaged: true`, `live_poll_interval_multiplier` (default **2.5**), optional `live_detail_ceiling`.
2. Admin Live Map shows **Ingest load** and slows polling.
3. Tune: `LIVE_MAP_INGEST_CAP_RATIO`, `LIVE_MAP_INGEST_POLL_RATIO`, `LIVE_MAP_INGEST_CACHE_TTL`, `LIVE_MAP_INGEST_DETAIL_CEILING`.

Unit tests: `backend/activities/test_live_map_read_policy.py`.

## Benchmark profiles

### max-laptop (throughput)

```env
TELEMETRY_SKIP_DB=1
TELEMETRY_SKIP_BROADCAST=1
TELEMETRY_INGEST_BATCH_SIZE=200
GLOBAL_MAX_INGEST_PER_SECOND=60000
UVICORN_WORKERS=1
```

```bash
python scripts/load-test-telemetry-ingest.py \
  --preflight \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 80 --duration 60 --batch-size 100 --target-rate 0 --skip-map
```

### normal ingest (with DB)

```bash
TELEMETRY_SKIP_DB=0 TELEMETRY_SKIP_BROADCAST=0 \
python scripts/load-test-telemetry-ingest.py \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 50 --duration 60 --batch-size 50 --target-rate 0 --skip-map
```

## Post-fix results (2026-06-04)

| Profile | positions/s | p95 ms | Notes |
|---------|-------------|--------|-------|
| A skip-db, workers 80, batch 100 | **13338** | 2074.3 | `TELEMETRY_SKIP_DB=1`, 0 errors |
| B normal DB, workers 50, batch 50 | **6351** | 1337.2 | full path, 0 errors |
| C live map, workers 10, 30s | — | **1177.4** | 290 OK / 132 err; `ride_active=1020` |
| Baseline 50k target | 9558 | 409.6 | throttled target |

**Map warm-up:**

```powershell
.\scripts\warm-simulator-for-map-test.ps1 -StopExisting
python scripts/load-test-telemetry-ingest.py `
  --map-only --preflight `
  --map-url http://localhost:8000/api/activities/telemetry/live/ `
  --token $JWT --map-workers 10 --map-duration 30
```

## Phase 3 — distributed load

| Tool | Status | Notes |
|------|--------|-------|
| **Suite orchestrator** | Active | `scripts/load/run-suite.ps1` — see [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) |
| **k6** | Active | `scripts/load/k6/live-map.js`, `scripts/load/k6/ingest-batch.js`; legacy `scripts/load-test-telemetry-map.k6.js` |
| **Locust** | Active | `scripts/load/locust/locustfile.py` — shared batch via `scripts/load/lib/packets.py` |

Requires Platform Operator approval before prod or shared staging.

## Closure (2026-06-04)

| Item | Status |
|------|--------|
| Ingest scaffold + profiles A/B | **DONE** |
| Live map warm-up + benchmark | **DONE** |
| Live map p95 < 300 ms SLO | **DEFERRED** (laptop; re-test staging/prod) |
| 50k positions/s sustained | **DEFERRED** (cluster or operator window) |
| k6 / Locust harness | **DONE** (`scripts/load/k6/`, `scripts/load/locust/`) |
| Enterprise load standard | **DONE** ([PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md), `scripts/load/`) |
| Phase 2 sharding prod | **DONE** (`TELEMETRY_SHARD_COUNT=4`) |
| Railway `telemetry` service | **DONE** (2026-06-04) |

## Script reference

`scripts/load-test-telemetry-ingest.py` — async `httpx` client: `--workers`, `--batch-size`, `--target-rate`, `--skip-map`, `--token`, `--preflight`, `--assert-outbox`, `--json-out`, `--report-tier`, `--map-url`, `--map-only`.

## Production note

For Railway prod (`marvelous-gratitude`), set shard env via Dashboard or CLI ([TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md)). Use **observational** prod checks until a load-test window is approved. Map benchmarks: `detail=summary`, warm-up **500** riders (`warm-simulator-for-map-test.ps1 -MinRideActive 500`).
