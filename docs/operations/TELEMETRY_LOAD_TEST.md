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
| Live map p95 ms | **1177.4** (290 OK / 132 err, warmed Redis `ride_active=1020`) |
| 429 rate | 0% |
| Pass / Fail | **FAIL** vs 50k ingest target; **FAIL** vs live-map p95 <300 ms on laptop under 1k riders |

## Interpretacja FAIL przy target-rate 50000

A **FAIL** at `--target-rate 50000` often means the **client or laptop is server-limited**, not that production cannot hit 50k:

- The script throttles workers to approximate the target; if achieved pps stays flat as you raise `--workers`, you hit a **local bottleneck** (CPU, httpx, Windows loopback).
- Use **`--target-rate 0`** (unlimited) for **max-laptop** throughput — reports what the stack accepts without artificial throttle.
- Set **`TELEMETRY_SKIP_DB=1`** on telemetry to isolate HTTP + Redis guard path (no TimescaleDB writes).
- Compare **req/s** vs **positions/s** (`batch-size` multiplier); tune `TELEMETRY_INGEST_BATCH_SIZE`, `UVICORN_WORKERS`, pool sizes.

PASS/FAIL at a fixed target is a **harness check**, not a production SLO sign-off.

## ADR 011 — ingest engaged + mobile outbox

When `GLOBAL_MAX_INGEST_PER_SECOND` is exceeded (or `GLOBAL_PROTECTION_MODE=on`):

1. Telemetry returns **202** (queued) or **429/503** with `Retry-After` — not silent drops for authenticated active sessions when queue admits.
2. **Mobile clients with outbox enabled** must keep points until ACK (`202` with `acked` / `inserted` confirmation). Expect **0 point loss** on instrumented builds under engaged guard.
3. Verify queue depth drains: `curl $TELEMETRY_URL/api/telemetry/ingest/queue/stats` — see [TELEMETRY_INGEST_QUEUE.md](./TELEMETRY_INGEST_QUEUE.md).

```bash
# Harness: no HTTP errors during ingest storm (mobile outbox tested separately in Jest)
python scripts/load-test-telemetry-ingest.py \
  --url http://localhost:8001/api/telemetry/ingest/batch \
  --workers 30 --duration 45 --batch-size 20 --target-rate 0 \
  --assert-outbox

./scripts/verify-adr011-ingest.sh
```

## ADR 011 — live map read shedding (P2)

When `guard_snapshot().signals.ingest.engaged` is true (or force with `GLOBAL_PROTECTION_MODE=on` + synthetic load):

1. `GET /api/activities/telemetry/live/` response `meta` includes `ingest_engaged: true`, `live_poll_interval_multiplier` (default **2.5**), optional `live_detail_ceiling`.
2. Admin Live Map shows an **Ingest load** badge and slows polling automatically.
3. Tune via `.env`: `LIVE_MAP_INGEST_CAP_RATIO`, `LIVE_MAP_INGEST_POLL_RATIO`, `LIVE_MAP_INGEST_CACHE_TTL`, `LIVE_MAP_INGEST_DETAIL_CEILING`.

Unit tests: `backend/activities/test_live_map_read_policy.py`.

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
| C live map read, workers 10, 30s, warmed sim | — | **1177.4** | 290 OK / 132 err; `ride_active=1020`, JWT auth |
| Baseline (pre-fix) 50k target | 9558 | 409.6 | workers 50, batch 50, throttled target |

**Local run notes (2026-06-04):** Stack via podman compose: db, redis, brouter, backend (:8000), telemetry (:8001), celery_worker_simulation, traccar. **Map warm-up:** `scripts/warm-simulator-for-map-test.ps1` (grid routes via `SCALE_SIM_SKIP_BROUTER=1` + `SCALE_SIM_STRICT_ROAD_ROUTES=0` in `docker-compose.override.yml`; fixes wrong `.env` `BROUTER_URL` port 17878→17777). **BRouter:** image localhost/sport_brouter:latest; HTTP **200** on :17777/brouter after pre-downloading minimal .rd5 tiles to infrastructure/brouter/segments4/ and BROUTER_SEGMENT_PRESET=minimal in docker-compose.override.yml (default poland preset fails on :ro volume — read-only file system). Windows: set `PYTHONIOENCODING=utf-8` if console encoding issues persist (script uses ASCII `>=` for PASS/FAIL).

### Map warm-up helper

```powershell
# Creates/syncs global_owner, bootstraps 6k athletes, starts live-sim, waits for ride_active >= 1000
.\scripts\warm-simulator-for-map-test.ps1 -StopExisting

# Then benchmark (paste JWT from script output):
python scripts/load-test-telemetry-ingest.py `
  --map-only --preflight `
  --map-url http://localhost:8000/api/activities/telemetry/live/ `
  --token $JWT --map-workers 10 --map-duration 30
```

## Phase 3 — distributed load (deferred)

For multi-node soak / 50k sustained validation beyond laptop limits:

| Tool | Status | Notes |
|------|--------|-------|
| **k6** | Stub | `scripts/load-test-telemetry-map.k6.js` — live-map read; `k6 run -e JWT=... scripts/load-test-telemetry-map.k6.js` |
| **Locust** | Deferred | Reuse ingest URL + batch body from `load-test-telemetry-ingest.py` when a staging cluster is available |

Requires explicit Platform Operator approval before prod or shared staging.

## Closure (2026-06-04)

| Item | Status | Evidence |
|------|--------|----------|
| Ingest scaffold + skip-db / DB-on profiles | **DONE** | Profiles A/B above; commit `ff0f0ba4` |
| Live map warm-up + authenticated benchmark | **DONE** | Profile C; `warm-simulator-for-map-test.ps1`; 290 OK @ p95 1177 ms (laptop, 1020 riders) |
| Live map p95 < 300 ms SLO | **DEFERRED** | Laptop FAIL (1177 ms p95, 132 timeouts); re-test on staging / prod observability |
| 50k positions/s sustained | **DEFERRED** | Laptop ceiling ~13k skip-db; Railway prod **8 CPU / 8 GB** total — distributed k6/Locust + operator window; **no prod 50k without consent** |
| Phase 2 sharding prod env | **DONE** | `TELEMETRY_SHARD_COUNT=4` on backend + simulation (prior session) |
| Separate Railway Telemetry service | **DONE** (2026-06-04) | Serwis `telemetry` w `marvelous-gratitude`; `rootDirectory=/telemetry`, `TELEMETRY_SKIP_DB=0`, `TELEMETRY_DB_POOL_MAX=30`, `TELEMETRY_INGEST_BATCH_SIZE=200`, `UVICORN_WORKERS=2`, Backend `TELEMETRY_URL=http://telemetry.railway.internal:8001`, RAM 1 GB |
| k6 distributed stub | **DONE** | `scripts/load-test-telemetry-map.k6.js` |
| Locust full harness | **DEFERRED** | Phase 3 |

## Script reference

`scripts/load-test-telemetry-ingest.py` — async HTTP client using `httpx`:

- `--workers` — concurrent POST tasks
- `--batch-size` — packets per `/ingest/batch` body
- `--target-rate` — throttle to approximate positions/s (0 = unlimited)
- `--skip-map` — ingest only, no live-map phase
- `--token` / `--auth-header` — JWT for map API
- `--preflight` / `--preflight-count` — health checks before run
- `--assert-outbox` — exit non-zero if any ingest HTTP errors (ADR 011 engaged-guard companion)
- `--map-url` + `--map-only` — live-map read benchmark mode

## Production note

For Railway prod (`marvelous-gratitude`, **8 GB / 8 vCPU plan**), set shard env vars via Dashboard or CLI
(see [TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md)). Dedicated `telemetry` service (1 GB, 2 uvicorn workers).
Use **observational** prod checks only (health, p95 from Datadog) until a scheduled load-test window is approved.
Map benchmarks: use `detail=summary` and warm-up target **500** riders (`warm-simulator-for-map-test.ps1 -MinRideActive 500`).
