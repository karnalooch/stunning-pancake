# ARCHITEKTURA BACKENDU: Platforma "SPORT"
> Ostatnia aktualizacja: 2026-04-24 | **Edycja Hyperscale** (Post Milestone 5)

## 1. Rdzeń Telemetrii: FastAPI + Redis Pipeline
> **Synergia Architektoniczna**: Stosujemy podejście dwuramowe. **Django (DRF)** obsługuje złożoną logikę biznesową, autoryzację (Admin/Moderator) i dane relacyjne, podczas gdy **FastAPI** zapewnia wysokowydajną, asynchroniczną warstwę ingestii dla strumieni GPS.

### Przepływ Danych (Bieżący)
```
MOBILE (paczka 30s) → FastAPI :8001 → Redis Pipeline → TimescaleDB Hypertable
                                     ↓
                              Celery: process_activity
                                └─ Warstwa 1: Szybka Bramka Selekcji (matematyka O(N), brak I/O)
                                └─ Warstwa 1.5: ML Anomaly Detector (IsolationForest)
                                └─ Warstwa 2: V-max Kinematic Check (Biomechanika)
                                └─ Warstwa 3: Walidacja Topologiczna BRouter (Viterbi HMM)
                                └─ Warstwa 4: Sync Rankingów + Przyznanie Punktów
```

- **FastAPI + asyncpg**: Nieblokujące I/O, obsługuje ponad 10 tys. żądań/sek na pojedynczym węźle.
- **Redis Pipeline**: Buforuje punkty GPS w pamięci przed zapisem seryjnym (batch) do TimescaleDB.
- **TimescaleDB Hypertables**: Punkty GPS automatycznie partycjonowane po czasie — operacje odczytu i zapisu nigdy nie kolidują.

---

## 2. Wielowarstwowy Silnik Anti-Cheat (5 Warstw)

| Warstwa | Technologia | Koszt | Odrzuca |
|:---|:---|:---|:---|
| **1. Fast Gate** | Czysta matematyka Python (O(N), brak I/O) | ~0.5ms | Teleportacje, samochody, tramwaje |
| **1.5 ML Gate** | IsolationForest (8 cech kinematycznych) | ~5ms | Odchylenia statystyczne |
| **2. V-max** | Biomechaniczne sufity dla dyscyplin | ~1ms | Nierealistyczne prędkości |
| **3. BRouter** | Map-matching Viterbi HMM (OSM) | ~200ms | Oszustwa GPS poza drogami |
| **4. Plugin** | Hooki w `core/plugin_registry.py` | własny | Reguły specyficzne dla domeny |

**Kluczowe założenie**: Każda warstwa uruchamia się tylko wtedy, gdy poprzednia została zaliczona. Ponad 90% oszustw jest wykrywanych w Warstwie 1 (koszt zerowy).
- **Z-Score Anomaly**: Warstwa 1.5 wykorzystuje statystyczne Z-score (przez NumPy/Pandas) do flagowania nagłych skoków tempa niespójnych z profilem zmęczenia użytkownika.

---

## 3. Wysokowydajne Rankingi: Redis Cluster + PostGIS

### Czas rzeczywisty (Redis Cluster — Hyperscale)
- **3 węzły Master** (rozproszone 16,384 sloty hash) + 3 repliki dla failoveru.
- **Sorted Sets**: Błyskawiczne rankingi dla aktywnych wydarzeń i 200 miast jednocześnie.
- **Pipeline Batching**: Masowe `ZADD` przez `core/redis_cluster.py` — automatyczne wykrywanie trybu standalone vs cluster.
- **Repliki odczytu**: Operacje GET kierowane do replik → 3-krotnie większa przepustowość odczytu.

### Oficjalne Rankingi (PostGIS)
- **Widoki Zmaterializowane**: `city_rankings_mv` — źródło prawdy dla oficjalnych rankingów miejskich.
- **Async Refresh**: Zadanie Celery `refresh_city_rankings_mv` odświeża widoki współbieżnie (nieblokująco).

---

## 4. Rozproszona Baza Danych: Citus Sharding (`core/citus.py`)

Dla wdrożeń hyperscale, TimescaleDB działa wewnątrz **4-węzłowego klastra Citus**:

| Węzeł | Rola | Dane |
|:---|:---|:---|
| `db` | Koordynator | Routing zapytań, metadane |
| `db-worker-1` | Worker | Shardy 0-10 |
| `db-worker-2` | Worker | Shardy 11-21 |
| `db-worker-3` | Worker | Shardy 22-31 |

**Strategia shardingu**: Rozproszenie po `user_id` → wszystkie dane danego użytkownika znajdują się na tym samym workerze. Joiny są **lokalne** (brak skoków sieciowych).

**Tabele referencyjne** (replikowane na wszystkich workerów): `users_user`, `events_event`, `clubs_club`, `rewards_voucherpool`.

---

## 5. Architektura Zadań Asynchronicznych: Celery (3 Kolejki)

| Kolejka | Workerzy | Cel |
|:---|:---|:---|
| `critical` | 8 współbieżnych | Walidacja Anti-cheat, BRouter, Sync Rankingów |
| `default` | 8 współbieżnych | ML scoring, przyznawanie nagród, odświeżanie MV |
| `notifications` | 4 współbieżnych | Matrix chat, push, email |

Wszystkie kolejki są obsługiwane przez **Redis** (automatyczna obsługa standalone lub cluster).

---

## 6. Nagrody i Płatności (`rewards/`)

- **StripeService**: Checkout B2C, B2B multi-seat, Portal Klienta, Webhooki z walidacją sygnatury.
- **RewardsService**: Księga punktów (append-only), atomowa realizacja voucherów przez `SELECT FOR UPDATE`.
- **Points Pipeline**: Automatyczne przyznawanie punktów po weryfikacji aktywności (10 pkt/km, idempotentność).

---

## 7. Architektura Bezpieczeństwa

- **RLS**: PostgreSQL Row Level Security na 5 tabelach (`core/rls.py`). Izolacja najemców na poziomie DB.
- **Trivy CI**: Automatyczne skanowanie CVE dla backendu/admina/mobile przy każdym pushu → raporty SARIF do GitHub Security.
- **Dependabot**: 4 ekosystemy (backend, telemetry, admin, mobile), automatyczne grupy `security-patches`.
- **Sentry**: Django + Celery + FastAPI + Mobile z hookiem `beforeSend` usuwającym dane GPS (zero PII).

---

## 8. Projektowanie Sterowane Domeną (Domain-Driven Design)

```
backend/
├── core/
│   ├── redis_cluster.py      ← Manager Redis Cluster (auto-detekcja)
│   ├── citus.py              ← Manager shardingu Citus
│   ├── rls.py                ← PostgreSQL Row Level Security
│   ├── plugin_registry.py   ← System hooków wtyczek
│   ├── sentry.py             ← Konfiguracja obserwowalności
│   └── infra_views.py        ← Monitoring /api/infra/health/
├── activities/
│   ├── signal_processing.py  ← Silnik przetwarzania GPS
│   ├── ml_anomaly.py         ← Anti-cheat IsolationForest (Warstwa 1.5)
│   ├── analytics.py          ← Predykcje Riegla, ACWR, analiza trendów
│   ├── heatmap.py            ← Heatmap API + analityka premium
│   ├── leaderboards.py       ← Serwis rankingów Redis Cluster
│   └── tasks.py              ← Asynchroniczny potok Celery
├── clubs/
│   ├── tasks.py              ← Asynchroniczne prowizjonowanie Matrix
│   └── signals.py            ← Hooki cyklu życia klubu/członkostwa
└── rewards/
    ├── models.py             ← Sponsor, VoucherPool, Voucher, PointsLedger
    ├── services.py           ← Atomowa realizacja + saldo
    └── stripe_service.py     ← Integracja Stripe B2C/B2B
```

---

## 9. Obserwowalność i Monitoring (Prometheus & Grafana)

Proaktywny stos obserwowalności jest niezbędny do wizualizacji stanu wewnętrznego silnika biznesowego.
- **Silnik Metryk**: **Prometheus** zbierający dane z punktu końcowego FastAPI `/metrics`. Zbieranie liczników (RPS), mierników (aktywne połączenia), histogramów (latencja P95/P99).
- **Wizualizacja**: Dashboardy **Grafana** wizualizujące infrastrukturę i logikę biznesową.
  - **Heatmapy**: Identyfikacja "latencji ogona" (tail latency).
  - **Monitoring zadań**: Śledzenie zużycia zasobów na poszczególnych etapach potoku biznesowego.

---

## 10. Przyszłe Optymalizacje Strategiczne

Planowane wdrożenia w celu zwiększenia integralności danych i wydajności przetwarzania:
- **Signal Cleaning (DBSCAN)**: Implementacja klastrowania przestrzennego w celu identyfikacji i usuwania szumów z surowych danych GPS na etapie ingestii.
- **Analiza Podobieństwa Trajektorii**: Wykorzystanie dystansu **Frécheta** i **Hausdorffa** do wykrywania duplikacji tras lub zaawansowanego spoofingu.
- **GIST Indexing**: Wszystkie kolumny przestrzenne muszą być indeksowane przy użyciu GIST, aby zapewnić czasy zapytań poniżej milisekundy.
- **Geometry Simplification**: Wykorzystanie algorytmu **Douglasa-Peuckera** do przechowywania uproszczonych wersji tras.
- **Wykrywanie Spoofingu (Korelacja IMU)**: Analiza rozbieżności przyspieszenia między danymi GPS a fizycznymi danymi z akcelerometru (IMU) urządzenia.
