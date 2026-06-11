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

### Data plane: sim-lab vs prod DB

Domyślnie (proxy ON): symulator na **izolowanym sim-lab**.

W **Simulator** (prod admin): przełącznik **Prawdziwe bazy produkcyjne** (`POST /activities/admin/sim-data-plane/` → `target: production`) albo:

```text
SIM_PROD_LOCAL_WRITES=1   # tylko prod backend
```

Efekt: batch/live/map/KPI trafiają do **prod Postgres/Redis/Celery** — symulowani użytkownicy jak prawdziwi. Tylko `GLOBAL_OWNER`.

Na samym sim-lab (bez proxy): `SIM_INTEGRATION_TEST_MODE=1` — prod-like heuristics na izolowanej DB.

### Read federation (prod dashboard → sim-lab KPI)

Żeby **karty KPI dashboardu prod** (użytkownicy, aktywności, `sim_kpi`) pokazywały dane z sim-lab bez replikacji do prod Postgres:

```text
SIM_LAB_READ_FEDERATION_ENABLED=1   # wymaga SIM_LAB_PROXY_ENABLED=1
SIM_LAB_PROXY_STATS_TIMEOUT=15
SIM_LAB_PROXY_STATS_CACHE_TTL=30    # opcjonalnie
```

Odpowiedzi federowane zawierają `data_source: "sim-lab"`, `synthetic: true`. Admin pokazuje baner „Widok symulacji”.

Epic: [`docs/todo/sim-lab-read-federation.md`](../../docs/todo/sim-lab-read-federation.md) · ADR: [`docs/adr/013-sim-lab-read-federation.md`](../../docs/adr/013-sim-lab-read-federation.md)

Sales demo: osobne środowisko — [`docs/todo/demo-environment.md`](../../docs/todo/demo-environment.md) (nie federation na prod).

```powershell
.\infrastructure\sim-lab\scripts\setup-sim-lab-proxy.ps1 -Redeploy
.\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k -Redeploy
.\infrastructure\sim-lab\scripts\sync-sim-lab-telemetry-shards.ps1
.\infrastructure\sim-lab\scripts\setup-sim-lab-brouter-2.ps1
.\infrastructure\sim-lab\scripts\setup-sim-lab-timescaledb-image.ps1
.\infrastructure\sim-lab\scripts\setup-sim-lab-timescaledb-volume.ps1 -Attach -RedeployBackend
# Custom image: infrastructure/sim-lab/timescaledb/ (root entrypoint for Railway volumes)
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


## Prod vs sim-lab (koszty)

Po włączeniu proxy obniż zasoby symulacyjne na **marvelous-gratitude**:

```powershell
.\scripts\railway-set-prod-sim-capacity.ps1 -Profile off-peak
```

Runbook: [docs/pl/operations/RAILWAY_PROD_SIM_CAPACITY.md](../../docs/pl/operations/RAILWAY_PROD_SIM_CAPACITY.md).

---

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

Audyt wolnej mapy przy ~50k ACTIVE (dwa tiery SLO):

| Tier | Cel | Parametry domyślne |
|------|-----|-------------------|
| **viewport-admin** | Admin UX (PASS/FAIL główny) | zoom=10, limit=800, 3 workerów |
| **stress-50k** | Obciążenie 15× limit=50k (informacyjny) | zoom=6, limit=50000 |

Prod admin czyta mapę przez **prod backend** — od commitu z proxy `telemetry/live` leci na sim-lab (`SIM_LAB_PROXY_MAP_TIMEOUT=180`).

```powershell
$env:ADMIN_PASS = 'admin123'
.\scripts\load\run-sim-lab-live-map-audit.ps1 -IncludeProdProxy
.\scripts\load\run-sim-lab-live-map-audit.ps1 -SkipWebGl -SkipStressBench -IncludeProdProxy
```

Orphan volume: jeśli CLI nie usuwa `timescaledb-volume`, usuń ręcznie w Dashboard (patrz `fix-sim-lab-infra.ps1`).

Raport: `scripts/load/reports/sim-lab-live-map-audit-*.json`.

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
