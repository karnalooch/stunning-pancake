# Test skali 300 000 użytkowników

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

**Runbook:** [operations/SIMULATOR.md](./operations/SIMULATOR.md) · **Railway:** [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) · **Dysk:** [DISK_GUARD.md](./DISK_GUARD.md)

> **Dzień eventu (~50k):** [EVENT_BURST_50K.md](./EVENT_BURST_50K.md)

## Root cause (Railway 300k run)

| Symptom | Cause | Fix |
|---------|--------|-----|
| `No space left on device` on `pgsql_tmp` during `bulk_create` | Large multi-row INSERTs (pbkdf2 password field × 2500+ rows) + parallel city workers exhaust Postgres **disk** (temp files + WAL), not just RAM | Smaller `SCALE_USER_BULK_PG_BATCH_SIZE` / adaptive pg chunks (100–250 at 300k); sub-chunked `bulk_create` inside transaction; **≥10 GB** Postgres volume; wipe before run |
| `run_live_simulation` failed in `set_live_pool_from_db` | Fallback `User.objects.filter(role='ATHLETE').iterator()` = full table scan | Removed; tiered pool: **db** ≥50k, **redis capped** 5k–50k, **redis full** &lt;5k; bounded `[:quota]` queries only |
| `BRouter unavailable — grid fallback` spam | Live tick logs every ride when `BROUTER_URL` missing on simulation worker | Throttled live_log (first 3, then 1/hour); `BROUTER_URL` on `celery-worker-simulation`; optional `SCALE_SIM_SKIP_BROUTER=1` during batch |

## Co się **zawieszało** (przed poprawkami)

| Warstwa | Problem | Skutek |
|---------|---------|--------|
| **Redis** | `HGETALL telemetry:positions` przy każdym odświeżeniu mapy | Setki MB RAM, sekundy blokady |
| **Celery tick** | `SMEMBERS` całej puli 300k + lista w Pythonie | OOM / tick > 30s |
| **Live sim** | `active_ratio × 300k` ≈ 90k jazd w `sim:live:rides` | Redis + tick nie nadąża |
| **PostgreSQL** | `exists()` × 300k przy seedzie użytkowników | Godziny insertów |
| **PostgreSQL** | `iterator()` na całej tabeli `users` przy uzupełnianiu puli live | Brak miejsca na dysku / timeout |
| **PostgreSQL** | Generowanie aktywności GPS dla 300k | Dni + terabajty |
| **Frontend** | JSON z tysiącami punktów + kropki + ikony | Zamrożenie karty przeglądarki |
| **Admin dashboard** | `COUNT` / pętla per-tenant na ogromnych tabelach | Wolne ładowanie KPI |
| **Batch progress** | `HINCRBY` + `HSET` na każdy `bulk_create` chunk | Redis i UI przy 300k |

## Co jest **bezpieczne** po implementacji

- **Batch 300k** — jeden hash hasła `_athlete_password_hash()` dla wszystkich athlete; pg inserty po 100–250 wierszy; `skip_activities` wymuszane ≥150k.
- **Pula live ≥50k** (`SCALE_SKIP_GLOBAL_LIVE_POOL_ABOVE`) — tryb `db`: brak globalnego Redis SET; próbkowanie per miasto z Postgres (`order_by('?')[:n]`).
- **Pula live 5k–50k** — Redis SET capped przez `SCALE_LIVE_POOL_MAX_REDIS` (domyślnie **50 000**); bounded per-city queries only.
- **Pula live &lt;5k** — Redis SET do rozmiaru celu (bez sztucznego cap 50k).
- **Batch insert** — zawsze sub-chunked `bulk_create`; `user_bulk_pg_batch_size` z `compute_batch_scaling` (100 → 300k).
- **Aktywni na mapie** — max `SCALE_MAX_CONCURRENT_RIDERS` (domyślnie **5000**).
- **Telemetria** — tylko aktywni jeźdźcy; odczyt `GEORADIUS` + `HMGET`, nie `HGETALL`.

## Automatyczny disk guard (domyślnie włączony)

Przy batchu ≥1k worker **sam**:

- sprawdza rozmiar bazy (`pg_database_size`),
- uruchamia **chunked wipe** gdy re-seed / brak miejsca (bez ręcznego pilnowania),
- zmniejsza `pg_chunk` i równoległość przy wysokim % budżetu,
- przy `No space left on device` **dzieli chunk** i ponawia insert.

Budżet dysku jest **wykrywany automatycznie** z `pg_database_size` (tiery Railway: 0.5 / 5 / 10 / 20 / 50 GB…). Po **wipe** baza jest mała (~0.1 GB) — guard używa domyślnego budżetu (5 GB), nie tieru 0.5 GB. Na Railway ustaw na workerze i backendzie: `SCALE_POSTGRES_DISK_BUDGET_GB=5` (lub rzeczywisty rozmiar wolumenu Postgres).

**Monitor + audit:** Celery beat co 5 min (`activities.tasks.monitor_postgres_disk`), progi 80/90/95%, Redis `scale:simulation_paused`, API `GET /api/activities/admin/disk-audit/` — szczegóły w [DISK_GUARD.md](./DISK_GUARD.md).

Wyłączenie (niezalecane): `SCALE_AUTO_DISK_GUARD=0`, `SCALE_AUTO_WIPE_BEFORE_BATCH=0`.

## Railway checklist (300k)

1. **Postgres volume ≥10 GB** (20 GB recommended). Wipe przed 300k jest **automatyczny** przy re-seedzie; ręczny wipe tylko w razie potrzeby.
2. **Do not run live sim during batch** — wait until batch completes; live at 300k uses DB sampling or capped Redis.
3. **celery-worker-simulation** env:
   - `BROUTER_URL=http://brouter:17777/brouter` (or your BRouter service URL)
   - `CELERY_WORKER_CONCURRENCY=6–7`, `SCALE_BATCH_MAX_PARALLEL_WORKERS=4` on weak Postgres
   - `SCALE_USER_BULK_PG_BATCH_SIZE=200` if disk pressure persists
   - `SCALE_SIM_SKIP_GLOBAL_LIVE_POOL=1` to force DB sampling
   - `SCALE_SIM_SKIP_BROUTER=1` during batch-only (grid routes; no HTTP spam)
4. **`DEBUG=0`** on all workers — never log SQL with password column in production.
5. Preflight: `GET /api/activities/admin/scale-preflight/?target_users=300000&skip_activities=true`

## Zmienne środowiskowe

```env
SCALE_MAX_BATCH_USERS=350000
SCALE_MAX_LIVE_POOL=350000
SCALE_LIVE_POOL_MAX_REDIS=50000
SCALE_SKIP_GLOBAL_LIVE_POOL_ABOVE=50000
SCALE_LIVE_POOL_REDIS_FULL_ABOVE=5000
SCALE_BATCH_WARN_WITHOUT_WIPE_ABOVE=10000
SCALE_BATCH_DISK_GB_AT_300K=10
SCALE_SIM_SKIP_GLOBAL_LIVE_POOL=0
SCALE_SIM_SKIP_BROUTER=0
SCALE_MAX_CONCURRENT_RIDERS=5000
SCALE_FORCE_SKIP_ACTIVITIES_ABOVE=150000

# Celery worker symulacji
BROUTER_URL=http://brouter:17777/brouter
CELERY_WORKER_CONCURRENCY=7
CELERY_WORKER_QUEUES=simulation
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_MAX_PARALLEL_WORKERS=4

# Postgres insert pressure (optional override)
# SCALE_USER_BULK_PG_BATCH_SIZE=200
SCALE_SKIP_DEPT_ON_BATCH=true
SCALE_BATCH_FAST_INSERT=true
DATABASE_CONN_MAX_AGE=60
```

### Docker Compose

Service `celery_worker_simulation` should depend on `brouter` and set `BROUTER_URL` (see `docker-compose.yml`).

### Tuning Postgres

| Profil Postgres | `SCALE_BATCH_MAX_PARALLEL_WORKERS` | `CELERY_WORKER_CONCURRENCY` |
|-----------------|-------------------------------------|-----------------------------|
| Słaby / współdzielony (Railway starter) | 2–3 | 4 |
| Railway standard | 4–5 | 6 |
| Mocny / dedykowany | 6–7 | 7–8 |

## Bezpieczeństwo skali (tiers — domyślne, bez env)

| Cel | Miasta × users/city | pg chunk (bulk) | Live pool | Dysk (~skip_activities) |
|-----|---------------------|-----------------|-----------|-------------------------|
| **1k** | ~3–10 × ~100–350 | pg ~200–500 | Redis (pełny cel) | ~0.03 GB |
| **10k** | 10 × ~1k | pg ~500–600 | Redis cap 50k | ~0.3 GB |
| **100k** | 10 × ~10k | pg ~350–400 | **DB** sampling | ~3.3 GB |
| **300k** | 10 × ~30k | pg ~100–250 | **DB** sampling | ~10 GB |

`GET /api/activities/admin/scale-preflight/?target_users=N` zwraca `batch_plan`, `estimated_disk_gb`, `live_pool_mode`, ostrzeżenia wipe/dysk proporcjonalnie do N.

## Procedura testu 300k

1. **Wipe** stare dane symulatora (chunked async wipe).
2. **Preflight** — `batch_plan`, `estimated_batch_label`.
3. **Batch only** — preset 300k, `skip_activities` auto; monitor `celery-worker-simulation` logs (not live).
4. Po batchu: **live sim** z `active_ratio=0.1`; expect `LIVE SIM: db sampling per city` when pool target ≥50k.
5. **Mapa** — zoom na miasto; API bbox + limit.

## API

```http
GET /api/activities/telemetry/live/?bbox=west,south,east,north&limit=500
```
