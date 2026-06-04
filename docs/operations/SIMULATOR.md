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
| **Obciążenie systemu** | starts 25→50→80 (0/50/100); BRouter `round(starts×0.83)`; próby 4 jeśli L&lt;75 else 5; tick 12→8→6 s |

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
| `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | *(puste = wyłączone)* | Gdy ustawione (np. `500`) — **backpressure**: brak nowych dispatchy, gdy `max(ride_warming FSM, Celery LLEN routing)` ≥ cap |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | `0` = BRouter w `live_tick` (stary model); `1` = kolejka `routing` |
| `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` | `1` | Po N tickach z backpressure obniż `active_ratio` w Redis (bez Railway API) |
| `SIM_BP_LOWER_AFTER_TICKS` | `6` | Liczba kolejnych ticków z `routing_backpressure_active` przed auto-obniżką |

**Backpressure (Paczka 1b):** `routing_backpressure_snapshot` bierze głębszą z FSM `PENDING_ROUTE`/`ROUTING` i z brokera Redis (`LLEN routing`). Przy aktywnym backpressure `effective_routing_dispatch_cap` zwraca `0` na ticku. Log: `sim.routing.backpressure` / wpis w live log (rate-limit 60 s).

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
