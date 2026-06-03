# Railway — Celery memory & simulation worker

Production incidents on Railway often show:

- `ForkPoolWorker` killed with **signal 9 (SIGKILL)** → container **OOM** or hard memory limit
- `WorkerLostError: Worker exited prematurely`
- Postgres `could not receive data from client: Connection reset by peer` (worker died mid-query)
- Live sim ticks completing in ~0.01s with **no riders** (poll advanced `last_tick_at` before work, or worker died)

**Checklist operacyjny:** [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) · **Skrypt:** `scripts/railway-verify-production.ps1`

## Root cause (typical)

1. **Prefork + high concurrency** on `celery-worker-simulation` (e.g. 6–7 children × full Django heap).
2. **`live_tick_task`** starting many rides per tick × **BRouter HTTP** (`SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` × profiles).
3. Unbounded **`SCALE_MAX_STARTS_PER_LIVE_TICK=0`** on large `active_ratio` / `SCALE_MAX_CONCURRENT_RIDERS`.

## Railway CLI & Cursor agent

| Wymaganie | Uwagi |
|-----------|--------|
| `RAILWAY_API_TOKEN` | Ustaw w **Windows User environment** (Cursor/agent dziedziczy po restarcie IDE). Nie commituj. |
| `RAILWAY_TOKEN` | Legacy — **usuń**; używaj tylko `RAILWAY_API_TOKEN`. |
| Link | `railway link --project marvelous-gratitude --environment production` |
| Weryfikacja | `.\scripts\railway-verify-production.ps1` (bez drukowania sekretów) |

Opcjonalnie lokalnie: `.env.railway.local.example` → `.env.railway.local` (gitignored).

## Config as code (repo)

| Serwis | Plik | `dockerfilePath` w pliku |
|--------|------|---------------------------|
| `celery-worker-simulation` | `celery-worker-simulation/railway.json` | `celery-worker-simulation/Dockerfile` |
| `celery-worker-routing` | `celery-worker-routing/railway.json` | `celery-worker-simulation/Dockerfile` (wspólny obraz) |

W Dashboard (lub GraphQL `serviceInstanceUpdate`) dla każdego serwisu monorepo:

- `rootDirectory`: `/`
- `railwayConfigFile`: `/celery-worker-simulation/railway.json` lub `/celery-worker-routing/railway.json`
- `dockerfilePath`: `/celery-worker-simulation/Dockerfile`
- **GitHub repo:** `karnalooch/stunning-pancake` (routing **musi** mieć ten sam repo co simulation)

Bez repo + Dockerfile Railway wybiera **Railpack** (np. `expo start` z `mobile/`) zamiast Celery.

## Recommended Railway settings

### `celery-worker-simulation` (queue `simulation`)

Źródło: `celery-worker-simulation/railway.json` + `DATABASE_URL` / `REDIS_URL` / `SECRET_KEY` z backendu.

| Variable | Recommended | Notes |
|----------|-------------|--------|
| `CELERY_WORKER_QUEUES` | `simulation` | |
| `CELERY_WORKER_POOL` | `solo` | One process, lowest memory |
| `CELERY_WORKER_CONCURRENCY` | `2` | Przy `solo` start.sh wymusza `--concurrency=1` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` | Avoid hoarding long `live_tick` / batch tasks |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` | Recycle after memory-heavy ticks |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | Dispatch `route_live_ride_task` na kolejkę `routing` |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | `30` | Cap new riders per tick |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | `25` | Hard cap on BRouter HTTP per tick |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `4` | Retries per start (was 12) |
| Service RAM | **≥ 2 GB** | 512 MB–1 GB often OOM under prefork=6–7 |

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

### `celery-worker-routing` (queue `routing`)

Paczka 1: live sim wysyła `route_live_ride_task` na kolejkę **`routing`**, żeby `live_tick` nie wykonywał BRouter HTTP synchronicznie.

| Opcja | Konfiguracja |
|-------|----------------|
| **A — drugi serwis Railway** | Repo + Dockerfile jak simulation; `celery-worker-routing/railway.json`. |
| **B — jeden worker** | `CELERY_WORKER_QUEUES=simulation,routing` na `celery-worker-simulation` (mniejsze deployy; większe ryzyko OOM). |

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_QUEUES` | `routing` |
| `CELERY_WORKER_HOSTNAME` | `routing@%h` |
| `CELERY_WORKER_POOL` | `solo` |
| `CELERY_WORKER_CONCURRENCY` | `2` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` |
| `SCALE_SIM_ASYNC_ROUTING` | `1` (backend + simulation + routing) |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | `30` (domyślnie = max starts) |
| `SECRET_KEY` | **Ten sam** co backend/simulation |
| Service RAM | **≥ 1 GB** |

### Weryfikacja logów (routing)

```powershell
railway logs -s celery-worker-routing --lines 40
```

| Wynik | Oczekiwane |
|-------|------------|
| **PASS** | `Starting Celery …`, `routing@`, `queues=routing` |
| **FAIL** | `expo start`, `Metro Bundler`, `npm warn` z `4velo@` |

Deploy po poprawce konfiguracji:

```powershell
railway service link celery-worker-routing
railway up -s celery-worker-routing -e production --detach
```

Bez konsumenta kolejki `routing` jazdy zostaną w `PENDING_ROUTE` / `ROUTING` — status API pokaże `ride_warming` > 0.

See also [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md), [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md), [SIMULATOR.md](./SIMULATOR.md), [BROUTER.md](./BROUTER.md), [../admin/P1_ROADMAP.md](../admin/P1_ROADMAP.md).
