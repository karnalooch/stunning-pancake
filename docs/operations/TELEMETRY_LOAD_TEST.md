# Telemetry load test — 50k ingest scaffold

| | |
|--|--|
| **Status** | Scaffold — run on local/staging only |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Powiązane:** [TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md) · [EVENT_BURST_50K.md](../EVENT_BURST_50K.md) · [SCALE_TEST_300K.md](../SCALE_TEST_300K.md)

## Goal

Validate the platform can sustain:

| Metric | Target |
|--------|--------|
| Telemetry ingest | **>= 50 000 positions/s** sustained (burst OK higher) |
| Live map API p95 | **< 300 ms** at country zoom (`/api/activities/telemetry/live/`) |
| Error rate | < 0.1% (429 acceptable under deliberate over-cap) |

**Do not run the full 50k profile against production without explicit Platform Operator approval.**

## Prerequisites

- Target environment: **local Docker Compose** or **staging** with telemetry sharding enabled (`TELEMETRY_SHARD_COUNT=4+`).
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

Use the admin simulator or API to publish >= 10k active riders into Redis so the
live-map read path has data. For a pure ingest test, skip this step.

**JWT for map reads:** the live-map endpoint requires auth. Obtain a staff JWT
(Django admin login or API token) and pass it to the load script:

```bash
python scripts/load-test-telemetry-ingest.py \
  --preflight --preflight-count \
  --token "$JWT" \
  --map-url http://localhost:8000/api/activities/telemetry/live/
```

### 3. Run ingest load script

```bash
# Local example — 50 workers, 60s, batch size 50
python scripts/load-test-telemetry-ingest.py \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 50 \
  --duration 60 \
  --batch-size 50 \
  --target-rate 50000
```

The script reports:

- achieved requests/s and positions/s
- p50 / p95 / p99 POST latency
- 429 count (backpressure)

### 4. Measure live-map p95

While ingest runs (or immediately after simulator warm-up):

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
| Environment | local Podman Compose (podman machine; no Docker Desktop) |
| `TELEMETRY_SHARD_COUNT` | 4 (`.env` + `docker-compose.override.yml`) |
| `REDIS_TELEMETRY_SHARD_NODES` | `redis://redis:6379/0-3` |
| Ingest positions/s (sustained) | **9558** baseline (pre-fix, 50k profile); see post-fix rows below |
| Ingest p95 ms | **409.6** baseline (50k run) |
| Live map p95 ms | **55.2** p95 but 3597 errors / 0 OK (empty Redis index, unauth) |
| 429 rate | 0% |
| Pass / Fail | **FAIL** vs 50k target (<90% of 50000/s) — see interpretation below |

## Interpretacja FAIL przy target-rate 50000

A **FAIL** at `--target-rate 50000` often means the **client or laptop is server-limited**, not that production cannot hit 50k:

- The script throttles workers to approximate the target; if achieved pps stays flat as you raise `--workers`, you hit a **local bottleneck** (CPU, httpx, Windows loopback).
- Use **`--target-rate 0`** (unlimited) for **max-laptop** throughput — reports what the stack accepts without artificial throttle.
- Set **`TELEMETRY_SKIP_DB=1`** on telemetry to isolate HTTP + Redis guard path (no TimescaleDB writes).
- Compare **req/s** vs **positions/s** (`batch-size` multiplier); tune `TELEMETRY_INGEST_BATCH_SIZE`, `UVICORN_WORKERS`, pool sizes.

PASS/FAIL at a fixed target is a **harness check**, not a production SLO sign-off.

## Benchmark profiles

### max-laptop (pure throughput)

```env
# docker-compose.override.yml or .env
TELEMETRY_SKIP_DB=1
TELEMETRY_SKIP_BROADCAST=1
TELEMETRY_INGEST_BATCH_SIZE=200
GLOBAL_MAX_INGEST_PER_SECOND=60000
UVICORN_WORKERS=1
```

```bash
podman compose up -d --build telemetry   # or docker compose
python scripts/load-test-telemetry-ingest.py \
  --preflight \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 80 --duration 60 --batch-size 100 --target-rate 0 --skip-map
```

### skip-db bench (telemetry side)

Same as max-laptop: `TELEMETRY_SKIP_DB=1` skips DB insert but runs dedupe + ingest guard.

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
| A skip-db, workers 80, batch 100, target 0 | **13338** | 2074.3 | TELEMETRY_SKIP_DB=1, 0 errors |
| B normal DB, workers 50, batch 50, target 0 | **6351** | 1337.2 | full path, 0 errors |
| Baseline (pre-fix) 50k target | 9558 | 409.6 | workers 50, batch 50, throttled target |

**Local run notes (2026-06-04):** Stack via podman compose: db, redis, brouter, backend (:8000), telemetry (:8001), celery_worker_simulation, traccar. **BRouter:** image localhost/sport_brouter:latest; HTTP **200** on :17777/brouter after pre-downloading minimal .rd5 tiles to infrastructure/brouter/segments4/ and BROUTER_SEGMENT_PRESET=minimal in docker-compose.override.yml (default poland preset fails on :ro volume — read-only file system). Windows: set `PYTHONIOENCODING=utf-8` if console encoding issues persist (script uses ASCII `>=` for PASS/FAIL).

## Script reference

`scripts/load-test-telemetry-ingest.py` — async HTTP client using `httpx`:

- `--workers` — concurrent POST tasks
- `--batch-size` — packets per `/ingest/batch` body
- `--target-rate` — throttle to approximate positions/s (0 = unlimited)
- `--skip-map` — ingest only, no live-map phase
- `--token` / `--auth-header` — JWT for map API
- `--preflight` / `--preflight-count` — health checks before run
- `--map-url` + `--map-only` — live-map read benchmark mode

## Production note

For Railway prod (`marvelous-gratitude`), set shard env vars via Dashboard or CLI
(see [TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md)). Use **observational** prod
checks only (health, p95 from Datadog) until a scheduled load-test window is approved.
