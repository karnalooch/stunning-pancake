# Kamień milowy 2: Silnik V2 i Anti-Cheat — dokumentacja techniczna

> **Status:** ✅ Wydano — tag `v0.2.0-alpha`
> **Commit:** `e5a926e`
> **Bazuje na:** [Kamień milowy 1 — v0.1.0-alpha](developer_quickstart.md)

---

## Spis treści

1. [Przegląd](#przegląd)
2. [System wtyczek v2 (pluggy)](#1-system-wtyczek-v2-pluggy)
3. [Kinematyczny Anti-Cheat V-max](#2-kinematyczny-anti-cheat-v-max)
4. [Asynchroniczna tabela wyników miasta (potok Redis)](#3-asynchroniczna-tabela-wyników-miasta-potok-redis)
5. [Tabela wyników REST API](#4-tabela-wyników-rest-api)
6. [React Native — nowe ekrany](#5-react-native--nowe-ekrany)
7. [Harmonogram Celery Beat](#6-harmonogram-celery-beat)
8. [Nowe zmienne środowiskowe](#7-nowe-zmienne-środowiskowe)
9. [Diagram architektury](#8-diagram-architektury)

---

## Przegląd

Kamień milowy 2 dostarcza trzy główne aktualizacje silnika i dwa nowe ekrany mobilne:

| Komponent | Zmiana | Wpływ |
|:---|:---|:---|
| Przepływ danych | Traccar → **Redis Direct** | Pomija HTTP; opóźnienie przyjmowania <1ms |
| System wtyczek | **Walidatory sportowe** | Logika dla konkretnych dyscyplin (Bieg/Rower) przy użyciu pluggy |
| Anti-Cheat | **Lekkie odrzucanie** | Odrzuca fałszywe trasy *przed* wywołaniem BRoutera |
| Rankingi | **Widoki zmaterializowane PostGIS** | Oficjalne statystyki miasta z `REFRESH CONCURRENTLY` |
| Panel moderatora | **React + MapLibre** | Przegląd oflagowanych aktywności na podzielonym ekranie |
| Silnik mobilny | **Haversine + Filtr Jittera** | Obliczanie dystansu w czasie rzeczywistym na urządzeniu |

---

## 1. System wtyczek v2 (pluggy)

### Dlaczego pluggy?

Niestandardowy `PluginRegistry` z Kamienia milowego 1 używał prostego słownika elementów wywoływalnych.
`pluggy` (ten sam silnik, którego używa **pytest**) dodaje:

- **Specyfikacje hooków** (`HookSpec`) — formalne kontrakty dla każdego hooka
- **Izolowane obiekty wtyczek** — brak współdzielonego stanu między wtyczkami lub testami
- **Śledzenie** — włączane automatycznie przy `DEBUG=1`
- **Introspekcja najwyższej klasy** — `pm.get_hookimpls()`

### Inwentarz hooków

```python
# Wszystkie hooki zdefiniowane w SportHookSpec (core/plugin_registry.py)

activity_verified(activity)        # Aktywność przeszła wszystkie testy walidacyjne
validate_activity(activity, res)   # [NOWOŚĆ] Weto specyficzne dla sportu (zwraca bool)
activity_suspicious(activity, ratio) # Heurystyka V-max odrzuciła trasę
event_completed(event)             # Wydarzenie przeszło w stan ACTIVE → COMPLETED
club_created(club)                 # Utworzono nowy klub (wyzwala pokój Matrix)
```

### Wtyczki dyscyplin sportowych

Kamień milowy 2 wprowadza wyspecjalizowane walidatory:
- **RunValidatorPlugin**: Odrzuca biegi z niemożliwym przewyższeniem (>400m/km).
- **BikeValidatorPlugin**: Weryfikuje trasy rowerowe względem sieci dróg rowerowych.

### Kompatybilność wsteczna

Stare API nadal działa — istniejący kod używający `registry.fire()` i `@registry.hook()` jest w pełni obsługiwany:

```python
# STARE (Kamień milowy 1) — nadal działa
@registry.hook('activity.verified')
def my_handler(activity, **kwargs):
    ...

# NOWE (Kamień milowy 2) — zalecane dla nowych wtyczek
from core.plugin_registry import hookimpl, registry, PluginManifest

class MyPlugin:
    @hookimpl
    def activity_verified(self, activity):
        ...

manifest = PluginManifest(name='my_plugin', version='1.0.0',
                          author='dev', description='Moja wtyczka',
                          hooks=['activity.verified'])
registry.register(manifest, MyPlugin())
```

### Pisanie wtyczki

1. Utwórz `backend/plugins/my_plugin.py`
2. Zdefiniuj klasę z metodami `@hookimpl`
3. Utwórz `PluginManifest`
4. Wywołaj `registry.register(manifest, MyPlugin())`
5. Dodaj do `INSTALLED_APPS` lub zaimportuj w `AppConfig.ready()`

### Śledzenie DEBUG

Ustaw `DEBUG=1` w `.env`, aby włączyć śledzenie wywołań pluggy — każde wywołanie hooka
jest logowane wraz z argumentami i wartościami zwracanymi. Przydatne podczas programowania.

---

## 2. Kinematyczny Anti-Cheat V-max

### Architektura

Potok anti-cheat działa jako **Krok 3** w `process_activity_async()`:

```
surowe punkty GPS
      ↓
  Filtr Kalmana (redukcja szumów)
      ↓
  analyze_anomalies()  ← Lekka heurystyka (V-max)
      ↓
  [WCZESNE ODRZUCENIE] jeśli podejrzane (oszczędza CPU BRoutera)
      ↓
  Viterbi HMM Map Matching
      ↓
  Walidacja topologiczna BRouter
      ↓
  is_verified: True/False + suspicious_reason
```

### Progi V-max

| Sport | V-max (m/s) | V-max (km/h) | Z 10% marginesem |
|:---|:---:|:---:|:---:|
| `RUN` | 12.0 | 43.2 | 13.2 m/s |
| `BIKE` | 25.0 | 90.0 | 27.5 m/s |
| `WALK` | 3.5 | 12.6 | 3.85 m/s |
| `WHEELCHAIR` | 8.0 | 28.8 | 8.8 m/s |

### Kryteria odrzucenia

Aktywność jest oznaczana jako `is_suspicious=True`, jeśli spełniony jest **którykolwiek** z warunków:

| Reguła | Domyślnie | Zmienna env |
|:---|:---|:---|
| Współczynnik anomalii > próg | >20% segmentów | `VMAX_ANOMALY_RATIO` |
| Kolejne naruszenia | ≥3 z rzędu | `VMAX_CONSECUTIVE` |
| Margines prędkości | 10% ponad V-max | `VMAX_MARGIN` |

### Przykładowy wynik

```json
{
  "status": "done",
  "activity_id": 42,
  "is_verified": false,
  "anomaly_ratio": 0.23,
  "max_consecutive": 4,
  "suspicious_reason": "anomaly_ratio=23.00% przekracza próg 20%",
  "distance_m": 5240.5
}
```

### Alert Matrix

Gdy `is_suspicious=True`, silnik wyzwala:
1. Hook wtyczki `activity.suspicious` (możliwy do przechwycenia przez dowolną wtyczkę)
2. Bezpośrednie powiadomienie Matrix do `!admin_room_id:matrix.org`

---

## 3. Asynchroniczna tabela wyników miasta (potok Redis)

### Problem (Kamień milowy 1)

Przy 200 jednoczesnych zakończeniach aktywności, każde wyzwalało oddzielne wywołanie `ZINCRBY`:
- **200 indywidualnych cykli do Redis**
- Wyścigi (race conditions) przy obciążeniu Redis
- Tabela wyników tymczasowo niespójna

### Rozwiązanie (Kamień milowy 2)

```
Zakończenie aktywności
       ↓
  ZINCRBY (natychmiastowe, w czasie rzeczywistym) ← nadal dla każdej aktywności
       ↓
Co 5 minut → Celery Beat wyzwala:
  recalculate_city_leaderboard(city_id)
       ↓
  SELECT SUM(distance) GROUP BY user_id  ← pojedyncze zapytanie DB
       ↓
  redis.pipeline()
    .delete('leaderboard:city:siedlce')
    .zadd('leaderboard:city:siedlce', {uid: km, ...})  ← atomowa zamiana
    .expire(...)
    .execute()
       ↓
  Tabela wyników spójna ✓
```

### Kluczowe metody

```python
from activities.leaderboards import LeaderboardService

# Aktualizacja w czasie rzeczywistym (nadal używana per aktywność)
LeaderboardService.update_score(user_id=42, entity_id='siedlce', score_delta=5.5)

# Przeliczenie wsadowe (atomowy potok Redis)
LeaderboardService.batch_recalculate('siedlce', {42: 105.3, 7: 88.1}, scope='city')

# Odczyt (serwowany z Redis, <5ms)
top = LeaderboardService.get_top_users('siedlce', limit=50)

# Specyficzne dla użytkownika
rank  = LeaderboardService.get_user_rank('siedlce', user_id=42)
score = LeaderboardService.get_user_score('siedlce', user_id=42)

# Czyszczenie (wywoływane, gdy wydarzenie COMPLETED)
LeaderboardService.reset(event_id, scope='event')
```

### Cache TTL

| Operacja | TTL |
|:---|:---|
| Zapis per aktywność | przedłuża do 30 min |
| Przeliczenie wsadowe | ustawia na 30 min |
| Znacznik czasu przeliczenia | 1 godzina |
| Konfigurowalne przez | `LEADERBOARD_CACHE_TTL` (sekundy) |

---

## 4. Tabela wyników REST API

### Endpointy

#### `GET /api/activities/leaderboard/<city_id>/`

Zwraca najlepszych sportowców dla miasta. Serwowane z Redis w <5ms.

**Autoryzacja:** Wymagany Bearer JWT

**Parametry zapytania:**

| Parametr | Typ | Domyślnie | Opis |
|:---|:---|:---|:---|
| `limit` | int | 50 | Maks. wyników (maks. 200) |
| `scope` | string | `city` | `city`, `event` lub `club` |

**Odpowiedź 200:**
```json
{
  "city_id": "siedlce",
  "scope": "city",
  "updated_at": 1714000000.0,
  "count": 50,
  "leaderboard": [
    { "user_id": "42", "score": 105.3, "rank": 1 },
    { "user_id": "7",  "score": 88.1,  "rank": 2 }
  ]
}
```

**Odpowiedź 202** (Redis pusty, trwa przeliczanie):
```json
{
  "status": "recalculating",
  "message": "Trwa obliczanie tabeli wyników. Spróbuj ponownie za 10 sekund."
}
```

---

#### `GET /api/activities/leaderboard/<city_id>/me/`

Zwraca rangę i wynik bieżącego użytkownika.

**Odpowiedź 200:**
```json
{
  "city_id": "siedlce",
  "user_id": 42,
  "rank": 1,
  "score_km": 105.3
}
```

---

## 5. Panel sterowania moderatora (React)

Kamień milowy 2 dodaje wysokowydajny **Panel moderatora** do przeglądania oflagowanych tras.

### Funkcje
- **Widok podzielonego ekranu**: Lista aktywności po lewej, mapa/szczegóły po prawej.
- **Wizualizacja MapLibre**: Renderuje odrzuconą trasę z znacznikami anomalii.
- **Zestaw działań**: Zatwierdzanie, odrzucanie lub banowanie użytkownika jednym kliknięciem.
- **Techniczny niebieski motyw**: Zintegrowany z Obsidian Design System.

### Komponenty
- `ModeratorView.tsx`: Główny układ i integracja z API.
- `MapTrackViewer.tsx`: Komponent MapLibre GL wielokrotnego użytku do wyświetlania tras.

### LoginScreen

**Plik:** `mobile/src/screens/LoginScreen.tsx`

- Formularz e-mail + hasło z autoryzacją JWT przez `api.login()`
- `KeyboardAvoidingView` (kompatybilny z iOS/Android)
- Optymistyczny stan ładowania
- Wyświetlanie błędów w markowym polu błędów
- Auto-wysyłanie przyciskiem "Go" na klawiaturze

### HistoryScreen

**Plik:** `mobile/src/screens/HistoryScreen.tsx`

- TanStack Query z 5-minutowym czasem ważności (działa offline)
- Baner podsumowujący: suma aktywności / zweryfikowane km / liczba zatwierdzeń
- Karty aktywności z: ikoną sportu, datą, dystansem, czasem trwania
- Zielona plakietka `✓ OK` dla zweryfikowanych aktywności, `⏳` dla oczekujących
- Pull-to-refresh

### Aktualizacja nawigacji

Dodaj kartę `History` do `mobile/src/App.tsx`:

```tsx
<Tab.Screen
  name="History"
  component={HistoryScreen}
  options={{
    title: 'Historia',
    tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,      
  }}
/>
```

### Nowe metody API (api.ts)

```typescript
// Tabela wyników miasta (endpoint Kamienia milowego 2)
await api.getCityLeaderboard('siedlce', 50);

// Ranga bieżącego użytkownika
await api.getMyRank('siedlce');
// → { rank: 1, score_km: 105.3 }
```

---

## 6. Harmonogram Celery Beat

Pełny harmonogram po Kamieniu milowym 2:

| Zadanie | Harmonogram | Kolejka | Opis |
|:---|:---|:---|:---|
| `recalculate_city_leaderboard` | Co 5 min | `default` | Przeliczanie wsadowe potoku Redis |
| `refresh_city_rankings_mv` | Wyzwalane | `default` | REFRESH MATERIALIZED VIEW CONCURRENTLY |
| `send_leaderboard_digest` | Poniedziałek 08:00 | `notifications` | Cotygodniowe podsumowanie Matrix |
| `close_expired_events` | Codziennie 00:05 | `default` | Auto-zamykanie + czyszczenie Redis |

Uruchom Beat w Dockerze:
```bash
docker compose exec celery_beat celery -A core beat -l info
```

Lub samodzielnie:
```bash
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

---

## 7. Nowe zmienne środowiskowe

Dodaj je do `.env` (wszystkie są opcjonalne — pokazano wartości domyślne):

```bash
# Progi V-max Anti-Cheat
VMAX_ANOMALY_RATIO=0.20    # >20% segmentów powyżej V-max → podejrzane
VMAX_CONSECUTIVE=3          # 3+ kolejne naruszenia → podejrzane
VMAX_MARGIN=1.10            # 10% tolerancji ponad biomechaniczne maks.

# Cache tabeli wyników
LEADERBOARD_CACHE_TTL=30    # Mnożnik TTL Redis w sekundach (rzeczywisty = x60)    
```

---

## 8. Diagram architektury

```
┌─────────────────────────────────────────────────────────────────┐
│                        Platforma SPORT v2.0                     │
│                                                                 │
│  Aplikacja mobilna (React Native 0.76)                         │
│  ├── LoginScreen     → POST /api/auth/token/                    │
│  ├── ActiveSession   → FastAPI WS :8001 (przyjmowanie GPS)      │
│  ├── HistoryScreen   → GET /api/activities/                     │
│  ├── EventsScreen    → GET /api/events/                         │
│  └── Leaderboard     → GET /api/activities/leaderboard/<city>/  │
│                                 ↓                               │
│  Django API :8000                                               │
│  ├── auth/           JWT (simplejwt)                            │
│  ├── activities/     CRUD + potok                               │
│  │     └── leaderboard/<city>/  ← Najpierw Redis, <5ms          │
│  └── events/         OGC + punktacja najemców                   │
│                                 ↓                               │
│  Celery Workers (kolejka krytyczna)                             │
│  └── process_activity_async()                                   │
│        ├── Maskowanie prywatności                               │
│        ├── Filtr Kalmana                                        │
│        ├── Heurystyka V-max ← NOWOŚĆ                            │
│        │     ├── sprawdzenie współczynnika anomalii (>20%)      │
│        │     └── sprawdzenie kolejnych naruszeń (≥3)            │
│        ├── Viterbi HMM map matching                             │
│        ├── Walidacja BRouter                                    │
│        ├── LeaderboardService.update_score()  ← czas rzeczyw.  │
│        └── pluggy: fire(activity.verified)    ← NOWOŚĆ          │
│                  └── VoucherHotspotPlugin                       │
│                                 ↓                               │
│  Celery Beat (co 5 min)                                         │
│  └── recalculate_city_leaderboard()                             │
│        ├── DB: SELECT SUM(distance) GROUP BY user               │
│        └── Redis pipeline: DELETE + ZADD (atomowe)              │
│                                                                 │
│  FastAPI Telemetry :8001                                        │
│  ├── POST /api/telemetry/ingest/batch   ← mobilny GPS          │
│  ├── GET  /api/telemetry/live            ← HTTP fallback        │
│  ├── WS   /ws/telemetry/live            ← Panel Admina         │
│  └── _traccar_redis_bridge()  ← pub/sub z Traccar               │
│                                                                 │
│  TimescaleDB (hypertable gps_points)                            │
│  PostGIS (widok zmaterializowany city_rankings_mv)              │
│  Redis (zestawy posortowane leaderboard + pub/sub)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testowanie funkcji Kamienia milowego 2

```bash
# Uruchom wszystkie testy backendu
docker compose exec backend pytest -q

# Testuj konkretnie potok anti-cheat
docker compose exec backend pytest activities/tests.py -v -k "anomaly or vmax"  

# Testuj system wtyczek
docker compose exec backend pytest events/tests.py -v -k "Plugin"

# Ręczne wymuszenie przeliczenia tabeli wyników
docker compose exec backend python manage.py shell -c "
from activities.tasks import recalculate_city_leaderboard
recalculate_city_leaderboard('siedlce')
print('gotowe')
"

# Sprawdź stan tabeli wyników w Redis
docker compose exec redis redis-cli ZREVRANGE leaderboard:city:siedlce 0 9 WITHSCORES
```

---

*Następnie: Kamień milowy 3 — wyświetlanie trasy MapLibre, testy E2E Detox, CI EAS Build*
