# Runbook — symulator (batch + live map)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Admin Owner |
| **Spec** | [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) |

**Kod:** `backend/activities/simulator_*.py`, `admin/src/modules/analytics/SimulatorPage.tsx`, `LiveMap.tsx`

---

## Zasada nr 1: najpierw batch, potem live

1. Uruchom **batch** (generowanie zawodników) i **poczekaj na koniec** (faza `complete`, lock zwolniony).
2. Opcjonalnie: `POST /api/activities/admin/simulator-reset/` — czyści flagi Redis.
3. Dopiero wtedy **live simulation**.

**Dlaczego:** Pula live buduje się raz z zawodników w DB. Start live w trakcie batcha daje np. 48 jeźdźców zamiast tysięcy. API i Celery blokują live, gdy `batch_blocks_live_simulation()` jest true (lock, `running`, faza ≠ idle/complete).

### UI (Simulator)

`SimulatorPage` używa `waitForBatchComplete()` — czeka aż batch **naprawdę wystartował**, potem aż się **skończy** (naprawia stary błąd: pierwszy poll z `running=false` przed startem Celery).

**Krok 2 — dwa suwaki (0–100, domyślnie 50):**

| Suwak | Mapowanie (SSOT: `sim_profile.py` / `simProfileMap.ts`) |
|-------|-----------------------------------------------------------|
| **Aktywność puli** | `active_ratio = clamp(0.08 + 0.42×I/100, 0.08–0.50)`; `cheat_ratio = clamp(0.12×I/100, 0–0.25)` |
| **Obciążenie systemu** | starts 25→50→**100**→**150** (0/50/75/100); BRouter `round(starts×0.83)`; próby 4 jeśli L&lt;75 else 5; tick 12→8→6 s |

Przy aktywnym live na kroku 2 UI pokazuje alert **Backpressure**, gdy `routing_backpressure_active=true`.

### API

- `POST /api/activities/admin/live-simulate/` → **409** jeśli batch w toku.
- `GET /api/activities/admin/live-simulate/` → `batch_blocks_live`, `ride_warming`, `ride_routing`, `async_routing_enabled`, `routing_queue_depth`, `routing_backpressure_active`, `dispatches_throttled`, opcjonalnie `sim_intensity`, `sim_load`, `effective_sim_profile`.
- `POST /api/activities/admin/live-simulate/` — body legacy: `active_ratio`, `cheat_ratio`, `tick_seconds`, `scale_overrides`, `pool_pct`. **Albo** `intensity` + `load` (0–100, oba wymagane): profile **nadpisuje** jawne pola (precedencja: suwaki profilu).
- `GET /api/activities/admin/stats/` (GLOBAL_OWNER) → `sim_kpi` — osobna sekcja **Live Simulator** na Dashboard (nie mylić z KPI athlete).

### FSM jazdy (Paczka 1)

| Stan | Znaczenie |
|------|-----------|
| `PENDING_ROUTE` | Stub w Redis, czeka na `route_live_ride_task` (kolejka `routing`) |
| `ROUTING` | Worker liczy trasę BRouter |
| `ROUTED` | Polyline gotowa; telemetria po `start_time` → `ACTIVE` |
| `ACTIVE` | Na mapie; tick publikuje GPS |
| `FAILED_UNROUTABLE` | Usunięte z hasha; licznik `routing_unroutable_total` |

Wyłączenie async: `SCALE_SIM_ASYNC_ROUTING=0` — stary model (BRouter w `live_tick`).

**Routing worker:** [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) § `celery-worker-routing`. Roadmap: [P1_ROADMAP.md](../admin/P1_ROADMAP.md).

---

## Zalecana kolejność testu 10k

1. Railway: `SCALE_POSTGRES_DISK_BUDGET_GB=5` na **backend** i **celery-worker-simulation**.
2. Batch: `total_users=10000`, `skip_activities=true`, `clear=true` (jeśli czysta baza).
3. Log: `Done: N users` — sprawdź N ≈ oczekiwane (10 miast × ~999 zawodników + moderatorzy).
4. Stop / reset jeśli trzeba, potem live: `pool_pct=1.0`, np. `intensity=50`, `load=50` (albo `active_ratio` / `tick_seconds` ręcznie).
5. BRouter: `BROUTER_URL=http://brouter.railway.internal:17777/brouter`, `SCALE_SIM_STRICT_ROAD_ROUTES=1`.

---

## Zmienne środowiskowe (simulation worker)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `BROUTER_URL` | — | **Wymagane** dla tras po drogach, np. `http://brouter.railway.internal:17777/brouter` |
| `SCALE_SIM_STRICT_ROAD_ROUTES` | `1` | Bez BRouter nie startują jazdy (brak siatki) |
| `SCALE_SIM_SKIP_BROUTER` | `0` | `1` = siatka zamiast BRouter (batch / awaria) |
| `SCALE_SIM_BROUTER_MAX_LEG_KM` | `4` | Max odcinek A→B do routingu |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `12` | Próby trasy na start |
| `SCALE_SIM_BROUTER_START_RADIUS_KM` | `4` | Losowy offset startu wokół centrum miasta |
| `SCALE_SIM_CITY_START_RADIUS_KM` | `4` | Promień rozmieszczenia zawodników |
| `SCALE_POSTGRES_DISK_BUDGET_GB` | `5` (Railway) | Budżet dysku — [DISK_GUARD.md](../DISK_GUARD.md) |
| `SCALE_BATCH_PARALLEL_CITIES` | `true` | Równoległe miasta przy dużym batchu |
| `SCALE_MAX_CONCURRENT_RIDERS` | `5000` | Limit jednoczesnych jazd |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | `max_starts_per_live_tick` (~30) | Max nowych `route_live_ride_task.delay` na jeden `live_tick` (niezależnie od backpressure) |
| `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | *(puste = wyłączone)* | Gdy ustawione (np. `120` przy 2 replikach routing) — **backpressure**: ogranicza dispatchy, gdy `LLEN routing` + `ROUTING` FSM ≥ cap |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | `0` = BRouter w `live_tick` (stary model); `1` = kolejka `routing` |
| `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` | `0` | Po N tickach z backpressure obniż `active_ratio` w Redis (domyślnie **wyłączone** — suwaki operatora mają pierwszeństwo) |
| `SIM_BP_LOWER_AFTER_TICKS` | `12` | Liczba kolejnych ticków z `routing_backpressure_active` przed auto-obniżką |
| `SIM_BP_LOWER_FACTOR` | `0.95` | Mnożnik przy auto-obniżce (mniej agresywny niż wcześniejsze 0.85) |
| `SIM_BP_MIN_DISPATCH_PER_TICK` | `12` | Min. dispatchy routingu na tick przy backpressure (nie blokuj całkowicie) |
| `SIM_BP_DRAIN_DISPATCH_PER_TICK` | `20` | Dispatchy/tick gdy depth tuż nad capem |
| `SIM_BP_QUEUE_HEADROOM` | `25` | Gdy depth ≥ cap+headroom → stosuj min dispatch |
| `BROUTER_RETRIES` | `3` | Ponowienia HTTP przy `RemoteDisconnected` / 5xx (pool `requests.Session`) |

**Backpressure (Paczka 1b+):** głębokość = `LLEN routing` + liczba jazd w stanie `ROUTING` (undispatched `PENDING_ROUTE` nie podbija depth). Przy backpressure dispatch cap jest **obniżany**, nie zerowany — kolejka może się drenować przy jednoczesnym ramp-up. Log: `sim.routing.backpressure` / wpis w live log (rate-limit 60 s).

**Railway (szybszy ramp, Hobby 2×1 GB routing):** ustaw na `celery-worker-simulation` + `Backend`: `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=120`, `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=50`, `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=0`. Live start: `intensity=50`, `load=50` (≈ `active_ratio=0.29`, 50 starts/tick). Jeśli depth nadal pinned >15 min — podnieś cap do `150` lub dodaj 3. replikę routing (patrz [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)).

### Profil stabilny prod (Hobby, bez regresji UX)

| Pytanie | Odpowiedź |
|---------|-----------|
| Czy to problem planu Hobby? | **Nie** — Hobby daje do **48 GB / serwis** i **8 GB / replika**. Wcześniejsze problemy wynikały z **cap depth=80** w prod (repo już ma **120**), **auto-obniżki `active_ratio`** (domyślnie **wyłączone**) i **OOM wipe/routing** (mniejsze chunki + RAM w `railway.json`), nie z limitu planu. |
| Koszt ~30 USD/mies. | Przy capach ~12 GB app + usage-based typowo **poniżej** tego budżetu; nie ustawiaj wszystkiego na 48 GB „na zapas”. |
| Regresja UX | Unikaj: `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=1`, pustego `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH`, load=100 przy pinned queue, wyłączenia ramp (`SCALE_SIM_RAMP_TICKS=0`) na starcie. |

**SSOT turbo (`railway.json`):** depth **200**, dispatch **150**, starts env **150**, routing **3 repliki**, auto-lower **0**, BP **25/40**, ramp **8 s × 10 ticków**. Admin: preset **Turbo map** (intensity/load 100). Po deploy: `.\scripts\railway-verify-production.ps1`.

**Uwaga:** ~100 ACTIVE/tick wymaga ~100 ukończonych tras/tick (BRouter + 3× routing). Jeśli `ride_warming` rośnie — kolejka routingu; obniż load lub dodaj replikę.

### Wąskie gardła (kolejność)

| # | Gardło | Objaw | Mitigacja (repo + Railway) |
|---|--------|-------|----------------------------|
| 1 | **Stare env w Dashboard** | log `cap=80`, starts≤30 | `.\scripts\railway-sync-sim-env.ps1` → depth **200**, dispatch **150** |
| 2 | **BRouter + routing throughput** | 150 queued, 1–4 ACTIVE/tick | 4× routing @ 2 GB, brouter 2 GB; `INSTANT_ACTIVE_ON_ROUTE=1` |
| 3 | **Backlog starved** | warming rośnie | dispatch **backlog first** (kod `b51efaca`) |
| 4 | **Target puli** (`active_ratio×users`) | ~6 startów przy pełnej mapie | `active_on_map` budget + wyższa Aktywność |
| 5 | **Pipeline Redis** | OOM / wolny status | `MAX_PIPELINE_ABSOLUTE=2000` |

Sync env: `.\scripts\railway-sync-sim-env.ps1` (wymaga `RAILWAY_API_TOKEN`).

**Szybko + bezpiecznie (`SCALE_SIM_START_BUDGET_MODE=active_on_map`, domyślnie):** nowe starty liczone od **wolnych slotów na mapie** (`target_on_map − ACTIVE`), nie od całego warming. Twardy limit: `max_pipeline_rides` (~2.5× target). UI pokazuje **Wolne sloty mapy** i **startów/tick**. Przy ~999 userów i 245 ACTIVE oczekuj **~40–150 startów/tick** (nie ~6).

**Operacja po deploy:** Stop live → start **Aktywność 50 / Obciążenie 50** (nie stary `active_ratio` z calm restart). Oczekiwane: `ride_warming` spada, backpressure okazjonalne (nie ciągłe `skipped 50`), mapa nabiera ACTIVE w rampie.

Pełna lista: `backend/activities/scale_config.py`, [SCALE_TEST_300K.md](../SCALE_TEST_300K.md).

### Testy lokalne (pamięć)

Po dużym live sim Redis może trzymać ogromny hash `live_rides` — **GET status ładuje `hgetall`**, co przy pytest może skończyć się OOM.

```bash
cd backend
python run_pytest.py activities/test_simulator_backpressure.py activities/test_simulator_status_views.py activities/test_simulator_routing.py -m simulator_light -v --tb=short
```

Testy jednostkowe mockują broker i `get_live_rides`; widoki statusu mają `autouse` patch na pusty hash. Nie uruchamiaj pełnego `pytest` backendu, jeśli ładujesz GDAL/PostGIS bez potrzeby.

**Logi strukturalne (Paczka 1b — Datadog / Railway):** szukaj kluczy `sim.routing.backpressure` i `sim.routing.unroutable` w logach workera `celery-worker-simulation` / `celery-worker-routing`. Szczegóły pól: [DATADOG_SIMULATOR.md](./DATADOG_SIMULATOR.md).

---

## Live Map (admin) — poziomy zoomu

Moduły: `liveMapZoom.ts` (tiery + LOD API), `liveMapLayers.ts` (warstwy GPU), `liveMapInterp.ts` (płynny ruch), `liveMapSprite.ts` (atlas ikon). Badge na mapie = aktualny tryb.

| Zoom | Tryb | Render |
|------|------|--------|
| &lt; 7 | Kraj | Huby GL + `detail=summary` (bez punktów w JSON) |
| 7–8.5 | Region | Huby + klastry |
| 8.5–9.5 | Aglomeracja | Huby (fade) + klastry |
| 9.5–12.2 | Miasto → Osiedle | Klastry MapLibre (klik = zoom) |
| 12.2–13.5 | Ulice (ikony) | **Symbol layer GPU**, collision engine |
| ≥ 13.5 | Ulice (etykiety) | Ikona + tekst GPU (`text-optional`) |
| Klik | Popup | Jedyny DOM — karta Athlete |

**API LOD:** `detail=summary|standard|full` (auto z zoomu) — mniejszy payload przy widoku kraju (`standard` bez nazw).

- Brak setek markerów HTML — wydajność jak Mapbox/Uber.
- Interpolacja pozycji między poll (~320 ms).
- Klastry do zoom **14**; jeden `setData` na tick.

Stary admin z markerami HTML: deploy + Ctrl+F5.

---

## Typowe logi

| Log | Znaczenie |
|-----|-----------|
| `only N athletes available (wanted M)` | Live wystartował za wcześnie lub mało ATHLETE w DB |
| `BRouter routing failed … pass=0` | Start poza siecią dróg — retry z centrum miasta; zobacz [BROUTER.md](./BROUTER.md) |
| `Road-only mode: skipped N starts` | `STRICT_ROAD_ROUTES=1` i brak trasy |
| `Batch simulation is still in progress` | Live zablokowany — poprawna ochrona |
| `Routing backpressure: skipped N dispatches` | Kolejka routing / FSM warming ≥ `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` |
| `Auto-lowered active_ratio …` | `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` — log `sim.profile.auto_lower` (rate-limit 60 s) |

---

## Wipe danych — wykrywanie „stuck” i auto-recovery

Chunkowany `DELETE /api/activities/admin/wipe-data/` zapisuje postęp w Redis (`last_progress_at` przy każdym `set_wipe_state`). API ustawia `stuck=true` gdy:

| Warunek | Domyślny próg (env) |
|---------|---------------------|
| Faza `queued` / `starting` | `WIPE_STALE_QUEUED_SEC` (120 s) |
| Brak `last_progress_at` | `WIPE_STALE_RUNNING_SEC` (900 s od `started_at`) |
| Brak dotknięcia postępu | `WIPE_STALE_NO_PROGRESS_SEC` (180 s); faza `users` dodatkowo `min(…, WIPE_STALE_USERS_SEC=300)` |

Admin (`SimulatorApi.wipeData`): przy `stuck` raz na sesję wywołuje `recoverStuckWipe` — `POST simulator-reset/` (czyści lock), potem `DELETE wipe-data/` z `force=true`. UI pokazuje alert na pasku postępu.

Ręcznie: reset symulatora w panelu, potem ponów wipe z potwierdzeniem frazą.

### Worker OOM podczas wipe (Railway)

| Objaw | Przyczyna |
|-------|-----------|
| Modal utknął w fazie `users` (~60%), mało `rows_deleted`, spinner | `celery-worker` dostał **SIGKILL (OOM)** w trakcie `wipe_data_task` — Redis nadal pokazuje `running` |
| Railway: `celery-worker` deploy failed, Out of Memory | Duże chunki + Django `delete()` collector na User CASCADE (prefork × concurrency) |

**Natychmiast (operator):**

1. Poczekaj aż `celery-worker` znów jest **Active** (redeploy z `main` lub ręczny restart).
2. Admin → **Reset simulator locks** (`POST simulator-reset/`) — czyści lock wipe/sim.
3. Ponów **Wipe** z potwierdzeniem frazą (UI może auto-recovery przy `stuck=true`).
4. Opcjonalnie na serwisie `celery-worker`: `SCALE_WIPE_USER_CHUNK_SIZE=100`, `CELERY_WORKER_CONCURRENCY=2`.

Repo SSOT: `celery-worker/railway.json` (**2 GB** RAM, mniejsze chunki), `wipe_tasks.py` używa `_raw_delete` w fazie users. Zobacz [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

---

## Endpointy admin (skrót)

| Metoda | Ścieżka |
|--------|---------|
| POST | `/api/activities/admin/simulate/` — start batch |
| GET | `/api/activities/admin/simulate/` — status batch |
| DELETE | `/api/activities/admin/simulate/` — stop batch |
| POST | `/api/activities/admin/live-simulate/` — start live |
| GET | `/api/activities/admin/live-simulate/` — status live |
| DELETE | `/api/activities/admin/live-simulate/` — stop live |
| POST | `/api/activities/admin/simulator-reset/` — reset flag |

Szczegóły: [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) §5.
