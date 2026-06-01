# Runbook — symulator (batch + live map)

**Ostatnia aktualizacja:** 2026-06-02  
**Kod:** `backend/activities/simulator_*.py`, `admin/src/modules/analytics/SimulatorPage.tsx`, `LiveMap.tsx`

---

## Zasada nr 1: najpierw batch, potem live

1. Uruchom **batch** (generowanie zawodników) i **poczekaj na koniec** (faza `complete`, lock zwolniony).
2. Opcjonalnie: `POST /api/activities/admin/simulator-reset/` — czyści flagi Redis.
3. Dopiero wtedy **live simulation**.

**Dlaczego:** Pula live buduje się raz z zawodników w DB. Start live w trakcie batcha daje np. 48 jeźdźców zamiast tysięcy. API i Celery blokują live, gdy `batch_blocks_live_simulation()` jest true (lock, `running`, faza ≠ idle/complete).

### UI (Simulator)

`SimulatorPage` używa `waitForBatchComplete()` — czeka aż batch **naprawdę wystartował**, potem aż się **skończy** (naprawia stary błąd: pierwszy poll z `running=false` przed startem Celery).

### API

- `POST /api/activities/admin/live-simulate/` → **409** jeśli batch w toku.
- `GET /api/activities/admin/live-simulate/` → `batch_blocks_live`, `batch_block_reason`.

---

## Zalecana kolejność testu 10k

1. Railway: `SCALE_POSTGRES_DISK_BUDGET_GB=5` na **backend** i **celery-worker-simulation**.
2. Batch: `total_users=10000`, `skip_activities=true`, `clear=true` (jeśli czysta baza).
3. Log: `Done: N users` — sprawdź N ≈ oczekiwane (10 miast × ~999 zawodników + moderatorzy).
4. Stop / reset jeśli trzeba, potem live: `pool_pct=1.0`, `active_ratio=0.2–0.3`, `tick_seconds=8`.
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

Pełna lista: `backend/activities/scale_config.py`, [SCALE_TEST_300K.md](../SCALE_TEST_300K.md).

---

## Live Map (admin) — poziomy zoomu

| Zoom | Co widać |
|------|----------|
| &lt; 9 | Huby miast (licznik) + półprzezroczyste kropki GL |
| 9–11 | Klastry/kropki GL + **kompaktowe ikony** (rower/bieg) |
| ≥ 11 | Pełne etykiety zawodników + ikony (limit rośnie z zoomem) |
| ≥ 12.5 | Warstwa GL wyłączona (zostają HTML markery) |

Jeśli „nic nie widać” — twarde odświeżenie (Ctrl+F5) po deployu admina.

---

## Typowe logi

| Log | Znaczenie |
|-----|-----------|
| `only N athletes available (wanted M)` | Live wystartował za wcześnie lub mało ATHLETE w DB |
| `BRouter routing failed … pass=0` | Start poza siecią dróg — retry z centrum miasta; zobacz [BROUTER.md](./BROUTER.md) |
| `Road-only mode: skipped N starts` | `STRICT_ROAD_ROUTES=1` i brak trasy |
| `Batch simulation is still in progress` | Live zablokowany — poprawna ochrona |

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
