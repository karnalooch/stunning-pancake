# 4VELO — Mapa repozytorium (inwentaryzacja)

> **Cel:** inwentaryzacja stanu faktycznego repozytorium (bez oceny, co usunąć; bez zmian kodu/konfiguracji).
> **Data:** 2026-09-09 · **Gałąź:** `audit/repository-map` · **Zakres:** całe drzewo z wyłączeniem katalogów zależności i artefaktów buildów (`node_modules/`, `venv/`, `__pycache__/`, `dist/`, `.expo/` itd.).
> **Metoda:** odczyt konfiguracji i kodu źródłowego; deklaracje dokumentacji są odróżnione od faktów potwierdzonych kodem (sekcja 7).

---

## 1. Komponenty — aplikacje, usługi, paczki, katalogi infrastruktury

### Aplikacje i usługi (kod wykonywalny)

| Ścieżka | Typ | Opis (fakt z kodu) |
|---|---|---|
| `backend/` | Aplikacja Django (API) | REST API + modele domenowe (PostGIS), Celery tasks/beat, RLS, symulator. Aplikacje Django: `users`, `activities`, `events`, `clubs`, `rewards`, `core`. |
| `telemetry/` | Mikrousługa FastAPI | Ingest GPS + broadcast live (WebSocket), deduplikacja, guard limitu ingestu. |
| `admin/` | SPA React (Vite) + Electron | Panel właściciela/moderatora; 3 warianty buildowane przez `VITE_APP_MODE` (`GLOBAL_ADMIN`, `LOCAL_ADMIN`, `MODERATOR`). |
| `mobile/` | Aplikacja Expo / React Native | Aplikacja zawodnika (śledzenie GPS, HUD, mapa, grywalizacja). |

### Paczki współdzielone (pnpm workspace)

| Ścieżka | Nazwa paczki | Rola |
|---|---|---|
| `packages/api-client/` | `@4velo/api-client` | Ścieżki API (SSOT) + klient generowany Orval z OpenAPI. |
| `packages/tokens/` | `@4velo/tokens` | Tokeny designu (kolory) → `generated/restyle-colors.ts`. |
| `packages/eslint-config/` | `@4velo/eslint-config` | Wspólna konfiguracja ESLint (flat config). |
| `packages/tsconfig/` | `@4velo/tsconfig` | Wspólne `tsconfig` (`base.json`, `react.json`). |

### Workery Celery jako osobne katalogi wdrożeniowe (Railway)

| Ścieżka | Rola | Zawartość |
|---|---|---|
| `celery-worker/` | Worker `critical,default,notifications` | `Dockerfile`, `start.sh`, `railway.json`. |
| `celery-worker-simulation/` | Worker `simulation` (batch + live) | `Dockerfile`, `start.sh`, `railway.json`. |
| `celery-worker-routing/` | Worker `routing` (async routing BRouter/OSRM) | Tylko `railway.json` — reużywa `celery-worker-simulation/Dockerfile`. |

### Katalogi infrastruktury

| Ścieżka | Rola |
|---|---|
| `infrastructure/brouter/` | BRouter — routing i walidacja trasy / anti-cheat (`Dockerfile`, `entrypoint.sh`, `railway.json`, `README.md`). |
| `infrastructure/brouter-2/` | Drugi serwis BRouter na Railway — tylko `railway.json`. |
| `infrastructure/osrm/` | OSRM — routing symulatora (`Dockerfile`, `entrypoint.sh`, `railway.json`, `README.md`). |
| `infrastructure/traccar/` | Konfiguracja Traccar (`conf/traccar.xml`). |
| `infrastructure/k8s/` | Manifesty Kubernetes (Kustomize): workloady API/worker/beat/brouter/redis, HPA/PDB, ingress, configmap, opcje postgres/telemetry/traccar/admin. |
| `infrastructure/nginx/` | Konfiguracja nginx (`conf.d/default.conf`) — serwowanie statycznego admina + proxy API (compose prod). |
| `infrastructure/observability/` | Prometheus + Grafana + eksportery (redis/postgres/node) — `docker-compose.observability.yml`, `prometheus.yml`. |
| `infrastructure/sim-lab/` | Środowisko „sim lab” (Railway) — profile 300k/50k/smoke, skrypty `*.ps1`, obraz TimescaleDB, proxy. |
| `infrastructure/simulators/` | Skrypty symulatorów/load: `traccar_sim.py`, `traccar_sim_v2.py`, `multi_athlete_sim.py`, `extreme_load_test.py`, `init_traccar.py`. |

### Orkiestracja, skrypty i narzędzia (repo root)

| Ścieżka | Rola |
|---|---|
| `docker-compose.yml` | Pełny stos lokalny: `db`, `redis`, `brouter`, `osrm`, `traccar`, `backend`, `telemetry`, `global_admin`, `tenant_admin`, `moderator`, `celery_worker`, `celery_worker_simulation`, `celery_beat`. |
| `docker-compose.override.yml` | Nadpisania lokalne (telemetry shards, BRouter „minimal”, wyłączenie async routing w sim). |
| `docker-compose.prod.yml` | Wariant produkcyjny (postgis, nginx, backend przez `Dockerfile.prod`). |
| `docker-compose.scale.yml` | Wariant skalowalny: `db`, `backend`, `telemetry`, `celery_worker_critical/default/notifications`, `pgdata_coordinator`. |
| `skaffold.yaml` | Skaffold + Kustomize (`infrastructure/k8s/overlays/local`). |
| `turbo.json` / `package.json` / `pnpm-workspace.yaml` | Monorepo tooling (pnpm + turbo). |
| `pyproject.toml` | Ruff dla skryptów/telemetrii (root scope). |
| `scripts/` | Skrypty audytów (`audit-*.ts`), operacji Railway (`railway-*.ps1`), i18n docs (`docs_i18n_*.py`), load-testingu (`load/`), compliance, generatorów (`generators/`). |
| `bin/docker.cmd` | Wrapper `podman`. |
| `assets/` | Zasoby graficzne: `branding/` (logo), `admin/`, `generated/` (wygenerowane sprite'y/ikony + manifest). |
| `reports/` | Wyniki skanów bezpieczeństwa (bandit, npm-audit, pip-audit, detect-secrets) + `PHASE_A_REPORT.md`. |
| `artifacts/` | Tylko `README.md` — polityka lokalizacji artefaktów. |
| `tests/fixtures/` | Dane testowe (`ingest_guard_parity.json`). |
| `models.json` | Katalog modeli LLM (OpenRouter) — brak statycznych odwołań w kodzie; użycie dynamiczne/zewnętrzne niepotwierdzone (sekcja 6). |
| `docs/` | Dokumentacja PL/EN (sekcja 7). |

---

## 2. Szczegóły techniczne komponentów

### Backend (`backend/`)

- **Język / framework:** Python 3.11 · Django 4.2 · DRF 3.15 · Django GIS (PostGIS) · Celery 5.4 · SimpleJWT · drf-spectacular.
- **Punkt wejścia:** `manage.py`; WSGI `core/wsgi.py`; kontener `docker-entrypoint.sh` (migracje → `create_admin` → opcjonalny seed → `collectstatic` → gunicorn). `core/settings.py` = konfiguracja SSOT.
- **Plik zależności:** `backend/requirements.txt` (runtime); lint/type-check w `backend/pyproject.toml` + `mypy-ci.ini`.
- **Komendy:**
  - start (dev): `python manage.py runserver` (lub `python run_dev.py`)
  - start (prod): `gunicorn core.wsgi:application` (przez `docker-entrypoint.sh`)
  - test: `python run_pytest.py …` (pytest-django) lub `python manage.py test`
  - lint: `ruff check .` · format: `ruff format --check .`
  - type-check: `mypy --config-file mypy-ci.ini core/load_guard.py core/fake_redis.py activities/services.py activities/telemetry_shard.py activities/simulator_routing_backpressure.py`
  - migracje: `python manage.py migrate`
- **Aplikacje Django:** `users` (auth/JWT/MFA/RBAC/eksport/push), `activities` (śledzenie, symulator, live map, ML anti-cheat, płatności, wearables), `events` (bursty), `clubs`, `rewards` (pule punktowe/sponsorskie), `core` (RLS, Citus, LLM proxy, middleware, Celery).

### Telemetry (`telemetry/`)

- **Język / framework:** Python 3.11 · FastAPI · uvicorn · asyncpg · redis.
- **Punkt wejścia:** `main.py` (`uvicorn main:app --port 8001`); moduły: `config`, `schemas`, `db`, `privacy`, `ws_manager`, `ingest_service`, `ingest_guard`, `ingest_queue`, `bridges`, `routes`, `lifecycle`.
- **Plik zależności:** `telemetry/requirements.txt` (+ `requirements-dev.txt` z pytest/pytest-asyncio).
- **Komendy:**
  - start: `uvicorn main:app --host 0.0.0.0 --port 8001 [--reload]`
  - test: `pytest` (wymaga `pytest-asyncio`)
  - lint: `ruff check telemetry` / `ruff format --check telemetry`

### Admin (`admin/`)

- **Język / framework:** TypeScript · React 19 · Vite 6 · Mantine 9 · TanStack Query · MapLibre GL · Zustand · React Router 7. Opcjonalny wrapper Electron (`electron-main.cjs`, `electron-builder`).
- **Punkt wejścia:** `index.html` → `src/main.tsx` → `src/App.tsx`; tryb przez `VITE_APP_MODE` (GLOBAL_ADMIN / LOCAL_ADMIN / MODERATOR). Aliasy: `@tokens`.
- **Plik zależności:** `admin/package.json`; TS `tsconfig.app.json`; testy `vite.config.ts` (vitest), `playwright.config.ts`.
- **Komendy:**
  - start: `pnpm dev` (Vite, port 3000)
  - build: `pnpm build` (vite build)
  - test: `pnpm test:run` (vitest) · E2E: `pnpm test:e2e` (Playwright) · `smoke:p0`
  - lint: `pnpm lint` · type-check: `pnpm typecheck`
  - Electron: `pnpm electron:dev` · `pnpm build:exe`

### Mobile (`mobile/`)

- **Język / framework:** TypeScript · React Native 0.83 · Expo SDK 55 · React Navigation · Legend State · Unistyles · MapLibre RN · Skia · MMKV · Firebase.
- **Punkt wejścia:** `index.ts` (rejestruje `App.tsx`, najpierw `src/theme/unistylesSetup`); konfiguracja `app.config.js` (scheme `fourvelo`, OTA `production`).
- **Plik zależności:** `mobile/package.json`; `babel.config.js`, `metro.config.js`, `jest.config.js`, `eas.json`.
- **Komendy:**
  - start: `pnpm start` (expo start) · `pnpm web`
  - build: `npx eas build --platform android|ios --profile <development|preview|production>` · lokalnie `npx expo prebuild`
  - test: `pnpm test` (jest) · `pnpm test:coverage` · E2E: `pnpm test:e2e` (Maestro)
  - lint: `pnpm lint` · type-check: `pnpm typecheck`

### Paczki

| Paczka | Komendy | Zależności plik |
|---|---|---|
| `@4velo/api-client` | `codegen` (orval), `codegen:check` | `package.json`, `orval.config.ts`, `openapi.json` |
| `@4velo/tokens` | `build` (`tsx build.ts`), `check` | `package.json`, `colors.json` |
| `@4velo/eslint-config` | — (config) | `index.js` |
| `@4velo/tsconfig` | — (config) | `base.json`, `react.json` |

### Workery Celery (Railway)

| Katalog | Obraz bazowy | Komenda | Kolejki | Pool/concurrency (domyślne) |
|---|---|---|---|---|
| `celery-worker/` | python:3.11-slim | `celery -A core worker` | `critical,default,notifications` | solo, 2 |
| `celery-worker-simulation/` | python:3.11-slim | `celery -A core worker` | `simulation` | solo/prefork, 2 |
| `celery-worker-routing/` | (reużywa sim Dockerfile) | `celery -A core worker` | `routing` | solo, 6 |

### Orkiestracja root

- **Komendy root (package.json):**
  - start: `.\dev.ps1` / `docker compose up -d`
  - build: `pnpm build` (turbo) · test: `pnpm test` · lint: `pnpm lint`
  - gates: `pnpm gate:simulator`, `pnpm gate:p0-smoke`, `pnpm gate:p1-closure`
  - audyty: `pnpm audit:all` (i poszczególne `audit:*`)
  - API: `pnpm api:export` (eksport OpenAPI), `pnpm api:codegen:check`

---

## 3. Zależności między komponentami

```mermaid
flowchart LR
  subgraph Frontend
    A[admin React/Vite] --> AC[@4velo/api-client]
    M[mobile Expo/RN] --> AC
    AC --> OPENAPI[backend OpenAPI]
  end
  A --> B[backend Django API]
  M --> B
  M --> T[telemetry FastAPI]
  A --> T
  B --> PG[(PostgreSQL + PostGIS)]
  B --> R[(Redis: cache + broker)]
  T --> PG
  T --> R
  R --> CELERY[Celery workers/beat]
  CELERY --> PG
  CELERY --> BR[brouter]
  CELERY --> OS[osrm]
  B --> BR
  B --> OS
  B --> TR[traccar]
  TR --> R
  B --> EXT[Stripe/SendGrid/Strava/Garmin/LLM/Matrix/Sentry/Firebase/Google]
```

- **admin** → `@4velo/api-client` (ścieżki API), `@4velo/tokens` (przez alias `@tokens`), `@4velo/eslint-config` + `@4velo/tsconfig` (dev). Rozmawia z backendem (`VITE_API_URL`) i telemetrią (WebSocket).
- **mobile** → `@4velo/api-client`, `@4velo/tsconfig`. Rozmawia z backendem (`EXPO_PUBLIC_API_URL`) i telemetrią (`EXPO_PUBLIC_TELEMETRY_URL`).
- **@4velo/api-client** → generowany z `openapi.json` eksportowanego z backendu (`scripts/export_openapi.py` → `packages/api-client/openapi.json`).
- **backend** → PostgreSQL/PostGIS (dane), Redis (cache + broker Celery), BRouter (anti-cheat/routing), OSRM (routing symulatora), Traccar (API urządzeń — `activities/services.py`), oraz usługi zewnętrzne (sekcja 4). Wymaga `DATABASE_URL` i `REDIS_URL` (brak powoduje błąd startu).
- **telemetry** → PostgreSQL (`gps_points`) i Redis (subskrypcja pub/sub kanału `traccar:positions` publikowanego przez Traccar, oraz Redis Stream `telemetry:ingest:queue` — `ingest_queue.py`). Broadcast live do klientów przez WebSocket (`ws_manager.py`). Brak bezpośredniego połączenia telemetry → Traccar.
- **Workery Celery** → konsumują zadania z brokera Redis (brak bezpośredniego wywołania z backendu); współdzielą kod `backend/`; kolejki zdefiniowane w `CELERY_TASK_ROUTES` (`core/settings.py`): `critical`, `default`, `notifications`, `simulation`, `routing`.

---

## 4. Bazy danych, kolejki, cache, usługi zewnętrzne

### Bazy danych

| System | Rola | Źródło (fakt) |
|---|---|---|
| PostgreSQL 15 + PostGIS | Główna baza (Django GIS). Obraz compose: `timescale/timescaledb-ha:pg15-latest`; prod/CI: `postgis/postgis:15-3.3`. | `docker-compose.yml`, `docker-compose.prod.yml`, `ci.yml` |
| TimescaleDB (hypertable) | Szeregi czasowe pozycji live (`gps_points`), snapshoty live map. | `activities/live_map_timescale.py`, `settings.py` beat |
| Citus (sharding) | Opcjonalne sharding po tenantach (`CITUS_SHARD_COUNT=32`, `core/citus.py`). | `core/citus.py`, `railway.json` |
| SQLite | Tylko lokalny fallback dev (`backend/db.sqlite3`, gitignored); wymusza Celery eager. | `settings.py` (warunek `sqlite`) |

### Kolejki i cache

| System | Rola | Źródło |
|---|---|---|
| Redis | Broker + result backend Celery; cache (leaderboardy, dashboard KPI); pub/sub `traccar:positions` (Traccar publikuje, telemetria subskrybuje) i `privacy_zones:updates`; Redis Stream `telemetry:ingest:queue` (kolejka ingestu pod obciążeniem). | `settings.py`, `telemetry/config.py`, `telemetry/bridges.py`, `telemetry/ingest_queue.py`, `core/redis_cluster.py`, `infrastructure/traccar/conf/traccar.xml` |
| Celery | Kolejki: `critical`, `default`, `notifications`, `simulation`, `routing`; beat z harmonogramem (ML retrain, MV refresh, digest, disk monitor itd.). | `settings.py` (`CELERY_TASK_ROUTES`, `CELERY_BEAT_SCHEDULE`), `core/celery.py` |

### Usługi zewnętrzne

| Usługa | Rola | Gdzie (fakt z kodu / konfiguracji) |
|---|---|---|
| BRouter | Walidacja trasy, anti-cheat (topologiczna), routing symulatora. | `docker-compose.yml`, `activities/viterbi_matching.py`, `activities/sim_routing.py`, `BROUTER_URLS` |
| OSRM | Routing symulatora live (`SCALE_SIM_ROUTING_BACKEND`). | `docker-compose.yml`, `activities/osrm_service.py`, `railway.json` |
| Traccar | Zbieranie telemetrii GPS; publikuje pozycje do Redis (`traccar:positions`) — `forward.type=redis`. Backend odczytuje jego API (`TRACCAR_URL`). | `docker-compose.yml`, `infrastructure/traccar/conf/traccar.xml`, `activities/services.py`, `TRACCAR_URL`, `TRACCAR_REDIS_CHANNEL` |
| Stripe | Płatności (subskrypcje/webhooki). | `activities/payments.py`, `rewards/stripe_service.py`, `STRIPE_*` |
| SendGrid | E-mail (digest, powiadomienia). | `core/email_service.py`, `SENDGRID_API_KEY` |
| Strava | OAuth2 + synchronizacja aktywności. | `activities/wearables.py`, `STRAVA_*` |
| Garmin | OAuth2 + upload aktywności (`garminconnect`). | `activities/wearables.py`, `activities/garmin_upload.py` |
| OpenAI / LLM (kompatybilne) | Trener-avatar, inteligencja systemowa (proxy z fallback + circuit breaker). | `core/llm_proxy.py`, `mobile AvatarTrainerService`, `LLM_*` |
| Matrix | Powiadomienia/chat (opcjonalne). | `core/matrix_provisioner.py`, `MATRIX_*` |
| Sentry | Obserwowalność błędów. | `core/sentry.py`, `SENTRY_DSN` |
| Firebase | Push + Crashlytics (mobile). | `mobile/package.json`, `FirebaseService.ts` |
| Google OAuth | Social login. | `core/google_auth.py`, `settings.py` (allauth google) |
| Mail.tm | Testowa skrzynka e-mail (symulator Garmin). | `activities/garmin_mailtm.py`, `MAILTM_BASE_URL` |
| Expo EAS | OTA deploy + build mobile. | `app.config.js`, `eas.json`, `README.md` |
| Railway | Hosting produkcyjny (usługi + wolumeny). | `*/railway.json` |
| Kubernetes | Alternatywny model wdrożenia. | `infrastructure/k8s/` |

---

## 5. Pliki generowane, artefakty, screenshoty, coverage, dane testowe

### Zatwierdzone w repo (committed)

| Ścieżka | Rodzaj | Pochodzenie |
|---|---|---|
| `packages/api-client/openapi.json` | Eksport OpenAPI backendu | `scripts/export_openapi.py` |
| `packages/api-client/src/generated/` | Klient Orval (axios) | `orval` (codegen) |
| `packages/tokens/generated/` | Tokeny wygenerowane (`restyle-colors.ts`, `colors-flat.json`) | `packages/tokens/build.ts` |
| `assets/generated/` | Wygenerowane grafiki (ikony, sprites, środowiska, particles, prompts) + `ASSET_MANIFEST.json`, `generation.log` | `scripts/generate_assets.py` |
| `admin/e2e/live-map-zoom-snapshots/` | Snapshoty Playwright (regresja wizualna Live Map) | `test:e2e:live-map:update` |
| `admin/audit-screenshots/` (39 plików) | Screenshoty audytu tras/ekranów | `pnpm audit:screens` |
| `admin/probe-screenshots/` (11 plików) | Screenshoty probe/smoke Live Map | smoke/probe |
| `docs/admin/reports/*.json` | Raporty audytu WebGL/E2E | Playwright |
| `docs/design/screenshots/` (wiele PNG) | Zrzuty audytów UI emulatora + parity/diff | `scripts/emulator-ui-audit.py`, harness parity |
| `docs/assets/` (+ `docs/assets/live/`) | Obrazy do dokumentacji | ręczne |
| `docs/assets/admin_dashboard_live_view.png` itd. | Mockupy/PNG | ręczne |
| `reports/bandit_report.json`, `npm-audit-admin.json`, `npm-audit-mobile.json`, `pip-audit-report.json`, `detect-secrets-report.txt` | Wyniki skanów bezpieczeństwa | Bandit / npm audit / pip-audit / detect-secrets |
| `reports/PHASE_A_REPORT.md` | Raport audytu bezpieczeństwa (Faza A) | manualny |
| `tests/fixtures/ingest_guard_parity.json` | Dane testowe parytetu guarda ingestu | testy |
| `models.json` (430 KB) | Katalog modeli LLM (OpenRouter) | brak statycznych odwołań w kodzie; użycie dynamiczne/zewnętrzne niepotwierdzone (sekcja 6) |
| `docs/gtm/**/PITCH_DECK.pptx` | Prezentacje GTM | manualne |
| `docs/archive/ASSET_MANIFEST.json` | Stary manifest assetów | archiwalny |
| `scripts/parity_manifest.json` | Manifest parytetu wizji | harness parity |

### Lokalne / gitignored (nie commitowane)

| Ścieżka | Rodzaj |
|---|---|
| `backend/db.sqlite3` | Lokalna baza SQLite dev |
| `admin/dist/` (6), `admin/dist-exe/` | Build Vite / Electron |
| `admin/test-results/`, `admin/playwright-report/`, `admin/e2e-results.xml` | Wyniki Playwright |
| `mobile/dist/`, `mobile/coverage/` (72), `mobile/android/`, `mobile/ios/` | Build / coverage / natywne |
| `backend/.coverage`, `backend/.pytest_cache/`, `backend/__pycache__/`, `backend/venv/` | Coverage/cache/venv |
| `scripts/load/reports/*.log` | Logi load-testów |
| `infrastructure/brouter/segments4/` | Kafelki map BRouter (pobierane) |
| `infrastructure/sim-lab/railway/proxy.secret` (67 B) | Lokalny sekret proxy sim-lab |
| `.gradle-home/` | Cache Gradle |
| `mobile/build-log*.txt` | Logi buildów |
| `web/` (cały katalog), `packages/eslint-config/node_modules/`, `.kilo/node_modules/` | Ignorowane pozostałości środowiska (`node_modules/`); `web/` nie zawiera śledzonego kodu |

---

## 6. Miejsca o niepotwierdzonym przeznaczeniu

| Ścieżka / element | Co wiadomo | Dlaczego niepotwierdzone |
|---|---|---|
| `web/` | Lokalna ignorowana pozostałość środowiska — nie jest częścią repozytorium. Zawiera wyłącznie `node_modules/`. | `git ls-files -- web` = brak plików śledzonych; `git status --ignored` zgłasza `!! web/`. Git nie śledzi żadnej zawartości `web/`. |
| `models.json` (root, 430 KB) | Katalog modeli LLM (format OpenRouter). | `git grep -n "models.json"` (z wyłączeniem tego raportu) = **0 statycznych odwołań** w śledzonych plikach. Brak statycznych odwołań **nie dowodzi** braku użycia — plik może być czytany dynamicznie (przez ścieżkę/zmienną) lub przez narzędzie zewnętrzne spoza repo. |
| `backend/Dockerfile.celery`, `backend/Dockerfile.celerybeat` | Dockerfile workera/beat oparte na `backend/`. | Potwierdzony fakt: aktualne pliki Compose ich nie używają (`docker-compose.yml` buduje `./backend` i nadpisuje `command`; `celery-worker*/Dockerfile` to osobne pliki). Brak dowodu, że zostały „zastąpione” — mogą być historyczne lub używane poza Compose. |
| `celery-worker-routing/` | Worker kolejki `routing` (Railway). | Tylko `railway.json` (brak lokalnego `Dockerfile`/`start.sh`); reużywa `celery-worker-simulation/Dockerfile`. Cel potwierdzony, ale kompletność konfiguracji lokalnej — nie. |
| `infrastructure/brouter-2/` | Drugi serwis BRouter (Railway). | Tylko `railway.json` (bez `Dockerfile`); zgodnie z `brouter/README.md` reużywa `infrastructure/brouter/Dockerfile`. |
| `backend/Dockerfile.prod` | Referencjonowany przez `docker-compose.prod.yml` i `reports/PHASE_A_REPORT.md`. | **Plik nie istnieje** w drzewie (potwierdzone) — build `docker compose -f docker-compose.prod.yml` się nie powiedzie. |
| `docs/mockups/` | Wspomniany w `docs/pl/README.md` („STITCH HTML”, `02-active-ride-hud.html`). | Katalog **nie istnieje**; README sam przyznaje, że `*.html` mogą być gitignored (`.gitignore` ignoruje `*.html`). |
| `backend/run_dev.py`, `run_manage.py`, `run_pytest.py`, `run_tests.py` | Wrappery uruchomieniowe. | Cel częściowo udokumentowany w `DEVELOPMENT.md`; dokładny zakres użycia (lokalne vs CI) wymaga weryfikacji środowiskowej. |
| `backend/scripts/bootstrap_model.sh`, `train_baseline_model.py` | Trenowanie modelu ML anti-cheat. | Niepotwierdzone, czy pipeline jest nadal używany (model `ML_MODEL_PATH=/app/models/anomaly_detector.pkl`). |
| `bin/docker.cmd` | Wrapper `podman %*`. | Cel jasny (alias podmana), ale brak dokumentacji używania. |
| `infrastructure/sim-lab/railway/proxy.secret` | Lokalny plik sekretu (gitignored). | Treść/właściciel nie do potwierdzenia bez środowiska. |
| `web/`, `packages/eslint-config/node_modules/`, `.kilo/node_modules/` | Katalogi `node_modules` oraz `web/` obecne lokalnie w drzewie roboczym. | **Ignorowane przez Git** (nie commitowane): `git check-ignore` → `.gitignore:14 node_modules/` (web, packages/eslint-config) i `.kilo/.gitignore:1 node_modules`; `git ls-files` zwraca 0 śledzonych plików. To lokalne pozostałości instalacji, nie zawartość repozytorium. |
| `docker-compose.scale.yml` | Wariant skalowalny (per-queue workery). | Niepotwierdzone, czy aktualny (nie ma `celery-worker-routing` ani `osrm` w tym wariancie). |
| `admin/e2e-results.xml`, `admin/dist/`, `mobile/dist/`, `mobile/coverage/` | Artefakty buildów/testów obecne w drzewie roboczym. | Gitignored — obecność lokalna, nie jest częścią repo. |

---

## 7. Dokumenty źródłowe — deklaracje vs fakty potwierdzone kodem

### Fakty potwierdzone kodem (wymienione w tej mapie)

| Źródło | Co potwierdza |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `turbo.json` | Topologia workspace, komendy root, wersje pnpm/React (override React 19.2.7). |
| `docker-compose*.yml`, `skaffold.yaml` | Topologia usług, porty, wolumeny, zależności. |
| `backend/core/settings.py` | DB (PostGIS), Redis/Celery, kolejki, beat schedule, CORS, JWT, RLS, feature flags. |
| `backend/requirements.txt` | Zależności Pythona (frameworki i SDK zewnętrzne). |
| `backend/railway.json`, `celery-worker*/railway.json`, `telemetry/railway.json` | Zmienne środowiskowe i limity produkcyjne. |
| `telemetry/*.py`, `telemetry/requirements.txt` | Ingest, deduplikacja, guard, kanały Redis. |
| `admin/package.json`, `admin/vite.config.ts`, `admin/index.html` | Frameworki, entry, tryby `VITE_APP_MODE`, aliasy. |
| `mobile/package.json`, `mobile/app.config.js`, `mobile/index.ts` | Expo, entry, OTA, uprawnienia lokalizacji. |
| `packages/*/package.json`, `orval.config.ts`, `tokens/build.ts` | Kontrakty współdzielone. |
| `.github/workflows/ci.yml` | Bramki CI (backend/telemetry/mobile/admin/audit/security/e2e). |
| `infrastructure/*/Dockerfile|README.md` | BRouter i OSRM (rola, zmienne, build). |
| `artifacts/README.md` | Polityka lokalizacji artefaktów. |

### Deklaracje dokumentacji (nie w pełni zweryfikowane kodem / wymagają środowiska)

| Źródło | Deklaracja | Status |
|---|---|---|
| `README.md` | „4-warstwowy anti-cheat”, „RLS”, „Scale simulator 10k–300k”, „System Intelligence AI”. | Częściowo potwierdzone kodem (`viterbi_matching.py`, `rls.py`, `simulator_*`, `llm_proxy.py`); skala 300k = deklaracja load-testowa. |
| `docs/CONSTITUTION.md` (i `docs/en|pl/CONSTITUTION.md`) | Zasady architektury (§24.1 Telemetry, §24.3 Timescale). | Zgodne z kodem co do podziału na strefy; szczegóły sekcji wymagają weryfikacji. |
| `docs/ARCHITECTURE.md`, `docs/pl/ARCHITECTURE.md` | PostGIS, anti-cheat, multi-tenant. | Spójne z kodem na poziomie koncepcyjnym. |
| `docs/SCALE_TEST_300K.md`, `docs/EVENT_BURST_50K.md`, `docs/pl/operations/RAILWAY_PROD_SIM_CAPACITY.md` | Wyniki skalowania/load. | Deklaracje wydajności — niepowtarzalne bez surowych wyników i konfiguracji (zgodnie z `PROJECT_TAKEOVER.md`). |
| `docs/PROJECT_TAKEOVER.md`, `docs/reports/TAKEOVER_BASELINE_2026-09-08.md` | Status przejęcia: co zweryfikowano, co nie. | „Full Docker stack / backend / mobile nieuruchomione” — potwierdza niepełną weryfikację środowiskową. |
| `docs/pl/README.md`, `docs/en/README.md`, `docs/README.md` | Indeks i polityka językowa dokumentacji. | Struktura zgodna z drzewem; `docs/mockups/` i pojedyncze linki odbiegają (sekcja 6). |
| `docs/reports/*` (audyty 2026-05/06) | Wyniki audytów bezpieczeństwa/UI/strategii. | Historyczne snapshoty — datowane, nieaktualizowane na żywo. |
| `docs/adr/001–014` | Decyzje architektoniczne. | Deklaracje intencji; zgodność z kodem częściowo potwierdzona (np. MMKV, Legend State, Unistyles w `mobile/package.json`). |
| `docs/admin/*`, `docs/overhaul_plan/*`, `docs/design/*` | Roadmapy, plany, wizje UI. | Materiał planistyczny — nie dowód wdrożenia. |
| `reports/PHASE_A_REPORT.md` | Stwierdza m.in. brak `backend/Dockerfile.prod`. | Potwierdzone (plik nie istnieje). |
| `docs/pl/DEVELOPMENT.md`, `docs/en/DEVELOPMENT.md` | Opisują `backend/Dockerfile.celery`/`celerybeat`. | Pliki istnieją, ale nie są używane przez compose (sekcja 6). |

---

## Załącznik — kontrola linków dokumentacji

Wynik uruchomienia `python scripts/check_docs_links.py` (skrypt weryfikuje **tylko względne linki Markdown** w `docs/`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`; **pomija `docs/archive/`** i nie sprawdza linków zewnętrznych `http(s)`):

```
OK — checked 306 markdown files
```

Wynik potwierdza linki wyłącznie w powyższym zakresie — nie obejmuje `docs/archive/` ani odnośników wychodzących.
