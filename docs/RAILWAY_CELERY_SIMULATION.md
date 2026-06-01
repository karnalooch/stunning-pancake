# Railway — osobny worker symulacji (kolejka `simulation`)

Symulacja batch (10k–300k użytkowników) i live sim **nie dzielą CPU** z krytycznymi taskami (telemetry, rankingi, powiadomienia).

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
CELERY_WORKER_CONCURRENCY=7
CELERY_WORKER_HOSTNAME=simulation@%h

# Adaptacyjny batch — env opcjonalne (domyślnie liczone z total_users)
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_PARALLEL_MIN_USERS=5000
SCALE_BATCH_MAX_PARALLEL_WORKERS=6
SCALE_SKIP_DEPT_ON_BATCH=true
SCALE_BATCH_FAST_INSERT=true
DATABASE_CONN_MAX_AGE=60
SCALE_MAX_CONCURRENT_RIDERS=5000

# Automatyczny disk guard — budżet dysku z pg_database_size (opcjonalnie SCALE_POSTGRES_DISK_BUDGET_GB)
SCALE_AUTO_DISK_GUARD=true
SCALE_AUTO_WIPE_BEFORE_BATCH=true
```

**Słaby Postgres:** `SCALE_BATCH_MAX_PARALLEL_WORKERS=3`, `CELERY_WORKER_CONCURRENCY=4`.

**300k test:** `CELERY_WORKER_CONCURRENCY=7`, `SCALE_BATCH_MAX_PARALLEL_WORKERS=6` — ~10 miast × ~30k użytk., bulk ~7500.

### 4. Plan CPU

- **celery-worker-simulation**: 4–8 vCPU.
- **celery-worker**: 2–4 vCPU.

### 5. Weryfikacja logów

```text
Starting Celery SIMULATION worker: concurrency=7 queues=simulation node=simulation@...
Batch plan: 10 cities × 30,000 users, bulk=7,500, parallel≤6, ETA~45min
Parallel user creation: 10 cities × 30000 users
```

### 6. Uruchomienie batcha

1. **Nie** uruchamiaj live sim podczas batcha 300k.
2. Simulator → preset 300k lub 300000 + skip activities.
3. POST `/api/activities/admin/simulate/` zwraca `batch_plan` + ETA.

## Docker Compose (lokalnie)

```bash
docker compose up -d celery_worker celery_worker_simulation celery_beat
```

Serwis `celery_worker_simulation` — kolejka `simulation`, zmienne jak wyżej.

## Skalowanie

- Więcej równoległości DB: `SCALE_BATCH_MAX_PARALLEL_WORKERS` (nie więcej miast niż ~10 w kodzie).
- Więcej workerów CPU: `CELERY_WORKER_CONCURRENCY` lub Replicas=2 na Railway.
- Nadpisanie chunk size: `SCALE_USER_BULK_BATCH_SIZE` (np. 10000 przy bardzo mocnym Postgres).
