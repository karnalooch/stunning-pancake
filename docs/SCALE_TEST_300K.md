# Test skali 300 000 użytkowników

## Co się **zawieszało** (przed poprawkami)

| Warstwa | Problem | Skutek |
|---------|---------|--------|
| **Redis** | `HGETALL telemetry:positions` przy każdym odświeżeniu mapy | Setki MB RAM, sekundy blokady |
| **Celery tick** | `SMEMBERS` całej puli 300k + lista w Pythonie | OOM / tick > 30s |
| **Live sim** | `active_ratio × 300k` ≈ 90k jazd w `sim:live:rides` | Redis + tick nie nadąża |
| **PostgreSQL** | `exists()` × 300k przy seedzie użytkowników | Godziny insertów |
| **PostgreSQL** | Generowanie aktywności GPS dla 300k | Dni + terabajty |
| **Frontend** | JSON z tysiącami punktów + kropki + ikony | Zamrożenie karty przeglądarki |
| **Admin dashboard** | `COUNT` / pętla per-tenant na ogromnych tabelach | Wolne ładowanie KPI |
| **Batch progress** | `HINCRBY` + `HSET` na każdy `bulk_create` chunk | Redis i UI przy 300k |

## Co jest **bezpieczne** po implementacji

- **Pula 300k** — tylko ID w Redis `SET` (`set_live_pool_from_db`, batch `SADD`).
- **Aktywni na mapie** — max `SCALE_MAX_CONCURRENT_RIDERS` (domyślnie **5000**).
- **Telemetria** — tylko aktywni jeźdźcy; odczyt `GEORADIUS` + `HMGET`, nie `HGETALL`.
- **API mapy** — `bbox` + `limit` (domyślnie 500), odpowiedź `{ positions, meta }`.
- **Batch 300k** — adaptacyjny plan miast/bulk, `skip_activities` wymuszane ≥150k, postęp Redis throttled.
- **Chord** — max **10–20** tasków per miasto (w repo 10 miast), nie jeden task na użytkownika.

## Adaptacyjne reguły (domyślne, bez env)

| Cel użytkowników | Miasta (taski Celery) | users/miasto | `bulk_create` chunk | Równoległość DB* | Szac. batch (skip act.) |
|------------------|----------------------|--------------|---------------------|------------------|-------------------------|
| **10k** | 10 | ~1 000 | 2 500 | ≤6 | ~3–8 min |
| **100k** | 10 | ~10 000 | 5 000 | ≤5 | ~15–35 min |
| **300k** | 10 | ~30 000 | 7 500 | ≤7 | ~25–60 min |

\* `SCALE_BATCH_MAX_PARALLEL_WORKERS` lub domyślnie `min(Celery concurrency, 4–7)` zależnie od skali.

Logika: `activities.scale_config.compute_batch_scaling(total_users)`.

## Zmienne środowiskowe

```env
SCALE_MAX_BATCH_USERS=350000
SCALE_MAX_LIVE_POOL=350000
SCALE_MAX_CONCURRENT_RIDERS=5000
SCALE_MAX_TELEMETRY_PUBLISH=5000
SCALE_TELEMETRY_API_LIMIT=500
SCALE_TELEMETRY_LIVE_CACHE_TTL=2
SCALE_FORCE_SKIP_ACTIVITIES_ABOVE=150000

# Celery worker symulacji (celery-worker-simulation)
CELERY_WORKER_CONCURRENCY=7
CELERY_WORKER_QUEUES=simulation
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_PARALLEL_MIN_USERS=5000

# Opcjonalne — nadpisują adaptację (zwykle nie trzeba)
# SCALE_USER_BULK_BATCH_SIZE=7500
# SCALE_USER_BULK_PG_BATCH_SIZE=1000
SCALE_BATCH_MAX_PARALLEL_WORKERS=4
SCALE_BATCH_MAX_CITY_TASKS=20
SCALE_BATCH_PROGRESS_REDIS_EVERY=5000
SCALE_BATCH_PROGRESS_UI_MIN_SECONDS=2

# Szybszy batch Postgres (skip_activities)
SCALE_SKIP_DEPT_ON_BATCH=true
SCALE_BATCH_FAST_INSERT=true
DATABASE_CONN_MAX_AGE=60
```

### Tuning Postgres

| Profil Postgres | `SCALE_BATCH_MAX_PARALLEL_WORKERS` | `CELERY_WORKER_CONCURRENCY` |
|-----------------|-------------------------------------|-----------------------------|
| Słaby / współdzielony | 2–3 | 4 |
| Railway standard | 4–5 | 6 |
| Mocny / dedykowany | 6–7 | 7–8 |

Przy **skip_activities** i ≥5k użytkowników: fazy 1–3 (tenanty, adminy, działy) sekwencyjnie, potem **równoległe** `run_batch_city_users` (chord).

## Procedura testu 300k

1. **Preflight:** `GET /api/activities/admin/scale-preflight/?target_users=300000&active_ratio=0.1&skip_activities=true` — sprawdź `batch_plan` i `estimated_batch_label`.
2. **Simulator** — preset „300k (bez aktywności)” lub ręcznie ≥150k (aktywności wyłączą się same).
3. Poczekaj na batch w logach **celery-worker-simulation** (`Parallel user creation: N cities`).
4. **Live sim** dopiero po batchu — `active_ratio=0.1` → ~5000 na mapie (cap).
5. **Mapa** — zoom na miasto; API tylko bbox.

## Dashboard, heatmap, wipe

Zobacz sekcje w poprzedniej wersji dokumentu — bez zmian (cache KPI, bbox heatmap, chunked wipe).

## API

```http
GET /api/activities/telemetry/live/?bbox=west,south,east,north&limit=500
```

```json
{
  "positions": [...],
  "meta": {
    "returned": 412,
    "redis_active": 4987,
    "viewport_bike": 380,
    "viewport_run": 32,
    "capped": false,
    "cached": false
  }
}
```
