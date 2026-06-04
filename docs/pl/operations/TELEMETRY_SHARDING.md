# Telemetry horizontal sharding


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/TELEMETRY_SHARDING.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/TELEMETRY_SHARDING.md |

---

| | |
|--|--|
| **Status** | Phase 2 shipped · prod rollout ready |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Powiązane:** [EVENT_BURST_50K.md](../../EVENT_BURST_50K.md) · [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md)

## Problem

`TelemetryService` keeps every active rider in **two single Redis keys**:

- `telemetry:positions` — a hash (`deviceId → JSON`)
- `telemetry:geo` — a GEO index for `GEORADIUS` live-map reads

At true 50k+ simultaneous ingest, that single hash + GEO set is the ceiling: one
Redis slot owns the data, `GEORADIUS` scans one large index, and writes contend on
one key. Reads are already bounded (active-only, TTL 120 s, `GEORADIUS + HMGET`,
never `HGETALL`), but the **write/index side does not scale horizontally**.

## Design

A deterministic **shard router** (`backend/activities/telemetry_shard.py`) spreads
the live-position index across `N` logical shards keyed by `deviceId`.

```
shard = crc32(deviceId) % TELEMETRY_SHARD_COUNT
```

- `crc32` (not Python `hash()`) → stable across processes and restarts.
- Each shard gets its own key pair with a **Redis Cluster hash tag** `{tel:<i>}`
  so the pair shares a slot and pipelines stay single-slot:
  - `{tel:3}:telemetry:positions`
  - `{tel:3}:telemetry:geo`

### Write path (single shard per device)
`push_simulator_position` and `replace_active_positions` route each device to its
own shard via `TelemetryShardRouter.client_for(index)`. The full-replace path
deletes per shard pair and re-writes via one pipeline **per shard client**.

### Read path (parallel fan-out + merge)
`get_live_positions` fans the `GEORADIUS` query across **all** shards **in parallel**
(`ThreadPoolExecutor`, capped by `TELEMETRY_SHARD_READ_WORKERS`), then merges and
de-duplicates by `deviceId`, capped at the requested limit.

### Backward compatibility (critical)
`TELEMETRY_SHARD_COUNT=1` (**default**) returns the **exact legacy key names**
(`telemetry:positions`, `telemetry:geo`). No data migration, no behaviour change.
Sharding only activates when an operator sets the count `> 1`. Hard-capped at 256.

## Deployment modes

| Mode | Config | Honest capacity |
|------|--------|-----------------|
| **Legacy** | `TELEMETRY_SHARD_COUNT=1` | Same as before |
| **Phase 1 — Cluster hash tags** | `TELEMETRY_SHARD_COUNT>1`, no `REDIS_TELEMETRY_SHARD_NODES`, `REDIS_CLUSTER_NODES` set | Keys spread across cluster masters — **recommended** if you have Redis Cluster |
| **Phase 2a — Logical DBs (interim)** | `TELEMETRY_SHARD_COUNT=4`, `REDIS_TELEMETRY_SHARD_NODES=redis://host:6379/0,...,/3` on **one** Railway Redis | Smaller per-key indexes; **same CPU/RAM** — not true horizontal scale |
| **Phase 2b — Dedicated instances** | `REDIS_TELEMETRY_SHARD_NODES` pointing at **separate** Redis volumes | True horizontal telemetry scale independent of session/leaderboard Redis |

`TelemetryShardRouter.client_for(index)` reads `REDIS_TELEMETRY_SHARD_NODES` (comma-separated
URLs). When unset, all shards share `core.redis_cluster.get_redis()` (standalone or cluster).

## Rollout

### Phase 0 — default (no change)
`TELEMETRY_SHARD_COUNT=1`. Identical to today.

### Phase 1 — shard on Redis Cluster (recommended when cluster exists)
1. Run a Redis Cluster and set `REDIS_CLUSTER_NODES` (see `core/redis_cluster.py`).
2. Set `TELEMETRY_SHARD_COUNT` to a multiple of the master count (e.g. `12` for
   3 masters → 4 shards/master). Keys' hash tags distribute across masters.
3. Live-map reads fan out across shards automatically in parallel.

```env
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379
TELEMETRY_SHARD_COUNT=12
```

### Phase 2 — per-shard Redis routing (shipped)
Set `REDIS_TELEMETRY_SHARD_NODES` so each shard index maps to a dedicated URL.

**Railway prod (single Redis addon — Phase 2a interim):** derive four logical DBs from
the same host (replace `REDIS_HOST` / password from Railway Variables):

```env
TELEMETRY_SHARD_COUNT=4
REDIS_TELEMETRY_SHARD_NODES=redis://default:PASSWORD@REDIS_HOST:6379/0,redis://default:PASSWORD@REDIS_HOST:6379/1,redis://default:PASSWORD@REDIS_HOST:6379/2,redis://default:PASSWORD@REDIS_HOST:6379/3
```

**True horizontal (Phase 2b):** provision separate Redis services on Railway (or
Redis Cluster addon) and list one URL per shard. Session/leaderboard Redis stays on
`REDIS_URL`; telemetry shards scale independently.

### Services that need these env vars (Railway `marvelous-gratitude` / production)

| Service | Required vars |
|---------|----------------|
| **Backend** (Django API — live map reads) | `TELEMETRY_SHARD_COUNT`, optional `REDIS_TELEMETRY_SHARD_NODES`, `TELEMETRY_SHARD_READ_WORKERS` |
| **celery-worker-simulation** (simulator writes) | Same as backend |
| **Telemetry** (FastAPI ingest — TimescaleDB, not Redis shards for live map) | `TELEMETRY_DB_POOL_*`, `TELEMETRY_INGEST_BATCH_SIZE`, `GLOBAL_*` ingest caps |

Simulator live-map positions are written by the simulation worker; the FastAPI
telemetry service handles GPS **history** ingest to Postgres. Both need ingest
backpressure vars; only backend + simulation need shard routing for Redis.

### Acceptance for "true 50k simultaneous ingest"
Phase 2b (or Phase 1 cluster) + load test showing sustained **≥ 50k positions/s**
ingest and live-map **p95 < 300 ms** at country zoom. See [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md).

**Do not run full 50k against production without Platform Operator sign-off.**

## Env reference

```env
# 1 (default) = legacy single key. >1 = N shards (hash-tagged). Hard cap 256.
TELEMETRY_SHARD_COUNT=4

# Phase 2: comma-separated Redis URLs, one per shard index (cycles if fewer URLs than shards)
# REDIS_TELEMETRY_SHARD_NODES=redis://redis:6379/0,redis://redis:6379/1,...

# Parallel GEORADIUS fan-out (default min(shards, 8))
# TELEMETRY_SHARD_READ_WORKERS=8

# FastAPI telemetry ingest (TimescaleDB)
# TELEMETRY_DB_POOL_MIN=5
# TELEMETRY_DB_POOL_MAX=30
# TELEMETRY_INGEST_BATCH_SIZE=100
# TELEMETRY_INGEST_FLUSH_MS=50
```

## Tests

```bash
cd backend && python run_pytest.py activities/test_telemetry_shard.py core/test_load_guard.py -m simulator_light -v --tb=short
```
