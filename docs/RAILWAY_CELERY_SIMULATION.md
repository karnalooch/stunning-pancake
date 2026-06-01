# Railway — osobny worker symulacji (kolejka `simulation`)

Symulacja batch (300k użytkowników) i live sim **nie dzielą już CPU** z krytycznymi taskami (telemetry, rankingi, powiadomienia).

## Architektura

| Serwis Railway | Kolejki Celery | Rola |
|----------------|----------------|------|
| **celery-worker** | `critical`, `default`, `notifications` | API, ML, beat tasks, rankingi |
| **celery-worker-simulation** | `simulation` | batch 300k, live map ticks |

Oba serwisy łączą się z tym samym **Redis** (`REDIS_URL`) i **PostgreSQL** (`DATABASE_URL`) co backend.

## Krok po kroku (Railway)

### 1. Główny worker — usuń kolejkę `simulation`

W istniejącym serwisie **celery-worker** → **Variables**:

```env
CELERY_WORKER_QUEUES=critical,default,notifications
CELERY_WORKER_CONCURRENCY=4
```

Zrób **Redeploy** celery-worker.

### 2. Nowy serwis symulacji

1. W projekcie Railway: **+ New** → **GitHub Repo** (to samo repo).
2. Nazwa serwisu: `celery-worker-simulation`.
3. **Settings** → **Build**:
   - **Root Directory**: zostaw pusty / `.` (root repozytorium).
   - **Dockerfile Path**: `celery-worker-simulation/Dockerfile`
4. **Settings** → **Deploy** → **Start Command**: zostaw puste (CMD z Dockerfile).

### 3. Zmienne środowiskowe (skopiuj z backendu + worker)

W **celery-worker-simulation** → **Variables** (te same co backend, minimum):

```env
DATABASE_URL=<jak backend>
REDIS_URL=<jak backend>
SECRET_KEY=<jak backend>
DEBUG=0

# Worker symulacji — więcej CPU tutaj
CELERY_WORKER_QUEUES=simulation
CELERY_WORKER_CONCURRENCY=7
CELERY_WORKER_HOSTNAME=simulation@%h
CELERY_LOG_LEVEL=info

# Batch 300k — równoległe miasta
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_PARALLEL_MIN_USERS=5000
SCALE_USER_BULK_BATCH_SIZE=2500
SCALE_USER_BULK_PG_BATCH_SIZE=500
SCALE_MAX_CONCURRENT_RIDERS=5000
```

### 4. Plan CPU

- **celery-worker-simulation**: plan z **4–8 vCPU** (batch + opcjonalnie live sim).
- **celery-worker**: mniejszy plan (2–4 vCPU) wystarczy na `critical` / `notifications`.

### 5. Weryfikacja w logach

Po starcie **celery-worker-simulation** powinno być:

```text
Starting Celery SIMULATION worker: concurrency=7 queues=simulation node=simulation@...
```

W **celery-worker** (bez simulation):

```text
Starting Celery worker: concurrency=4 queues=critical,default,notifications
```

### 6. Uruchomienie batcha

1. **Nie** uruchamiaj live sim podczas batcha 300k (opcjonalnie po zakończeniu).
2. Simulator → preset 300k (bez aktywności) → Launch.
3. W logach **celery-worker-simulation** zobaczysz `Parallel user creation: N cities` i postęp per miasto.

## Docker Compose (lokalnie)

W `docker-compose.yml` są dwa serwisy: `celery_worker` i `celery_worker_simulation`.

```bash
docker compose up -d celery_worker celery_worker_simulation celery_beat
```

## Skalowanie

- **Więcej równoległości**: zwiększ `CELERY_WORKER_CONCURRENCY` na serwisie simulation.
- **Druga replika**: Railway → celery-worker-simulation → **Replicas: 2** (dwa kontenery × concurrency — więcej równoległych tasków per miasto).
