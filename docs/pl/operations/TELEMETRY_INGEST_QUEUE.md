# Telemetry ingest queue — Redis Streams ops (ADR 011)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](.././TELEMETRY_INGEST_QUEUE.md) |
| **canonical_path** | docs/pl/operations/TELEMETRY_INGEST_QUEUE.md |

---

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Related:** [ADR 011](../../adr/011-telemetry-ingest-durability-under-load.md) · [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [EVENT_BURST_50K.md](../../EVENT_BURST_50K.md)

## Overview

When ingest guard engages, active-session batches may be **202-accepted** into a Redis Stream (`telemetry:ingest:queue` by default). Background drain workers (`telemetry/ingest_queue.py`) `XREADGROUP` → sort → Timescale insert → `XACK`.

| Stream | Purpose |
|--------|---------|
| `TELEMETRY_INGEST_STREAM` | Primary ingest queue |
| `TELEMETRY_INGEST_DLQ` | Dead-letter after max deliveries or parse failure |

## Key env vars (Railway / Compose)

```env
TELEMETRY_INGEST_QUEUE=1
TELEMETRY_INGEST_STREAM=telemetry:ingest:queue
TELEMETRY_INGEST_DLQ=telemetry:ingest:dead
TELEMETRY_INGEST_STREAM_MAXLEN=500000
TELEMETRY_INGEST_MAX_DEPTH=400000
TELEMETRY_INGEST_DRAIN_BATCH=2000
TELEMETRY_INGEST_MAX_DELIVERY=5
TELEMETRY_INGEST_PEL_IDLE_MS=60000
TELEMETRY_INGEST_RECLAIM_INTERVAL_S=30
TELEMETRY_OPS_SECRET=            # optional; required for manual reclaim POST
# Drain insert path (default: sorted executemany + ON CONFLICT)
TELEMETRY_DRAIN_USE_COPY=0        # 1 = asyncpg copy_records_to_table (no ON CONFLICT)
```

## Metrics & inspection

### HTTP stats (no secret)

```bash
curl -s "$TELEMETRY_URL/api/telemetry/ingest/queue/stats"
```

Response fields: `xlen`, `dlq_xlen`, `pel.pending`, `pel.min_idle_ms`, `pel.max_idle_ms`.

### Redis CLI

```bash
redis-cli XLEN telemetry:ingest:queue
redis-cli XLEN telemetry:ingest:dead
redis-cli XPENDING telemetry:ingest:queue telemetry-drainers
```

## PEL reclaim

Automatic: drain loop runs `XAUTOCLAIM` every `TELEMETRY_INGEST_RECLAIM_INTERVAL_S` (default 30s) for entries idle longer than `TELEMETRY_INGEST_PEL_IDLE_MS` (default 60s).

Manual (ops):

```bash
curl -X POST "$TELEMETRY_URL/api/telemetry/ingest/queue/reclaim" \
  -H "X-Telemetry-Ops-Secret: $TELEMETRY_OPS_SECRET"
```

If `TELEMETRY_OPS_SECRET` is unset, reclaim endpoint is open (staging only — set secret in prod).

## DLQ replay (manual)

1. Inspect DLQ: `XRANGE telemetry:ingest:dead - + COUNT 10`
2. Fix root cause (schema, DB pool, bad payload).
3. Copy `data` field back to main stream with `XADD` or re-post via HTTP ingest/backfill.
4. `XACK` / trim DLQ entries after verification.

Never silently drop DLQ messages without ops sign-off.

## Timescale drain path

**Default (chosen):** `executemany` with `INSERT … ON CONFLICT DO NOTHING` after sorting rows by `(activity_id, time, seq)` in `telemetry/db.py` and per-message in `ingest_queue.py`.

**Optional:** `TELEMETRY_DRAIN_USE_COPY=1` uses `copy_records_to_table` for higher throughput; **does not** apply `ON CONFLICT` — use only when duplicate replay risk is acceptable (e.g. load tests with `TELEMETRY_SKIP_DB=0` and unique `(activity_id, time, seq)`).

## Verification

```bash
./scripts/verify-adr011-ingest.sh
```

See [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) — engaged-guard scenario with mobile outbox.
