# Sim-lab — izolowana infra load-testowa (monorepo)

Osobne środowisko symulacji **w tym samym repozytorium**, bez współdzielenia Postgres/Redis z produkcją.

| | |
|--|--|
| **Cel** | Batch 300k, live ramp 50k ACTIVE, harness `scripts/load/` |
| **Nie dla** | Ruchu użytkowników prod, admina prod pod obciążeniem |
| **Kod** | Ten sam `backend/`, `celery-worker-simulation/`, `telemetry/` co prod |
| **Deploy** | Osobny projekt Railway **lub** lokalny Docker Compose |

## Szybki start (lokalnie)

```powershell
# 1. Env
Copy-Item infrastructure/sim-lab/.env.sim-lab.example .env.sim-lab

# 2. Stack (minimalny pod symulację)
docker compose --env-file .env.sim-lab `
  -f docker-compose.yml `
  -f infrastructure/sim-lab/docker-compose.sim-lab.yml `
  up -d db redis brouter osrm backend telemetry celery_worker celery_worker_simulation

# 3. Preflight
$env:SIM_LAB_API_BASE = "http://localhost:8000/api"
$env:ADMIN_PASS = "<haslo global_owner>"
.\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1

# 4. Smoke load (harness)
.\scripts\load\run-suite.ps1 -Suite smoke

# 5. Ramp (opcjonalnie)
.\scripts\railway-load-test-ramp.ps1 -UserSteps @(50000) -ActiveRatioSteps @(0.10, 0.15)
```

Opcjonalnie admin: dodaj `global_admin` do `up -d` i ustaw `SIM_LAB_ADMIN_URL=http://localhost:3001`.


## Railway (CLI provisioning)

Project **4velo-sim-lab** (isolated from prod `marvelous-gratitude`):

| | |
|--|--|
| Project ID | `098b5266-2d8b-43f3-ba29-925aaa6b7b64` |
| Environment | `production` / `0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99` |
| Backend API | `https://backend-production-80cf.up.railway.app/api` |

From repo root (requires `RAILWAY_API_TOKEN`, `CI=true` recommended):

```powershell
$env:RAILWAY_API_TOKEN = "<token>"
.\infrastructure\sim-lab\scripts\create-sim-lab-railway.ps1
# first pass with config only:
.\infrastructure\sim-lab\scripts\create-sim-lab-railway.ps1 -SkipDeploys
```

Outputs `infrastructure/sim-lab/railway/sim-lab.created.env`. Uses **TimescaleDB + PostGIS** template (not vanilla Postgres).

**Deployed instance (2026-06-06):** project `098b5266-…`, API `https://backend-production-80cf.up.railway.app/api` — volumes, `SECRET_KEY`, brouter mount done via CLI. Fresh DB: `global_owner` / seed `admin123` (`create_admin`). Preflight PASS.

### Admin prod → sim-lab (proxy)

Żeby **panel admin na marvelous** uruchamiał symulator na sim-lab (bez obciążania prod Postgres/Celery), ustaw na **prod backend**:

```text
SIM_LAB_PROXY_ENABLED=1
SIM_LAB_PROXY_BASE_URL=https://backend-production-80cf.up.railway.app
SIM_LAB_PROXY_SECRET=<ten sam losowy secret>
SIM_LAB_PROXY_PUBLIC_LABEL=4velo-sim-lab
```

Na **sim-lab backend**:

```text
SIM_LAB_ACCEPT_PROXY=1
SIM_LAB_PROXY_SECRET=<ten sam secret>
```

Po redeploy admin pokaże baner „Symulacja na sim-lab”. Bez proxy: prod blokuje batch &gt; `PROD_MAX_BATCH_USERS` (domyślnie 10k) i live &gt; `PROD_MAX_LIVE_ACTIVE` (5k).

```powershell
.\infrastructure\sim-lab\scripts\setup-sim-lab-proxy.ps1 -Redeploy
.\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k -Redeploy
.\infrastructure\sim-lab\scripts\sync-sim-lab-telemetry-shards.ps1
.\infrastructure\sim-lab\scripts\setup-sim-lab-brouter-2.ps1
.\infrastructure\sim-lab\scripts\preflight-sim-lab-readiness.ps1

$env:SIM_LAB_API_BASE = 'https://backend-production-80cf.up.railway.app/api'
$env:ADMIN_PASS = 'admin123'
.\scripts\run-300k-wipe-batch.ps1
.\scripts\railway-load-test-ramp.ps1
.\scripts\load\run-sim-lab-stress.ps1 -Suite stress-50k

# Prod wipe only:
$env:ALLOW_PROD_LOAD_TEST = '1'
$env:ADMIN_PASS = '<prod password>'
.\scripts\run-300k-wipe-batch.ps1 -ApiBase 'https://backend-production-55c7.up.railway.app/api' -WipeOnly -ConfirmProdWipe
```


## Railway (osobny projekt)

1. Utwórz projekt Railway (np. `4velo-sim-lab`) — **nowy** Postgres + Redis.
2. Dodaj serwisy z monorepo — tabela w [`railway/project.env.example`](./railway/project.env.example).
3. Ustaw `SIM_LAB_PROJECT_ID`, link CLI, profil:

```powershell
$env:SIM_LAB_PROJECT_ID = "<uuid>"
.\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k
```

4. Po deployu:

```powershell
$env:SIM_LAB_API_BASE = "https://<backend-sim-lab>.up.railway.app/api"
$env:ADMIN_PASS = "..."
.\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1
.\scripts\run-300k-wipe-batch.ps1
.\scripts\railway-load-test-ramp.ps1
```

## Profile skali

| Plik | Użycie |
|------|--------|
| [`railway/profiles/smoke.env`](./railway/profiles/smoke.env) | Szybka walidacja, mały pool |
| [`railway/profiles/300k-50k.env`](./railway/profiles/300k-50k.env) | Pełny load test (enterprise fast ramp) |

### Fast ramp (prod-realistic, 50k ACTIVE)

| Dźwignia | Wartość | Gdzie |
|----------|---------|--------|
| Starts/tick | 5000 | `300k-50k.env`, `railway-load-test-ramp.ps1` (`-MaxStartsPerTick`) |
| Tick | 4 s | ramp script (`-TickSeconds`) |
| Routing | 8× repliki, concurrency 4 | `celery-worker-routing/railway.json` |
| Budget mode | `active_on_map` | profil env |
| Pipeline prefetch | 250k abs, mult 5.0 | profil env |

Po zmianie profilu: `sync-sim-lab-profile.ps1 -Profile 300k-50k -Redeploy`, potem restart live sim (reset + POST z ramp script).

Lokalnie te same wartości są w [`.env.sim-lab.example`](./.env.sim-lab.example) i [docker-compose.sim-lab.yml](./docker-compose.sim-lab.yml).

## Zmienne dla skryptów

| Zmienna | Opis |
|---------|------|
| `SIM_LAB_API_BASE` | Backend API (domyślny cel ramp/batch) |
| `SIM_LAB_ADMIN_URL` | Admin sim-lab (opcjonalnie) |
| `SIM_LAB_TELEMETRY_URL` | Telemetry ingest/map bench |
| `SIM_LAB_PROJECT_ID` | Railway project UUID |
| `ALLOW_PROD_LOAD_TEST` | `1` tylko z zgodą operatora — inaczej skrypty odmawiają prod URL |

## Struktura

```
infrastructure/sim-lab/
  README.md
  .env.sim-lab.example
  docker-compose.sim-lab.yml
  railway/
    project.env.example
    profiles/smoke.env
    profiles/300k-50k.env
  scripts/
    _sim-lab-resolve.ps1
    preflight-sim-lab.ps1
    sync-sim-lab-profile.ps1
```

## Powiązane

- [docs/pl/operations/PERFORMANCE_TESTING.md](../../docs/pl/operations/PERFORMANCE_TESTING.md)
- [scripts/load/README.md](../../scripts/load/README.md)
- [docs/pl/SCALE_TEST_300K.md](../../docs/pl/SCALE_TEST_300K.md)
