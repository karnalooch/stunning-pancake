# Railway — Celery memory & simulation worker

Production incidents on Railway often show:

- `ForkPoolWorker` killed with **signal 9 (SIGKILL)** → container **OOM** or hard memory limit
- `WorkerLostError: Worker exited prematurely`
- Postgres `could not receive data from client: Connection reset by peer` (worker died mid-query)
- Live sim ticks completing in ~0.01s with **no riders** (poll advanced `last_tick_at` before work, or worker died)

## Root cause (typical)

1. **Prefork + high concurrency** on `celery-worker-simulation` (e.g. 6–7 children × full Django heap).
2. **`live_tick_task`** starting many rides per tick × **BRouter HTTP** (`SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` × profiles).
3. Unbounded **`SCALE_MAX_STARTS_PER_LIVE_TICK=0`** on large `active_ratio` / `SCALE_MAX_CONCURRENT_RIDERS`.

## Recommended Railway settings

### `celery-worker-simulation` (queue `simulation`)

| Variable | Recommended | Notes |
|----------|-------------|--------|
| `CELERY_WORKER_POOL` | `solo` | One process, lowest memory; use for live sim + moderate batch |
| `CELERY_WORKER_CONCURRENCY` | `2` | Only for `prefork`; match vCPU, not RAM |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` | Avoid hoarding long `live_tick` / batch tasks |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` | Recycle workers after memory-heavy ticks |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | `30` | Cap new riders per tick |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | `25` | Hard cap on BRouter HTTP per tick |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `4` | Retries per start (was 12) |
| Service RAM | **≥ 2 GB** | 512 MB–1 GB often OOM under prefork=6 |

### `celery-worker` (critical / default / notifications)

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_CONCURRENCY` | `4` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `4` |
| `CELERY_MAX_TASKS_PER_CHILD` | `500` |

### Reliability (all workers — set in Django `settings.py`, override via env)

| Variable | Default |
|----------|---------|
| `CELERY_TASK_ACKS_LATE` | `true` |
| `CELERY_TASK_REJECT_ON_WORKER_LOST` | `true` |

`live_tick_task` / `run_live_simulation` **autoretry** on `WorkerLostError` (up to 2).

## Live sim self-heal

Status polls call `heal_stale_live_simulation()` when ticks stall (no `last_tick_at` for `4 × tick_seconds`). Or use admin **Reset simulator locks**.

Signs of stuck state after worker death:

- `running=true` but `currently_riding=0` for a long time
- `live_lock_held=true` with stale `last_tick_at`
- Redis `{sim}:live:tick_lock` left until TTL (30s) — healed on poll

## Scaling up safely

- **300k batch:** raise concurrency only with **≥ 4 GB** RAM; keep `SCALE_BATCH_MAX_PARALLEL_WORKERS` ≤ 6.
- **Large live map:** increase `SCALE_MAX_STARTS_PER_LIVE_TICK` and `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` together; monitor BRouter latency.
- Prefer **second simulation replica** over `CELERY_WORKER_CONCURRENCY=8` on one small container.

## Admin wizard sliders (per-session overrides)

In **Simulator → Step 2 → Performance**, admins can tune live spawn rate without redeploying Railway env vars. Values are sent as `scale_overrides` on batch/live start and stored in Redis simulator state.

| Wizard control | API field | Server hard cap |
|----------------|-----------|-----------------|
| New rides per tick | `max_starts_per_live_tick` | 150 |
| BRouter HTTP per tick | `brouter_max_calls_per_tick` | 100 |
| Route snap attempts | `brouter_route_attempts` | 8 |

**Precedence:** session override → env (`SCALE_*`) → code default (30 / 25 / 4).

**Presets:** Eco 25/21, Balanced 50/42, Fast 80/66 (starts / linked BRouter calls). Raise both together; if workers OOM, lower starts first, then route attempts.

See also [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md), [SIMULATOR.md](./SIMULATOR.md), [BROUTER.md](./BROUTER.md).
