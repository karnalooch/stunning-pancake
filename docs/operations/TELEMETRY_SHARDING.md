# Telemetry horizontal sharding

| | |
|--|--|
| **Status** | Foundation shipped · multi-instance phased |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator, Backend |

**Powiązane:** [EVENT_BURST_50K.md](../EVENT_BURST_50K.md) · [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) · [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)

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
own shard. The full-replace path deletes per shard pair (single-slot safe) and
re-writes via one pipeline.

### Read path (fan-out + merge)
`get_live_positions` fans the `GEORADIUS` query across **all** shards, then
`HMGET`s each shard for the ids it owns, merging and de-duplicating by `deviceId`,
capped at the requested limit. City/bbox/zoom caps from `scale_config` still apply,
so a poll is `O(N_shards)` bounded `GEORADIUS` calls — keep `N` modest (4–16).

### Backward compatibility (critical)
`TELEMETRY_SHARD_COUNT=1` (**default**) returns the **exact legacy key names**
(`telemetry:positions`, `telemetry:geo`). No data migration, no behaviour change.
Sharding only activates when an operator sets the count `> 1`. Hard-capped at 256.

## What ships now vs. phased

| Item | Status |
|------|--------|
| `TelemetryShardRouter` (selection, key naming, fan-out helpers) | ✅ Done |
| Shard-aware writes (`push_simulator_position`, `replace_active_positions`, `clear`) | ✅ Done |
| Shard-aware fan-out reads (`get_live_positions`, per-city) | ✅ Done |
| Backward-compatible single-shard default | ✅ Done |
| Always-on telemetry ingest backpressure (Django signal + FastAPI 429) | ✅ Done |
| Unit tests (`activities/test_telemetry_shard.py`) | ✅ Done |
| **Multi-instance routing** (one dedicated Redis per shard) | 🟡 Phased — see below |

### Honest limitation

The router spreads keys across **slots**, not yet across **separate Redis
instances**. `core.redis_cluster.get_redis()` still returns a single client.

- On a **single standalone Redis**: sharding splits the one big hash/GEO set into
  `N` smaller ones. This relieves single-key hotspots and shrinks each `GEORADIUS`
  index, but the same instance still does all the work — it is **not** true
  horizontal scaling.
- On a **Redis Cluster** (`REDIS_CLUSTER_NODES` set): the `{tel:i}` hash tags
  distribute shards across the cluster masters, so ingest/read load genuinely
  spreads across nodes up to the cluster size. **This is the recommended path to
  approach 50k simultaneous ingest today.**

## Rollout

### Phase 0 — default (no change)
`TELEMETRY_SHARD_COUNT=1`. Identical to today.

### Phase 1 — shard on Redis Cluster (recommended)
1. Run a Redis Cluster and set `REDIS_CLUSTER_NODES` (see `core/redis_cluster.py`).
2. Set `TELEMETRY_SHARD_COUNT` to a multiple of the master count (e.g. `12` for
   3 masters → 4 shards/master). Keys' hash tags distribute across masters.
3. Live-map reads fan out across shards automatically. Watch p95 read latency;
   reduce `N` if fan-out dominates.

```env
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379
TELEMETRY_SHARD_COUNT=12
```

### Phase 2 — dedicated per-shard instances (future, not implemented)
Introduce `TelemetryShardRouter.client_for(index)` backed by
`REDIS_TELEMETRY_SHARD_NODES=url0,url1,...` so each shard maps to a dedicated Redis
process independent of the main cache. This removes the "single `get_redis()`
client" constraint and lets telemetry scale independently of leaderboard/session
Redis. Read fan-out would issue per-shard pipelines in parallel.

**Acceptance for "true 50k simultaneous ingest":** Phase 2 + load test showing
sustained ≥ 50k positions/s ingest and live-map p95 < 300 ms at country zoom.

## Env reference

```env
# 1 (default) = legacy single key. >1 = N shards (hash-tagged). Hard cap 256.
TELEMETRY_SHARD_COUNT=1
```

## Tests

```bash
cd backend && python run_pytest.py activities/test_telemetry_shard.py -m simulator_light -v --tb=short
```
