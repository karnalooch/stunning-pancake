# Railway production checklist — marvelous-gratitude

Operacyjna lista kontrolna dla **production** (projekt `marvelous-gratitude`). Szczegóły pamięci Celery: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

## CLI i agent (Cursor)

| Krok | Akcja |
|------|--------|
| Token | **Windows User env:** `RAILWAY_API_TOKEN` (nie commituj; usuń legacy `RAILWAY_TOKEN`) |
| Link | `railway link --project marvelous-gratitude --environment production` |
| Weryfikacja | `.\scripts\railway-verify-production.ps1` |

Przykład lokalny (opcjonalnie): skopiuj `.env.railway.local.example` → `.env.railway.local` (gitignored).

## Serwisy Celery — źródło prawdy

| Serwis | Repo | Dockerfile | Config as code |
|--------|------|------------|----------------|
| `celery-worker-simulation` | `karnalooch/stunning-pancake` | `/celery-worker-simulation/Dockerfile` | `celery-worker-simulation/railway.json` |
| `celery-worker-routing` | **ten sam repo** | **ten sam Dockerfile** | `celery-worker-routing/railway.json` |
| `celery-worker` | ten sam repo | `celery-worker/Dockerfile` | `celery-worker/railway.json` |

**Routing:** bez podpiętego repo Railway uruchamia Railpack (np. Expo z `mobile/`). Wymagane: repo + `dockerfilePath` + `railwayConfigFile` (Dashboard lub GraphQL `serviceInstanceUpdate`).

## Zmienne — simulation (`celery-worker-simulation/railway.json`)

Skopiuj z backendu: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `DEBUG=0`.

Baseline (nie podbijaj bez RAM):

- `CELERY_WORKER_QUEUES=simulation`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `SCALE_MAX_STARTS_PER_LIVE_TICK=30`
- `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK=25`
- `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS=4`

## Zmienne — routing (`celery-worker-routing/railway.json`)

Te same `DATABASE_URL`, `REDIS_URL`, **`SECRET_KEY` jak simulation/backend**.

- `CELERY_WORKER_QUEUES=routing`
- `CELERY_WORKER_HOSTNAME=routing@%h`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `BROUTER_URL=http://brouter.railway.internal:17777/brouter`

## RAM (tylko Dashboard)

| Serwis | Minimum |
|--------|---------|
| `celery-worker-simulation` | **≥ 2 GB** |
| `celery-worker-routing` | **≥ 1 GB** |
| `brouter` | volume + CPU wg [BROUTER.md](./BROUTER.md) |

## Po deploy — logi

```powershell
railway logs -s celery-worker-routing --lines 50
```

**PASS:** `Starting Celery … routing@`, `queues=routing`, **brak** `expo start` / Metro.

```powershell
railway logs -s celery-worker-simulation --lines 30
```

**PASS:** `simulation@`, `pool=solo`, `concurrency=1` (solo) lub `concurrency=2` (prefork).

## Deploy routing (CLI)

```powershell
railway service link celery-worker-routing
railway up -s celery-worker-routing -e production --detach -m "celery routing worker"
```

## Powiązane

- [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)
- [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [SIMULATOR.md](./SIMULATOR.md)
