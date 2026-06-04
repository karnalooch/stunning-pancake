# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../RAILWAY_CELERY_SIMULATION.md) |
| **canonical_path** | docs/en/RAILWAY_CELERY_SIMULATION.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

Batch simulation (10k–300k) and live sim **do not share CPU** with critical tasks. **Verification:** [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) · **OOM:** [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md)

## Architecture

| Railway Service | Celery Queues | Role |
|----------------|----------------|---------------------|
| **celery-worker** | `critical`, `default`, `notifications` | API, ML, beat tasks, rankings |
| **celery-worker-simulation** | `simulation` | batch 10k–300k, live map ticks |

Both services: the same **Redis** (`REDIS_URL`) and **PostgreSQL** (`DATABASE_URL`).

## Step by step (Railway)

### 1. Main worker - no `simulation` queue

**celery-worker** → Variables:```env
CELERY_WORKER_QUEUES=critical,default,notifications
CELERY_WORKER_CONCURRENCY=4
```Redeploy.

### 2. `celery-worker-simulation` service

1. **+ New** → GitHub Repo (same repo).
2. **Dockerfile Path**: `celery-worker-simulation/Dockerfile`
3. Start Command: blank (CMD from Dockerfile).

### 3. Variables (copy from backend + below)```env
DATABASE_URL=<jak backend>
REDIS_URL=<jak backend>
SECRET_KEY=<jak backend>
DEBUG=0

CELERY_WORKER_QUEUES=simulation
CELERY_WORKER_CONCURRENCY=2
CELERY_WORKER_POOL=solo
CELERY_WORKER_PREFETCH_MULTIPLIER=1
CELERY_MAX_TASKS_PER_CHILD=50
CELERY_WORKER_HOSTNAME=simulation@%h
SCALE_MAX_STARTS_PER_LIVE_TICK=30
SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK=25
SCALE_SIM_BROUTER_ROUTE_ATTEMPTS=4

# Adaptacyjny batch — env opcjonalne (domyślnie liczone z total_users)
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_PARALLEL_MIN_USERS=5000
SCALE_BATCH_MAX_PARALLEL_WORKERS=6
SCALE_SKIP_DEPT_ON_BATCH=true
SCALE_BATCH_FAST_INSERT=true
DATABASE_CONN_MAX_AGE=60
SCALE_MAX_CONCURRENT_RIDERS=5000

# Automatyczny disk guard — ustaw budżet = rozmiar wolumenu Postgres (Railway często 5 GB)
SCALE_AUTO_DISK_GUARD=true
SCALE_AUTO_WIPE_BEFORE_BATCH=true
SCALE_POSTGRES_DISK_BUDGET_GB=5
SCALE_DISK_MONITOR_ENABLED=true
SCALE_DISK_WARN_PCT=0.80
SCALE_DISK_PAUSE_SIM_PCT=0.90
SCALE_DISK_BLOCK_WRITES_PCT=0.95
# SCALE_SIM_ACTIVITY_RETENTION_DAYS=14

# Road-following live sim (osobny serwis brouter w tym samym projekcie Railway)
BROUTER_URL=http://brouter.railway.internal:17777/brouter
SCALE_SIM_STRICT_ROAD_ROUTES=1
SCALE_SIM_SKIP_BROUTER=0
SCALE_SIM_BROUTER_MAX_LEG_KM=4
SCALE_SIM_BROUTER_START_RADIUS_KM=4
SCALE_SIM_CITY_START_RADIUS_KM=4
```Add the **brouter** service: Dockerfile `infrastructure/brouter/Dockerfile`, port **17777**, volume `/brouter/segments4`. Runbook: [operations/BROUTER.md](./operations/BROUTER.md). Without BRouter and with `STRICT_ROAD_ROUTES=1`, the rides will not start (log: `Road-only mode: skipped ...`). During the batch itself you can `SCALE_SIM_SKIP_BROUTER=1`.

**Order:** don't run live during batch - API returns 409; UI waits for the end of the batch. See [operations/SIMULATOR.md](./operations/SIMULATOR.md).

**Poor Postgres:** `SCALE_BATCH_MAX_PARALLEL_WORKERS=3`, `CELERY_WORKER_CONCURRENCY=2`, `CELERY_WORKER_POOL=solo`.

**300k test:** `CELERY_WORKER_CONCURRENCY=4` (prefork) **only with ≥4 GB RAM**, `SCALE_BATCH_MAX_PARALLEL_WORKERS=6` — ~10 cities × ~30k users, bulk ~7500.

**OOM / SIGKILL:** see [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md).

### 4. CPU Plan

- **celery-worker-simulation**: 4-8 vCPU.
- **celery-worker**: 2–4 vCPU.

### 5. Disk monitor (beat on `celery-worker`)

Beat runs `activities.tasks.monitor_postgres_disk` (`default` queue) every 5 minutes. At ≥90% of budget, Redis sets `scale:simulation_paused`; at ≥95% it also blocks activity recordings from the live sim.

- Manually: `python manage.py check_disk_guard`
- Audit: `GET /api/activities/admin/disk-audit/`
- Documentation: [DISK_GUARD.md](./DISK_GUARD.md)

### 6. Log verification```text
Starting Celery SIMULATION worker: concurrency=7 queues=simulation node=simulation@...
Batch plan: 10 cities × 30,000 users, bulk=7,500, parallel≤6, ETA~45min
Parallel user creation: 10 cities × 30000 users
```### 7. Starting the batch

1. **Don't** run live sim during batch (batch lock + `batch_blocks_live_simulation()`).
2. Wait for the `Done: … users` log and the `complete` phase, then live (`pool_pct=1.0` recommended).
3. Simulator → preset 300k or `total_users` + `skip_activities`.
4. POST `/api/activities/admin/simulate/` returns `batch_plan` + ETA.

## Docker Compose (local)```bash
docker compose up -d celery_worker celery_worker_simulation celery_beat
````celery_worker_simulation` service - `simulation` queue, variables as above.

## Scaling

- More DB parallelism: `SCALE_BATCH_MAX_PARALLEL_WORKERS` (no more cities than ~10 in the code).
- More CPU workers: `CELERY_WORKER_CONCURRENCY` or Replicas=2 on Railway.
- Chunk size override: `SCALE_USER_BULK_BATCH_SIZE` (e.g. 10000 for very powerful Postgres).
