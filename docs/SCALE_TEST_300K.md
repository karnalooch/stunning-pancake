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

## Co jest **bezpieczne** po implementacji

- **Pula 300k** — tylko ID w Redis `SET` (`set_live_pool_from_db`, batch `SADD`).
- **Aktywni na mapie** — max `SCALE_MAX_CONCURRENT_RIDERS` (domyślnie **5000**).
- **Telemetria** — tylko aktywni jeźdźcy; odczyt `GEORADIUS` + `HMGET`, nie `HGETALL`.
- **API mapy** — `bbox` + `limit` (domyślnie 500), odpowiedź `{ positions, meta }`.
- **Batch 300k** — `bulk_create(ignore_conflicts=True)`, bez `skip_activities` powyżej 150k wymuszane auto.

## Zmienne środowiskowe

```env
SCALE_MAX_BATCH_USERS=350000
SCALE_MAX_LIVE_POOL=350000
SCALE_MAX_CONCURRENT_RIDERS=5000
SCALE_MAX_TELEMETRY_PUBLISH=5000
SCALE_TELEMETRY_API_LIMIT=500
SCALE_FORCE_SKIP_ACTIVITIES_ABOVE=150000

# Celery worker (serwis celery-worker na Railway)
CELERY_WORKER_CONCURRENCY=6
SCALE_BATCH_PARALLEL_CITIES=true
SCALE_BATCH_PARALLEL_MIN_USERS=5000
SCALE_USER_BULK_BATCH_SIZE=2500
SCALE_USER_BULK_PG_BATCH_SIZE=500
```

### Więcej CPU / workerów Celery

- **Jeden batch 300k** to długie zadanie DB — **8 vCPU nie przyspieszy jednego wątku**.
- Ustaw na serwisie **celery-worker**: `CELERY_WORKER_CONCURRENCY=6` (zostaw 1–2 vCPU na Redis/OS).
- Przy **„skip activities”** i ≥5k użytkowników batch dzieli **tworzenie użytkowników per miasto** na równoległe taski Celery (10k → 10 miast × ~1k, do 7 workerów naraz).
- Hasła atletów: **jeden hash bcrypt** na cały batch (bez 10k× `set_password`) — dużo szybsze na demo.
- **Nie uruchamiaj live sim** podczas batcha — ticki co 8s zjadają CPU (w logach: `ForkPoolWorker-1` live + `ForkPoolWorker-2` batch).
- **Osobny serwis Railway:** `celery-worker-simulation` — tylko kolejka `simulation`. Instrukcja: [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md).

## Procedura testu 300k

1. **Preflight:** `GET /api/activities/admin/scale-preflight/?target_users=300000&active_ratio=0.1&skip_activities=true`
2. **Simulator** — preset „300k (bez aktywności)” lub ręcznie: 300000 użytkowników, wyłączone aktywności.
3. Poczekaj na batch (PostgreSQL, ~30–90 min zależnie od dysku).
4. **Live sim** — `pool_pct=1.0`, `active_ratio=0.1` → ~5000 na mapie (cap).
5. **Mapa** — zoom na miasto; API zwraca tylko widoczny bbox.

## Dashboard, heatmap, wipe (zabezpieczone)

### Dashboard KPI (`/api/activities/admin/stats/`)
- Jedno zapytanie agregujące zamiast N×COUNT per tenant.
- Cache Redis **120s**; podczas batch/live sim zwraca **stale** cache (`stale: true`).
- Odśwież na siłę: `?refresh=1`.

### Heatmap (`/api/heatmap/`)
- Wymaga **bbox**; odrzuca widok > **120 km** (przybliż).
- Min zoom **7** — przy oddaleniu komunikat „zoom in”.
- Max **1500** tras próbkowanych w bbox; wynik cache **5 min** w Redis.
- PostGIS `bboverlaps` + `iterator` — bez ładowania całej tabeli.

### Wipe (`DELETE` + `GET /api/activities/admin/wipe-data/`)
- **DELETE** → `202` — start zadania w tle (chunki po 5000 wierszy).
- **GET** — `progress_pct`, `phase`, `deleted`, `log`.
- UI (Simulator / Settings) polluje co 2s do 100%.

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
    "capped": false
  }
}
```
