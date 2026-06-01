# Postgres disk guard (automation + audit)

Prevents repeat **"No space left on device"** during 10k–300k simulation batches on Railway Postgres.

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

Budget resolution: see `scale_disk_guard.resolve_disk_budget_gb` (env → Railway volume mount → Redis learned cache → inferred tier).

## Environment variables

```env
SCALE_AUTO_DISK_GUARD=true
SCALE_DISK_MONITOR_ENABLED=true
SCALE_POSTGRES_DISK_BUDGET_GB=20          # recommended on simulation worker
SCALE_DISK_WARN_PCT=0.80
SCALE_DISK_PAUSE_SIM_PCT=0.90
SCALE_DISK_BLOCK_WRITES_PCT=0.95
SCALE_SIM_ACTIVITY_RETENTION_DAYS=0       # optional: delete old @aktywnemiasta.pl activities
```

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
- **celery-worker-simulation**: set `SCALE_POSTGRES_DISK_BUDGET_GB` to your Postgres volume size (e.g. `20`).
- After disk-full incident: wipe or expand volume; monitor clears flags when usage drops.

See also [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) and [SCALE_TEST_300K.md](./SCALE_TEST_300K.md).
