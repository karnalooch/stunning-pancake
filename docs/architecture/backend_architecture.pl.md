# ARCHITEKTURA BACKENDU: Platforma "SPORT"
> Ostatnia aktualizacja: 2026-04-24 | **Wydanie Hyperscale** (Po Milestone 5)

## 1. Rdzeń Telemetrii: FastAPI + Redis Pipeline
> **Synergia Architektoniczna**: Stosujemy podejście dwuframowe. **Django (DRF)** obsługuje złożoną logikę biznesową, autoryzację (Admin/Moderator) i dane relacyjne, podczas gdy **FastAPI** zapewnia wysokowydajną, asynchroniczną warstwę przyjmowania strumieni GPS.

### Przepływ Danych (Aktualny)
```
MOBILE (wsad 30s) → FastAPI :8001 → Redis Pipeline → TimescaleDB Hypertable
                                    ↓
                             Celery: process_activity
                               └─ Warstwa 1: Szybka Selekcja (O(N) matematyka, brak I/O)
                               └─ Warstwa 1.5: Detektor Anomalii ML (IsolationForest)
                               └─ Warstwa 2: Kinematyczna Kontrola V-max
                               └─ Warstwa 3: Walidacja Topologiczna BRouter (Viterbi HMM)
                               └─ Warstwa 4: Synchronizacja Rankingów + Przyznawanie Punktów
```

- **FastAPI + asyncpg**: Nieblokujące I/O, obsługuje ponad 10k żądań/sek na pojedynczym węźle.
- **Redis Pipeline**: Buforuje punkty GPS w pamięci przed zapisem wsadowym do TimescaleDB.
- **TimescaleDB Hypertables**: Punkty GPS automatycznie partycjonowane po czasie — odczyty i zapisy nigdy nie konkurują.

---

## 2. Wielowarstwowy Silnik Anti-Cheat (5 Warstw)

| Warstwa | Technologia | Koszt | Odrzuca |
|:---|:---|:---|:---|
| **1. Fast Gate** | Czysta matematyka Python (O(N), brak I/O) | ~0.5ms | Teleportacje, samochody, tramwaje |
| **1.5 ML Gate** | IsolationForest (8 cech kinematycznych) | ~5ms | Statystyczne wartości odstające |
| **2. V-max** | Biomechaniczne limity na sport | ~1ms | Nierealistyczne prędkości |
| **3. BRouter** | Dopasowanie do mapy Viterbi HMM (OSM) | ~200ms | Oszustwa GPS poza drogami |
| **4. Plugin** | Hooki w `core/plugin_registry.py` | własny | Reguły specyficzne dla domeny |

**Kluczowy projekt**: Każda warstwa uruchamia się tylko wtedy, gdy poprzednia zakończy się sukcesem. Ponad 90% oszustw jest wykrywanych w Warstwie 1 (koszt zerowy).
- **Anomalia Z-Score**: Warstwa 1.5 wykorzystuje statystyczne wyniki Z-score (przez NumPy/Pandas) do flagowania nagłych skoków tempa niespójnych z profilem zmęczenia użytkownika.

---

## 3. Wysokowydajne Rankingi: Redis Cluster + PostGIS

### Czas rzeczywisty (Redis Cluster — Hyperscale)
- **3 węzły Master** (16,384 sloty haszujące) + 3 repliki dla failoveru.
- **Sorted Sets**: Błyskawiczne rankingi dla aktywnych wydarzeń i 200 miast jednocześnie.
- **Pipeline Batching**: Zbiorcze `ZADD` przez `core/redis_cluster.py` — automatyczne wykrywanie trybu standalone vs cluster.
- **Repliki odczytu**: Operacje GET kierowane do replik → 3-krotnie większa przepustowość odczytu.

### Oficjalne Rankingi (PostGIS)
- **Materialized Views**: `city_rankings_mv` — źródło prawdy dla oficjalnych rankingów miejskich.
- **Asynchroniczne odświeżanie**: Zadanie Celery `refresh_city_rankings_mv` odświeża widoki współbieżnie (nieblokująco).

---

## 4. Rozproszona Baza Danych: Citus Sharding (`core/citus.py`)

Dla wdrożeń typu hyperscale, TimescaleDB działa wewnątrz **4-węzłowego klastra Citus**:

| Węzeł | Rola | Dane |
|:---|:---|:---|
| `db` | Koordynator | Trasowanie zapytań, metadane |
| `db-worker-1` | Worker | Shardy 0-10 |
| `db-worker-2` | Worker | Shardy 11-21 |
| `db-worker-3` | Worker | Shardy 22-31 |

**Strategia shardingu**: Dystrybucja po `user_id` → wszystkie dane danego użytkownika znajdują się na tym samym węźle (workerze). JOIN-y są **lokalne** (brak przeskoków sieciowych).

**Tabele referencyjne** (replikowane na wszystkie węzły): `users_user`, `events_event`, `clubs_club`, `rewards_voucherpool`.

---

## 5. Architektura Zadań Asynchronicznych: Celery (3 Kolejki)

| Kolejka | Workery | Przeznaczenie |
|:---|:---|:---|
| `critical` | 8 współbieżnych | Walidacja Anti-cheat, BRouter, Sync Rankingów |
| `default` | 8 współbieżnych | Scoring ML, przyznawanie nagród, odświeżanie MV |
| `notifications` | 4 współbieżnych | Czat Matrix, push, email |

Wszystkie kolejki są obsługiwane przez **Redis** (transparentnie standalone lub cluster).

---

## 6. Nagrody i Płatności (`rewards/`)

- **StripeService**: Checkout B2C, multi-seat B2B, Portal Klienta, Webhooki z walidacją podpisu.
- **RewardsService**: Rejestr punktów (append-only), atomowa realizacja voucherów przez `SELECT FOR UPDATE`.
- **Pipeline Punktowy**: Automatyczne przyznawanie po weryfikacji aktywności (10 pkt/km, idempotentne).

---

## 7. Architektura Bezpieczeństwa

- **RLS**: PostgreSQL Row Level Security na 5 tabelach (`core/rls.py`). Izolacja najemców na poziomie bazy danych.
- **Trivy CI**: Automatyczne skanowanie CVE dla backendu/admina/mobile przy każdym pushu → SARIF do GitHub Security.
- **Dependabot**: 4 ekosystemy (backend, telemetry, admin, mobile), automatyczne grupy `security-patches`.
- **Sentry**: Django + Celery + FastAPI + Mobile z hookiem `beforeSend` usuwającym dane GPS (zero PII).

---

## 8. Projektowanie Zorientowane na Domenę (DDD)

```
backend/
├── core/
│   ├── redis_cluster.py      ← Menedżer klastra Redis (auto-wykrywanie)
│   ├── citus.py              ← Menedżer shardingu Citus
│   ├── rls.py                ← PostgreSQL Row Level Security
│   ├── plugin_registry.py   ← System hooków wtyczek
│   ├── sentry.py             ← Konfiguracja obserwowalności
│   └── infra_views.py        ← Monitoring /api/infra/health/
├── activities/
│   ├── signal_processing.py  ← Silnik przetwarzania GPS
│   ├── ml_anomaly.py         ← Anti-cheat IsolationForest (Warstwa 1.5)
│   ├── analytics.py          ← Predykcje Riegela, ACWR, analiza trendów
│   ├── heatmap.py            ← API map ciepła + punkt końcowy analityki premium
│   ├── leaderboards.py       ← Usługa rankingów Redis Cluster
│   └── tasks.py              ← Asynchroniczny potok Celery
├── clubs/
│   ├── tasks.py              ← Asynchroniczne prowizjonowanie Matrix
│   └── signals.py            ← Hooki cyklu życia klubów/członkostwa
└── rewards/
    ├── models.py             ← Sponsor, VoucherPool, Voucher, PointsLedger
    ├── services.py           ← Atomowa realizacja + saldo
    └── stripe_service.py     ← Stripe B2C/B2B/Portal/Webhook
```

---

## 9. Obserwowalność i Monitoring (Prometheus i Grafana)

Proaktywny stos obserwowalności jest niezbędny do wizualizacji wewnętrznego stanu silnika biznesowego.
- **Silnik Metryk**: **Prometheus** pobierający dane z punktu końcowego FastAPI `/metrics`. Zbieranie liczników (RPS), wskaźników (aktywne połączenia), histogramów (centyle opóźnień jak P95/P99) i podsumowań.
- **Wizualizacja**: Dashboardy **Grafana** wizualizujące infrastrukturę i logikę biznesową.
  - **Mapy ciepła (Heatmaps)**: Identyfikacja "tail latency" i rozkładu wydajności segmentów.
  - **Monitorowanie zadań**: Śledzenie zużycia zasobów dla poszczególnych etapów potoku biznesowego.
  - **Geomapy**: Wykorzystanie Grafana Geomaps i Performance Co-Pilot (PCP) do mapowania metryk wydajności na fizyczne współrzędne geograficzne.

## 10. Przyszłe Optymalizacje Strategiczne

Planowane są następujące optymalizacje w celu poprawy integralności danych i wydajności przetwarzania:
- **Czyszczenie Sygnału (DBSCAN)**: Implementacja Density-Based Spatial Clustering of Applications with Noise do identyfikacji i usuwania punktów szumu z surowych danych GPS na warstwie przyjmowania.
- **Analiza Podobieństwa Trajektorii**: Wykorzystanie **odległości Frécheta** i **odległości Hausdorffa** do wykrywania duplikacji tras lub wyrafinowanych wzorców spoofingu.
- **Indeksowanie GIST**: Wszystkie kolumny przestrzenne muszą być indeksowane za pomocą GIST, aby zapewnić czasy zapytań poniżej milisekundy.
- **ST_Subdivide**: Duże poligony miast lub długie trasy są dzielone na mniejsze fragmenty (MBR), aby zmaksymalizować wydajność indeksu i skrócić czas zapytań z minut do sekund.
- **Uproszczenie Geometrii**: Użycie algorytmów takich jak **Douglas-Peucker** do przechowywania uproszczonych wersji tras.
- **Detekcja Spoofingu (Korelacja IMU)**: Analiza rozbieżności przyspieszenia między danymi GPS a fizycznymi danymi IMU (akcelerometr) w celu wykrywania ataków typu "drag-off".
