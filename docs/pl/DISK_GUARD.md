# Postgres disk guard (automation + audit)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](en/DISK_GUARD.md) |
| **canonical_path** | docs/pl/DISK_GUARD.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

**Powiązane:** [operations/SIMULATOR.md](./operations/SIMULATOR.md) · [SCALE_TEST_300K.md](./SCALE_TEST_300K.md) · API: `GET /api/activities/admin/disk-audit/`

Zapobiega powtórce **"No space left on device"** przy batchach 10k–300k na Railway Postgres.

## Layers

| Layer | When | What |
|-------|------|------|
| **Preflight** | Admin scale-preflight / batch start | Estimates disk, auto-wipe, chunk tuning (`scale_disk_guard.prepare_batch_disk_guard`) |
| **Monitor** | Every 5 min (Celery beat) + `manage.py check_disk_guard` | Measures `pg_database_size` vs budget, sets Redis flags, writes `DiskAuditEvent` |
| **Runtime gates** | Each batch city task, live tick, `simulate_active_cities.run` | Refuses work if paused / over threshold |

## Thresholds (defaults)

| Usage % of budget | Action |
|-------------------|--------|
| ≥ 80% | Audit `warn` |
| ≥ 90% | Redis `scale:simulation_paused=1` — no new batch/live sim |
| ≥ 95% | Also `scale:disk_writes_blocked=1` — live sim skips `Activity` bulk_create |
| &lt; 80% | Clears Redis flags, audit `cleared` on transition |

Budget resolution: see `scale_disk_guard.resolve_disk_budget_gb` (env → Railway volume mount → Redis learned cache → inferred tier → **5 GB floor** when DB is empty after wipe).

## Environment variables

```env
SCALE_AUTO_DISK_GUARD=true
SCALE_DISK_MONITOR_ENABLED=true
# Required on Railway if volume is not mounted on this service (typical for celery-worker):
SCALE_POSTGRES_DISK_BUDGET_GB=5          # Railway Postgres volumes are often 5 GB max
SCALE_DISK_WARN_PCT=0.80
SCALE_DISK_PAUSE_SIM_PCT=0.90
SCALE_DISK_BLOCK_WRITES_PCT=0.95
SCALE_SIM_ACTIVITY_RETENTION_DAYS=0       # optional: delete old @aktywnemiasta.pl activities
```

If `SCALE_POSTGRES_DISK_BUDGET_GB` is unset, the guard assumes **5 GB** when `pg_database_size` is small (after wipe). That is conservative for common Railway caps but **must** match your real volume — otherwise monitoring under-reports usage (e.g. 4.5 GB used on a 5 GB disk looked like 45% of a 10 GB budget and never paused sims).

When the budget comes from `empty_db_floor` or `default`, logs emit `disk_guard: Postgres budget …` and a once-per-day audit event `budget_unconfigured` reminds you to set the env var.

## Operations

**Manual check (SSH / Railway shell on backend or worker with DATABASE_URL):**

```bash
python manage.py check_disk_guard
python manage.py check_disk_guard --retention   # if retention days > 0
```

**Audit API (admin JWT):**

`GET /api/activities/admin/disk-audit/?limit=100`

Returns recent events + current usage and flag state.

**Django admin:** Activities → Disk audit events (read-only).

## Railway

- **celery-worker** (with beat): runs `activities.tasks.monitor_postgres_disk` every 5 minutes on `default` queue.
- **backend** and **celery-worker-simulation**: set `SCALE_POSTGRES_DISK_BUDGET_GB=5` (or your actual Postgres volume size in GB).
- After disk-full incident: wipe or expand volume; monitor clears flags when usage drops.

See also [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) and [SCALE_TEST_300K.md](./SCALE_TEST_300K.md).
