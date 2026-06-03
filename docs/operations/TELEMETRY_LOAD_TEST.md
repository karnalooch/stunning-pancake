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
| Telemetry ingest | **≥ 50 000 positions/s** sustained (burst OK higher) |
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

Use the admin simulator or API to publish ≥ 10k active riders into Redis so the
live-map read path has data. For a pure ingest test, skip this step.

### 3. Run ingest load script

```bash
# Local example — 50 workers, 60s, batch size 50 → up to ~50k/s depending on hardware
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
  --map-workers 10 \
  --map-duration 30 \
  --map-only
```

Record p95; target **< 300 ms** at country zoom (`?zoom=6` or default bbox).

### 5. Fill results template

| Field | Value |
|-------|-------|
| Date | |
| Environment | local / staging |
| `TELEMETRY_SHARD_COUNT` | |
| `REDIS_TELEMETRY_SHARD_NODES` | yes / no / cluster |
| Ingest positions/s (sustained) | |
| Ingest p95 ms | |
| Live map p95 ms | |
| 429 rate | |
| Pass / Fail | |

## Script reference

`scripts/load-test-telemetry-ingest.py` — async HTTP client using `httpx`:

- `--workers` — concurrent POST tasks
- `--batch-size` — packets per `/ingest/batch` body
- `--target-rate` — throttle to approximate positions/s (0 = unlimited)
- `--map-url` + `--map-only` — live-map read benchmark mode

## Production note

For Railway prod (`marvelous-gratitude`), set shard env vars via Dashboard or CLI
(see [TELEMETRY_SHARDING.md](./TELEMETRY_SHARDING.md)). Use **observational** prod
checks only (health, p95 from Datadog) until a scheduled load-test window is approved.
