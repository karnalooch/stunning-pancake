# Railway — Celery memory and simulation worker

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend Lead |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/RAILWAY_CELERY_MEMORY.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/RAILWAY_CELERY_MEMORY.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Last updated** | 2026-06-04 |
| **Goal** | Prevent OOM (SIGKILL), keep `routing` separate from `live_tick`, document `SCALE_*` caps. |
| **Audience** | Platform Operator, Backend Lead |
| **Checklist + script** | [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1` |

---

## Common symptoms

| Symptom | Meaning |
|---------|---------|
| `ForkPoolWorker` + **signal 9 (SIGKILL)** | OOM or hard container RAM limit |
| `WorkerLostError: Worker exited prematurely` | Worker died mid-task |
| Postgres `Connection reset by peer` | Worker died during query |
| Live tick ~0.01 s, **0 riders** | Poll continued but worker dead |
| `ride_warming` / `ROUTING` stuck | No `routing` queue consumer |

---

## Typical root cause

1. **Prefork + high concurrency** on `celery-worker-simulation` (e.g. 6–7 children × Django heap).
2. **`live_tick_task`** × many starts × **BRouter HTTP** (`SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` × profiles).
3. **`SCALE_MAX_STARTS_PER_LIVE_TICK=0`** with high `active_ratio` / `SCALE_MAX_CONCURRENT_RIDERS`.

---

## Railway CLI and agent (Cursor)

| Requirement | Notes |
|-------------|--------|
| `RAILWAY_API_TOKEN` | Windows **User** env (agent after IDE restart). Do not commit. |
| `RAILWAY_TOKEN` | Legacy — **remove**; use only `RAILWAY_API_TOKEN`. |
| Link | `railway link --project marvelous-gratitude --environment production` |
| Verification | `.\scripts\railway-verify-production.ps1` (secrets not printed) |

Optional: `.env.railway.local.example` → `.env.railway.local` (gitignored).

---

## Config as code (repo)

| Service | File | `dockerfilePath` in file |
|---------|------|--------------------------|
| `celery-worker-simulation` | `celery-worker-simulation/railway.json` | `celery-worker-simulation/Dockerfile` |
| `celery-worker-routing` | `celery-worker-routing/railway.json` | `celery-worker-simulation/Dockerfile` (shared image) |

### Dashboard or GraphQL (build / repo)

| Field | Value |
|-------|--------|
| `rootDirectory` | `/` |
| `railwayConfigFile` | `/celery-worker-simulation/railway.json` or `/celery-worker-routing/railway.json` |
| `dockerfilePath` | `/celery-worker-simulation/Dockerfile` |
| GitHub repo | `karnalooch/stunning-pancake` (**routing must use the same repo**) |

Without repo + Dockerfile Railway uses **Railpack** (e.g. `expo start` from `mobile/`) instead of Celery.

**GraphQL:** `railway-verify-production.ps1` queries `dockerfilePath`, `railwayConfigFile`, `source.repo`. **RAM is not in that query** — set under Dashboard → Resources.

---

## Recommended Railway settings

### `celery-worker-simulation` (queue `simulation`)

Copy `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `DEBUG=0` from backend.

| Variable | Recommended | Notes |
|----------|-------------|--------|
| `CELERY_WORKER_QUEUES` | `simulation` | |
| `CELERY_WORKER_POOL` | `solo` | Lowest memory |
| `CELERY_WORKER_CONCURRENCY` | `2` | With `solo`, start.sh forces `--concurrency=1` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` | |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` | Recycle after heavy ticks |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | Dispatch `route_live_ride_task` → `routing` |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | `30` | |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | `25` | |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `4` | |
| Service RAM | **≥ 4 GB** (Hobby SSOT) | 2 GB often OOM on large batch |

### `celery-worker` (critical / default / notifications)

Runs **`wipe_data_task`** on `default`. OOM in `users` phase → reduce chunks; see `SCALE_WIPE_*` and `_raw_delete` in `wipe_tasks.py`.

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_CONCURRENCY` | `2` |
| `SCALE_WIPE_CHUNK_SIZE` | `1000` |
| `SCALE_WIPE_USER_CHUNK_SIZE` | `200` |
| Service RAM | **4 GB** (`celery-worker/railway.json`) |

### `celery-worker-routing` (queue `routing`)

Live sim sends `route_live_ride_task` to **`routing`** so `live_tick` does not call BRouter synchronously.

| Option | Configuration |
|--------|----------------|
| **A — second Railway service** (prod recommended) | `celery-worker-routing/railway.json`, same Dockerfile |
| **B — single worker** | `CELERY_WORKER_QUEUES=simulation,routing` (fewer deploys; higher OOM risk) |

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_QUEUES` | `routing` |
| `CELERY_WORKER_HOSTNAME` | `routing@%h` |
| `CELERY_WORKER_POOL` | `solo` |
| `SECRET_KEY` | **Same** as backend/simulation |
| `numReplicas` | **2–3** (Hobby budget) |
| Service RAM | **2 GB / replica** |

**Verification:** [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md).

#### Horizontal routing scale

With sustained backpressure, a single `solo` worker (~1.3–1.8 s/route) may not drain the queue. **Add replicas** (`numReplicas` in `celery-worker-routing/railway.json` + GraphQL `serviceInstanceUpdate`) rather than raising `solo` concurrency. If backpressure stays pinned after scale-out, **lower `active_ratio`** (demand lever) via admin or `scripts/railway-set-live-active-ratio.ps1`.

#### Hobby RAM budget (2026-06-04)

SSOT: `*/railway.json` (`limitOverride`). Example app caps sum ~12 GB (simulation 4 + worker 4 + routing 2×2 + backend 1 + telemetry 1 + brouter 1). Limits are **per service**, not one shared 8 GB pool.

### Reliability (all workers)

| Variable | Default |
|----------|---------|
| `CELERY_TASK_ACKS_LATE` | `true` |
| `CELERY_TASK_REJECT_ON_WORKER_LOST` | `true` |

`live_tick_task` / `run_live_simulation` — autoretry on `WorkerLostError` (up to 2).

---

## Live sim self-heal

Status polls call `heal_stale_live_simulation()` when `last_tick_at` is missing for `4 × tick_seconds`. Admin: **Reset simulator locks**.

| State after worker death | Action |
|--------------------------|--------|
| `running=true`, `currently_riding=0` long | heal / reset locks |
| `live_lock_held=true`, stale `last_tick_at` | heal on poll |
| Redis `{sim}:live:tick_lock` | TTL 30s — heal on poll |

---

## Safe scaling

- **300k batch:** raise concurrency only at **≥ 4 GB** RAM; `SCALE_BATCH_MAX_PARALLEL_WORKERS` ≤ 6.
- **Large live map:** raise `SCALE_MAX_STARTS_PER_LIVE_TICK` and `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` together; watch BRouter.
- Prefer a **second simulation replica** over `CONCURRENCY=8` on a small container.

---

## Admin wizard (session override)

Simulator → Step 2 → Performance — no Railway redeploy.

| Wizard | API field | Server cap |
|--------|-----------|------------|
| New rides / tick | `max_starts_per_live_tick` | 150 |
| BRouter HTTP / tick | `brouter_max_calls_per_tick` | 100 |
| Route attempts | `brouter_route_attempts` | 8 |

**Precedence:** session → env `SCALE_*` → defaults (30 / 25 / 4).

---

## Log verification (routing)

```powershell
railway logs -s celery-worker-routing --lines 40
```

| Result | Expected |
|--------|----------|
| **PASS** | `Starting Celery …`, `routing@`, `queues=routing` |
| **FAIL** | `expo start`, Metro, `4velo@` |

---

## Rollback (Platform Operator)

1. Restore previous deployment in Railway.
2. Lower `SCALE_*` caps (tables above).
3. Emergency: `SCALE_SIM_ASYNC_ROUTING=0` (sync routing in tick — CPU/RAM spike).

---

## Related

- [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [SIMULATOR.md](./SIMULATOR.md)
- [BROUTER.md](./BROUTER.md)
- [../../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md)
