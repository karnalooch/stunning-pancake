# Railway — osobny worker symulacji (kolejka `simulation`)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](en/RAILWAY_CELERY_SIMULATION.md) |
| **canonical_path** | docs/pl/RAILWAY_CELERY_SIMULATION.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

Symulacja batch (10k–300k) i live sim **nie dzielą CPU** z taskami krytycznymi. **Weryfikacja:** [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) · **OOM:** [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md)

## Architektura

| Serwis Railway | Kolejki Celery | Rola |
|----------------|----------------|------|
| **celery-worker** | `critical`, `default`, `notifications` | API, ML, beat tasks, rankingi |
| **celery-worker-simulation** | `simulation` | batch 10k–300k, live map ticks |

Oba serwisy: ten sam **Redis** (`REDIS_URL`) i **PostgreSQL** (`DATABASE_URL`).

## Krok po kroku (Railway)

### 1. Główny worker — bez kolejki `simulation`

**celery-worker** → Variables:

```env
CELERY_WORKER_QUEUES=critical,default,notifications
CELERY_WORKER_CONCURRENCY=4
```

Redeploy.

### 2. Serwis `celery-worker-simulation`

1. **+ New** → GitHub Repo (to samo repo).
2. **Dockerfile Path**: `celery-worker-simulation/Dockerfile`
3. Start Command: puste (CMD z Dockerfile).

### 3. Zmienne (skopiuj z backendu + poniższe)

```env
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
```

Dodaj serwis **brouter**: Dockerfile `infrastructure/brouter/Dockerfile`, port **17777**, volume `/brouter/segments4`. Runbook: [operations/BROUTER.md](./operations/BROUTER.md). Bez BRouter przy `STRICT_ROAD_ROUTES=1` jazdy nie wystartują (log: `Road-only mode: skipped …`). Na czas samego batcha można `SCALE_SIM_SKIP_BROUTER=1`.

**Kolejność:** nie uruchamiaj live podczas batcha — API zwraca 409; UI czeka na koniec batcha. Zobacz [operations/SIMULATOR.md](./operations/SIMULATOR.md).

**Słaby Postgres:** `SCALE_BATCH_MAX_PARALLEL_WORKERS=3`, `CELERY_WORKER_CONCURRENCY=2`, `CELERY_WORKER_POOL=solo`.

**300k test:** `CELERY_WORKER_CONCURRENCY=4` (prefork) **tylko przy ≥4 GB RAM**, `SCALE_BATCH_MAX_PARALLEL_WORKERS=6` — ~10 miast × ~30k użytk., bulk ~7500.

**OOM / SIGKILL:** zobacz [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md).

### 4. Plan CPU

- **celery-worker-simulation**: 4–8 vCPU.
- **celery-worker**: 2–4 vCPU.

### 5. Disk monitor (beat na `celery-worker`)

Beat co 5 min uruchamia `activities.tasks.monitor_postgres_disk` (kolejka `default`). Przy ≥90% budżetu ustawia Redis `scale:simulation_paused`; przy ≥95% także blokuje zapisy aktywności z live sim.

- Ręcznie: `python manage.py check_disk_guard`
- Audit: `GET /api/activities/admin/disk-audit/`
- Dokumentacja: [DISK_GUARD.md](./DISK_GUARD.md)

### 6. Weryfikacja logów

```text
Starting Celery SIMULATION worker: concurrency=7 queues=simulation node=simulation@...
Batch plan: 10 cities × 30,000 users, bulk=7,500, parallel≤6, ETA~45min
Parallel user creation: 10 cities × 30000 users
```

### 7. Uruchomienie batcha

1. **Nie** uruchamiaj live sim podczas batcha (batch lock + `batch_blocks_live_simulation()`).
2. Poczekaj na log `Done: … users` i fazę `complete`, potem live (`pool_pct=1.0` zalecane).
3. Simulator → preset 300k lub `total_users` + `skip_activities`.
4. POST `/api/activities/admin/simulate/` zwraca `batch_plan` + ETA.

## Docker Compose (lokalnie)

```bash
docker compose up -d celery_worker celery_worker_simulation celery_beat
```

Serwis `celery_worker_simulation` — kolejka `simulation`, zmienne jak wyżej.

## Skalowanie

- Więcej równoległości DB: `SCALE_BATCH_MAX_PARALLEL_WORKERS` (nie więcej miast niż ~10 w kodzie).
- Więcej workerów CPU: `CELERY_WORKER_CONCURRENCY` lub Replicas=2 na Railway.
- Nadpisanie chunk size: `SCALE_USER_BULK_BATCH_SIZE` (np. 10000 przy bardzo mocnym Postgres).
