# Plan v2: Kreator Symulacji Użytkowników Garmin (Siedlce) — Live Map + GPX 1:1

## Status
✅ Decyzje potwierdzone — gotowy do implementacji (wersja live)

## Nowa architektura — Live Ride → Live Map → GPX → Garmin

Zamiast generować historyczne trasy hurtowo, odpalamy jazdy **na żywo** zgodnie z harmonogramem:

```
Admin UI
  │
  ▼ POST /api/activities/admin/garmin-simulate/
  │
  ▼
Celery Task: schedule_garmin_rides()
  │
  ├── Tworzy N userów (garmin_sim_01...garmin_sim_N)
  ├── Generuje harmonogram z datami i godzinami
  ├── Dla każdej jazdy:
  │     run_garmin_live_ride.apply_async(args=[ride_plan], eta=start_time)
  │
  ▼ Gdy nadchodzi godzina startu:
run_garmin_live_ride(ride_plan)
  │
  ├── Generuje trasę BRouter
  ├── Ustawia klucz Redis {sim}:garmin_live:{ride_id}:state = "ACTIVE"
  ├── Co 1 sekundę (Celery beat lub sleep loop):
  │     ├── Interpoluje pozycję na trasie
  │     ├── Liczy HR, kadencję, elewację
  │     ├── TelemetryService.push_simulator_position(...) → LIVEMAPA!
  │     └── Zapisuje punkt do Redis listy {sim}:garmin_live:{ride_id}:points
  │
  ▼ Po duration_s sekundach:
finish_garmin_ride(ride_id)
  │
  ├── Pobiera wszystkie punkty z Redis listy
  ├── Generuje GPX 1.1 Edge 530 (1s gęstość)
  ├── Upload GPX → Garmin Connect (garminconnect)
  ├── Tworzy Activity w 4velo DB
  ├── Zapisuje GPX do storage (S3/local)
  └── Czyści Redis klucze ride'a
```

### Kluczowa zmiana: gęstość 1:1 Garmin 530

| Warstwa | Odstęp | Opis |
|---|---|---|
| Redis push (livemapa) | **1 sekunda** | `TelemetryService.push_simulator_position()` — tyle samo co Edge 530 recording |
| Redis zapis punktów | **1 sekunda** | `RPUSH {sim}:garmin_live:{ride_id}:points` — pełna historia do późniejszego GPX |
| GPX | **1 sekunda** | `<trkpt>` co 1s — identycznie jak prawdziwy Edge 530 |

Dla 70km przy 25km/h: ~2.8h jazdy = ~10,000 sekund = 10,000 punktów GPX = **identycznie jak Edge 530 Smart Recording**.

### Redis keys (rozszerzone)

| Klucz | Typ | Opis |
|---|---|---|
| `{sim}:garmin_batch:state` | hash | `running`, `progress_pct`, `phase`, `total_rides`, `rides_done`, `rides_scheduled`, `rides_active`, `error` |
| `{sim}:garmin_batch:log` | list | `[timestamp\|message]` |
| `{sim}:garmin_batch:lock` | string | `task_id` (TTL 30min) |
| `{sim}:garmin_live:{ride_id}:state` | hash | `status` (PENDING/ACTIVE/FINISHING/COMPLETE), `user_id`, `start_time`, `duration_s`, `progress_pct` |
| `{sim}:garmin_live:{ride_id}:points` | list | `[lat,lon,ele,hr,cad,atemp,timestamp]` — JSON na pozycję |
| `{sim}:garmin_live:{ride_id}:lock` | string | `task_id` (TTL = duration_s + 60) |

---

## Backend — zmiany vs wersja v1 (już zaimplementowana)

### 1. ZMIANA: `backend/activities/garmin_simulator.py`

**Usunąć**: `run_batch()` — orkiestracja sekwencyjna  
**Usunąć**: `_process_single_ride()` — generowanie GPX na sucho  
**Dodać**:

```python
def schedule_rides(credentials, config, task_id) -> dict:
    """Tworzy userów → generuje harmonogram → planuje Celery taski z ETA."""
    # Zapisuje każde RidePlan jako task apply_async(eta=start_time)
    # Zapisuje licznik scheduled_rides w Redis
    # Zwraca {"status": "scheduled", "total_rides": N, "first_ride_at": ...}

def run_live_ride(ride_plan: RidePlan, user_id: int, ride_id: str):
    """Odpala live ride: push do Redis co 1s przez duration_s sekund."""
    # 1. Generuje trasę BRouter
    # 2. Ustawia state=ACTIVE w Redis
    # 3. Co 1s (time.sleep(1)):
    #    a. Interpoluje pozycję, HR, kadencję, elewację
    #    b. TelemetryService.push_simulator_position(device_id, lat, lon, speed, course, hr)
    #    c. RPUSH punktu do {sim}:garmin_live:{ride_id}:points
    # 4. Po duration_s → wywołuje finish_garmin_ride.delay(ride_id)

def finish_garmin_ride(ride_id: str):
    """Kończy jazdę: zbiera punkty → GPX → upload Garmin → Activity DB."""
    # 1. Pobiera wszystkie punkty z Redis
    # 2. Generuje GPX Edge 530 (1s gęstość, wszystkie dane)
    # 3. Upload GPX → Garmin Connect
    # 4. Tworzy Activity w DB
    # 5. Zapisuje GPX do storage
    # 6. Czyści Redis klucze ride'a
    # 7. Aktualizuje batch progress
```

**Motion profile** — bez zmian (HR, kadencja, elewacja, temperatura generowane na żywo).

### 2. ZMIANA: `backend/activities/garmin_simulator_tasks.py`

```python
@shared_task(queue="simulation", bind=True, max_retries=2, default_retry_delay=30)
def schedule_garmin_rides(self, credentials, config_dict):
    """Planuje wszystkie jazdy z ETA. Nie blokuje na duration."""

@shared_task(queue="simulation", bind=True, max_retries=1, default_retry_delay=10)
def run_garmin_live_ride(self, ride_plan_dict, user_id, ride_id):
    """Odpala live ride. Śpi w pętli 1s przez całą jazdę (UWAŻAJ NA WORKER TIMEOUT)."""

@shared_task(queue="simulation", bind=True, max_retries=2, default_retry_delay=30)
def finish_garmin_ride(self, ride_id):
    """Finalizuje jazdę po zakończeniu."""
```

**Problem worker timeout**: Celery task `run_garmin_live_ride` śpi 2.5 godziny (tyle trwa 70km jazda). To zablokuje workera. Rozwiązania:

| Opcja | Opis |
|---|---|
| **A. Celery Beat** | `schedule_garmin_rides()` ustawia wpisy w `django-celery-beat` PeriodicTask z dynamicznym crontabem. `run_live_ride` odpala się co 1s przez beat i inkrementuje tick. |
| **B. Tick chain** | Jak istniejący live symulator: task odpala siebie samego z `countdown=1`. Ostatni tick → `finish`. |
| **C. Dedykowany worker** | Worker z `--time-limit=14400` (4h) — najprostsze, ale marnotrawstwo. |

**Rekomendacja B (Tick chain)** — spójne z istniejącą architekturą symulatora:

```python
@shared_task(queue="simulation", bind=True, acks_late=True, reject_on_worker_lost=True)
def run_garmin_live_tick(self, ride_id: str, tick: int, max_ticks: int):
    # 1 tick = 1s
    # Pobiera ride state z Redis
    # Interpoluje pozycję na podstawie tick * speed
    # Push do Redis (livemapa + points)
    # Jeśli tick < max_ticks: run_garmin_live_tick.apply_async(
    #     args=[ride_id, tick + 1, max_ticks], countdown=1
    # )
    # Jeśli tick == max_ticks: finish_garmin_ride.delay(ride_id)
```

---

## Format GPX — bez zmian

Gęstość 1 punkt na sekundę (1:1 Garmin Edge 530):

```
<trkpt lat="52..." lon="22...">
  <ele>152.4</ele>
  <time>2026-06-17T15:30:00Z</time>
  <extensions>
    <gpxtpx:TrackPointExtension>
      <gpxtpx:hr>128</gpxtpx:hr>
      <gpxtpx:cad>78</gpxtpx:cad>
    </gpxtpx:TrackPointExtension>
    <gpxx:TrackExtension>
      <gpxx:atemp>22</gpxx:atemp>
    </gpxx:TrackExtension>
  </extensions>
</trkpt>
```

Dla 70km/25kmh: 10,080 punktów (168 min × 60s).

---

## Livemapa — widoczność

Dzięki `TelemetryService.push_simulator_position()` co 1s, każdy rider będzie:

- Widoczny na `/api/activities/telemetry/live/` przez `GEORADIUS + HMGET`
- Miał TTL 120s na pozycji (standardowo)
- Wyświetlał się jako `device_type="bike"` z `speed`, `course`, `name`
- Będzie widoczny na mapie w adminie i w aplikacji mobilnej

---

## Frontend — zmiany

### Krok 3 (monitoring) rozszerzony:

- Fazy: `idle → scheduling → scheduled (X rides queued) → riding (Y active now, Z done) → complete`
- Live counter: ile jazd ACTIVATING teraz
- Podgląd: link do livemapy z zaznaczonymi riderami

### Reszta UI — bez zmian (krok 1 credentials, krok 2 schedule)

---

## Pliki do zmiany (względem już zaimplementowanego kodu)

| Plik | Zmiana |
|---|---|
| `garmin_simulator.py` | Nowa orkiestracja: `schedule_rides()`, `run_live_tick()`, `finish_garmin_ride()`. Usunąć stare `run_batch()` i `_process_single_ride()`. Zachować `generate_gpx_edge530()`, `generate_route()`, `generate_schedules()`, profile, Redis helpers. |
| `garmin_simulator_tasks.py` | Nowe taski: `schedule_garmin_rides`, `run_garmin_live_tick`, `finish_garmin_ride`. Usunąć stare `run_garmin_batch_simulation`. |
| `admin_views.py` | `GarminSimulateView.post()` — wywołać `schedule_garmin_rides.delay()` zamiast starego `run_garmin_batch_simulation.delay()`. Status GET — dodać `rides_active`, `rides_scheduled`. |
| `test_garmin_simulator.py` | Nowe testy dla tick chain, live push, finish. Zachować testy GPX, harmonogramu, tras. |

**Bez zmian**: `models.py`, `migrations/`, `urls.py`, `garmin_upload.py`, `requirements.txt`, `SimulatorPage.tsx` (tylko drobne korekty w kroku 3), `client.ts`.

---

## Kolejność implementacji (do przebudowy)

| Faza | Opis | Szacowany czas |
|---|---|---|
| **1. Tick chain** | `run_live_tick()` + `finish_garmin_ride()` w `garmin_simulator.py` | 1h |
| **2. Schedule** | `schedule_rides()` z `apply_async(eta=...)` | 30 min |
| **3. Celery taski** | Przebudowa `garmin_simulator_tasks.py` | 30 min |
| **4. API + Redis** | Aktualizacja `GarminSimulateView`, nowe klucze Redis | 30 min |
| **5. Frontend korekty** | Krok 3 — live counter, faza "scheduled" | 20 min |
| **6. Testy** | Tick chain, live push, finish flow | 45 min |
| **Łącznie** | | ~3.5h |

---

## Ryzyka

1. **Celery worker timeout** — rozwiązane przez tick chain (każdy tick to osobny task, nie blokuje workera)
2. **Redis pamięć** — 10,000 punktów × 10 riderów × 4 jazdy = 400,000 wpisów w Redis listach. Akceptowalne (każdy wpis ~150 bajtów → ~60MB total, czyszczone po finish)
3. **Garmin rate limiting** — uploady są rozłożone w czasie (każda jazda kończy się o innej porze)
4. **Zegar serwera** — `TIME_ZONE = "Europe/Warsaw"`, `USE_TZ = True` — Celery ETA działa poprawnie
