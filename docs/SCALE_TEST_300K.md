# Test skali 300 000 użytkowników

## Root cause (Railway 300k run)

| Symptom | Cause | Fix |
|---------|--------|-----|
| `No space left on device` on `pgsql_tmp` during `bulk_create` | Large multi-row INSERTs (pbkdf2 password field × 2500+ rows) + parallel city workers exhaust Postgres **disk** (temp files + WAL), not just RAM | Smaller `SCALE_USER_BULK_PG_BATCH_SIZE` / adaptive pg chunks (100–250 at 300k); sub-chunked `bulk_create` inside transaction; **≥10 GB** Postgres volume; wipe before run |
| `run_live_simulation` failed in `set_live_pool_from_db` | Fallback `User.objects.filter(role='ATHLETE').iterator()` = full table scan + sort/hash on 300k IDs | Removed; at ≥100k athletes use **DB pool mode** (`order_by('?')[:n]` per city) or Redis cap `SCALE_LIVE_POOL_MAX_REDIS` (50k) |
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
- **Pula live ≥100k** — tryb `db`: brak globalnego Redis SET 300k; próbkowanie per miasto z Postgres.
- **Pula live &lt;100k** — Redis SET capped przez `SCALE_LIVE_POOL_MAX_REDIS` (domyślnie **50 000**).
- **Aktywni na mapie** — max `SCALE_MAX_CONCURRENT_RIDERS` (domyślnie **5000**).
- **Telemetria** — tylko aktywni jeźdźcy; odczyt `GEORADIUS` + `HMGET`, nie `HGETALL`.

## Railway checklist (300k)

1. **Postgres volume ≥10 GB** (20 GB recommended). Run **wipe** (`/api/activities/admin/wipe-data/`) before a full 300k re-seed if disk was full.
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
SCALE_SKIP_GLOBAL_LIVE_POOL_ABOVE=100000
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

## Adaptacyjne reguły (domyślne, bez env)

| Cel użytkowników | Miasta | users/miasto | pg `bulk_create` chunk (adaptive) | Live pool |
|------------------|--------|--------------|-----------------------------------|-----------|
| **10k** | 10 | ~1 000 | pg ~500 | Redis do cap |
| **100k** | 10 | ~10 000 | pg ~400 | DB sampling (≥100k) |
| **300k** | 10 | ~30 000 | pg ~100–250 | DB sampling |

## Procedura testu 300k

1. **Wipe** stare dane symulatora (chunked async wipe).
2. **Preflight** — `batch_plan`, `estimated_batch_label`.
3. **Batch only** — preset 300k, `skip_activities` auto; monitor `celery-worker-simulation` logs (not live).
4. Po batchu: **live sim** z `active_ratio=0.1`, `pool_pct` rozsądny; expect `LIVE SIM: db sampling per city` when athletes ≥100k.
5. **Mapa** — zoom na miasto; API bbox + limit.

## API

```http
GET /api/activities/telemetry/live/?bbox=west,south,east,north&limit=500
```
