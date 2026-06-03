# Railway — Celery memory & simulation worker

| | |
|--|--|
| **Status** | ✅ Active |
| **Ostatnia aktualizacja** | 2026-06-04 |
| **Cel** | Zapobiegać OOM (SIGKILL), utrzymać kolejkę `routing` oddzielnie od `live_tick`, udokumentować caps `SCALE_*`. |
| **Audience** | Platform Operator, Backend Lead |
| **Checklist + skrypt** | [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1` |

---

## Typowe objawy (troubleshooting)

| Objaw | Znaczenie |
|-------|-----------|
| `ForkPoolWorker` + **signal 9 (SIGKILL)** | OOM lub twardy limit RAM kontenera |
| `WorkerLostError: Worker exited prematurely` | Worker umarł w trakcie zadania |
| Postgres `Connection reset by peer` | Worker padł w środku zapytania |
| Live tick ~0.01 s, **0 riders** | Poll poszedł dalej lub worker martwy |
| `ride_warming` / `ROUTING` utknęte | Brak konsumenta kolejki `routing` |

---

## Przyczyna (typowa)

1. **Prefork + wysoka concurrency** na `celery-worker-simulation` (np. 6–7 dzieci × heap Django).
2. **`live_tick_task`** × wiele startów × **BRouter HTTP** (`SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` × profile).
3. **`SCALE_MAX_STARTS_PER_LIVE_TICK=0`** przy dużym `active_ratio` / `SCALE_MAX_CONCURRENT_RIDERS`.

---

## Railway CLI & agent (Cursor)

| Wymaganie | Uwagi |
|-----------|--------|
| `RAILWAY_API_TOKEN` | Windows **User** env (agent po restarcie IDE). Nie commituj. |
| `RAILWAY_TOKEN` | Legacy — **usuń**; tylko `RAILWAY_API_TOKEN`. |
| Link | `railway link --project marvelous-gratitude --environment production` |
| Weryfikacja | `.\scripts\railway-verify-production.ps1` (bez drukowania sekretów) |

Opcjonalnie: `.env.railway.local.example` → `.env.railway.local` (gitignored).

---

## Config as code (repo)

| Serwis | Plik | `dockerfilePath` w pliku |
|--------|------|---------------------------|
| `celery-worker-simulation` | `celery-worker-simulation/railway.json` | `celery-worker-simulation/Dockerfile` |
| `celery-worker-routing` | `celery-worker-routing/railway.json` | `celery-worker-simulation/Dockerfile` (wspólny obraz) |

### Dashboard lub GraphQL (build / repo)

Dla każdego serwisu monorepo (rola: Platform Operator):

| Pole | Wartość |
|------|---------|
| `rootDirectory` | `/` |
| `railwayConfigFile` | `/celery-worker-simulation/railway.json` lub `/celery-worker-routing/railway.json` |
| `dockerfilePath` | `/celery-worker-simulation/Dockerfile` |
| GitHub repo | `karnalooch/stunning-pancake` (**routing musi mieć ten sam repo**) |

Bez repo + Dockerfile Railway wybiera **Railpack** (np. `expo start` z `mobile/`) zamiast Celery.

**GraphQL (opcjonalna weryfikacja):** skrypt `railway-verify-production.ps1` odpytuje `backboard.railway.com/graphql/v2` o `dockerfilePath`, `railwayConfigFile`, `source.repo` — wymaga `RAILWAY_API_TOKEN`. **RAM nie jest dostępny w tym zapytaniu** — ustaw w Dashboard → Resources.

---

## Zalecane ustawienia Railway

### `celery-worker-simulation` (kolejka `simulation`)

Źródło: `celery-worker-simulation/railway.json` + `DATABASE_URL` / `REDIS_URL` / `SECRET_KEY` z backendu.

| Variable | Recommended | Notes |
|----------|-------------|--------|
| `CELERY_WORKER_QUEUES` | `simulation` | |
| `CELERY_WORKER_POOL` | `solo` | Najniższa pamięć |
| `CELERY_WORKER_CONCURRENCY` | `2` | Przy `solo` start.sh wymusza `--concurrency=1` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` | |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` | Recycle po ciężkich tickach |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | Dispatch `route_live_ride_task` → `routing` |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | `30` | |
| `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` | `25` | |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `4` | |
| Service RAM | **≥ 2 GB** | 512 MB–1 GB często OOM przy prefork=6–7 |

### `celery-worker` (critical / default / notifications)

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_CONCURRENCY` | `4` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `4` |
| `CELERY_MAX_TASKS_PER_CHILD` | `500` |

### `celery-worker-routing` (kolejka `routing`) — Paczka 1a ✅

Live sim wysyła `route_live_ride_task` na **`routing`**, żeby `live_tick` nie robił BRouter HTTP synchronicznie.

| Opcja | Konfiguracja |
|-------|----------------|
| **A — drugi serwis Railway** (zalecane prod) | `celery-worker-routing/railway.json`, ten sam Dockerfile |
| **B — jeden worker** | `CELERY_WORKER_QUEUES=simulation,routing` na simulation (mniejsze deploye; większe ryzyko OOM) |

| Variable | Recommended |
|----------|-------------|
| `CELERY_WORKER_QUEUES` | `routing` |
| `CELERY_WORKER_HOSTNAME` | `routing@%h` |
| `CELERY_WORKER_POOL` | `solo` |
| `CELERY_WORKER_CONCURRENCY` | `2` |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | `1` |
| `CELERY_MAX_TASKS_PER_CHILD` | `50` |
| `SCALE_SIM_ASYNC_ROUTING` | `1` |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | `30` |
| `SECRET_KEY` | **Ten sam** co backend/simulation |
| `numReplicas` | **2** (8 GB plan — patrz budżet poniżej) |
| Service RAM | **512 MB / replikę** (≈ 1 GB łącznie przy 2 replikach) |

**Weryfikacja:** [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) + skrypt.

#### Skalowanie poziome routing (2026-06-03)

Przy sustained backpressure (`sim.routing.backpressure` ~96% ticków >7,5 min, kolejka `routing` pinned przy cap) pojedynczy worker `solo` (concurrency efektywnie 1, ~1,3–1,8 s/trasę) nie nadąża drenować kolejki przy bieżącym `active_ratio`.

| Lever | Decyzja |
|-------|---------|
| **Horizontal (wybrane)** | `numReplicas=3` w `celery-worker-routing/railway.json`. Każda replika ~1 GB, łącznie ~3 GB. Czysty scale bez ryzyka OOM pojedynczego kontenera. |
| Vertical (odrzucone) | `solo` nie skaluje `concurrency>1`; wymagałby `prefork` → wyższe ryzyko RAM/OOM. |
| `active_ratio` | **Niezmieniony** (wybrano scaling, nie obniżenie obciążenia). **Rekomendacja po 3 replikach (patrz niżej):** obniżenie `active_ratio` przez admina jest **decydującą dźwignią** — backpressure pozostaje przypięty mimo skalowania, bo wąskim gardłem jest popyt > drenaż przy bieżącym `active_ratio`. |

Apply: edycja `railway.json` (SSOT — nadpisuje Dashboard/API przy każdym deployu) + `serviceInstanceUpdate(numReplicas:N)` przez GraphQL dla natychmiastowego efektu, następnie commit + push `main` (auto-redeploy z `karnalooch/stunning-pancake`). Weryfikacja: N× `routing@` ready w logach (`mingle: sync`), spadek częstotliwości `sim.routing.backpressure`.

#### Skalowanie do 3 replik + pomiary drenażu (2026-06-03)

Po skalowaniu `numReplicas=2→3` (railway.json + `serviceInstanceUpdate(numReplicas:3)` → `true`), pomiary z logów prod:

| Metryka | 2 repliki (przed) | 3 repliki (po) |
|---------|-------------------|----------------|
| Distinct `routing@` ready | 2 | **3** (`mingle: sync`, brak OOM) |
| Drenaż agregat | ~1,4/s (~0,7/s × 2) | **~1,89/s** (~0,63/s × 3, ~liniowy scale) |
| `sim.routing.backpressure` | ~67×/5,25 min ≈ **1 / 4,7 s** | **1 / 6,2 s** (nadal ~co tick) |
| RAM routing łącznie | ~2 GB | **~3 GB** (3 × ~1 GB) |
| OOM / SIGKILL w projekcie | — | **brak** (routing, simulation, celery-worker, Backend, brouter) |

**Wniosek (uczciwy):** 3. replika zwiększyła drenaż ~liniowo (~1,89/s), ale `sim.routing.backpressure` **pozostaje przypięty** (firing ~co tick, kolejka `routing` przy cap). Skalowanie drenażu nie zamyka backpressure, bo **popyt > drenaż** przy bieżącym `active_ratio`. **Decydująca dźwignia = obniżenie `active_ratio`** (strona popytu) przez admina — nie zmieniono jej w tym kroku (poza zakresem decyzji operatora).

#### Budżet RAM/CPU — plan 8 GB / 8 vCPU (2026-06-04)

Projekt `marvelous-gratitude` ma **8 GB RAM i 8 vCPU łącznie** (wszystkie serwisy). SSOT w `railway.json` (`limitOverride`) + GraphQL `serviceInstanceLimitsUpdate` dla natychmiastowego efektu.

| Serwis | RAM | vCPU | Repliki | Uwagi |
|--------|-----|------|---------|--------|
| `celery-worker-simulation` | **2 GB** | 1 | 1 | OOM guard — solo pool |
| `celery-worker-routing` | **512 MB** | 0.5 | **2** | ↓ z 3 replik (oszcz. ~1,5 GB); BRouter HTTP only |
| `Backend` | **1 GB** | 1 | 1 | Status poll + heal |
| `telemetry` | **1 GB** | 1 | 1 | FastAPI ingest; `UVICORN_WORKERS=2` |
| `celery-worker` | **512 MB** | 0.5 | 1 | default/critical/notifications |
| `celery-beat` | **512 MB** | 0.5 | 1 | Scheduler |
| `Admin` | **512 MB** | 0.5 | 1 | SPA static |
| `brouter` | **512 MB** | 0.5 | 1 | `*.railway.internal:17777` |
| `Redis` | template | — | 1 | Managed image; minimal viable |
| `TimescaleDB` | template | — | 1 | Managed; volume 5 GB |

**Łącznie compute (app):** ~6,5 GB cap + DB/Redis template overhead → mieści się w 8 GB planie.

Apply (Platform Operator):

```powershell
# Przykład GraphQL (serviceInstanceLimitsUpdate) — patrz skrypt sesji 2026-06-04
# numReplicas routing: serviceInstanceUpdate(numReplicas: 2)
# active_ratio prod: .\scripts\railway-set-live-active-ratio.ps1 -ActiveRatio 0.18 -Restart
# In-place (po deploy): railway ssh -s Backend -- python manage.py set_live_active_ratio 0.18
```

#### Backpressure closure (2026-06-04)

| Akcja | Wynik |
|-------|--------|
| `active_ratio` 0.46 → **0.18** | Admin API (`global_owner`) + restart z `tick_seconds=8`, domyślne caps 30/25/4 |
| Routing repliki 3 → **2** | Budżet 8 GB; GraphQL + `celery-worker-routing/railway.json` |
| Management command | `python manage.py set_live_active_ratio <ratio>` — in-place bez restartu (wymaga deploy + SSH) |
| Skrypt operacyjny | `scripts/railway-set-live-active-ratio.ps1` |

Po restarcie z niskim ratio obserwuj logi ≥15 min: spadek `sim.routing.backpressure`, `ride_warming` → 0 po rozgrzaniu tras.

### Niezawodność (wszystkie workery)

| Variable | Default |
|----------|---------|
| `CELERY_TASK_ACKS_LATE` | `true` |
| `CELERY_TASK_REJECT_ON_WORKER_LOST` | `true` |

`live_tick_task` / `run_live_simulation` — autoretry na `WorkerLostError` (do 2).

---

## Live sim self-heal

Status polls wywołują `heal_stale_live_simulation()` gdy brak `last_tick_at` przez `4 × tick_seconds`. Admin: **Reset simulator locks**.

| Stan po śmierci workera | Działanie |
|-------------------------|-----------|
| `running=true`, `currently_riding=0` długo | heal / reset locks |
| `live_lock_held=true`, stary `last_tick_at` | heal na poll |
| Redis `{sim}:live:tick_lock` | TTL 30s — heal na poll |

---

## Skalowanie bezpieczne

- **300k batch:** concurrency tylko przy **≥ 4 GB** RAM; `SCALE_BATCH_MAX_PARALLEL_WORKERS` ≤ 6.
- **Duża live mapa:** podnoś `SCALE_MAX_STARTS_PER_LIVE_TICK` i `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK` razem; monitoruj BRouter.
- Preferuj **drugą replikę simulation** zamiast `CONCURRENCY=8` na małym kontenerze.

---

## Wizard admin (override sesji)

Simulator → Step 2 → Performance — bez redeploy Railway.

| Wizard | API field | Cap serwera |
|--------|-----------|-------------|
| New rides / tick | `max_starts_per_live_tick` | 150 |
| BRouter HTTP / tick | `brouter_max_calls_per_tick` | 100 |
| Route attempts | `brouter_route_attempts` | 8 |

**Precedencja:** sesja → env `SCALE_*` → domyślne (30 / 25 / 4).

---

## Weryfikacja logów (routing)

```powershell
railway logs -s celery-worker-routing --lines 40
```

| Wynik | Oczekiwane |
|-------|------------|
| **PASS** | `Starting Celery …`, `routing@`, `queues=routing` |
| **FAIL** | `expo start`, Metro, `npm warn` z `4velo@` |

```powershell
railway service link celery-worker-routing
railway up -s celery-worker-routing -e production --detach
```

---

## Rollback (Platform Operator)

1. Przywróć poprzedni deployment w Railway.
2. Obniż caps `SCALE_*` (patrz tabele powyżej).
3. Awaryjnie: `SCALE_SIM_ASYNC_ROUTING=0` (sync routing w tick — obciążenie CPU/RAM rośnie).

---

## Powiązane

- [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [SIMULATOR.md](./SIMULATOR.md)
- [BROUTER.md](./BROUTER.md)
- [../admin/P1_ROADMAP.md](../admin/P1_ROADMAP.md)
