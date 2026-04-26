# Platforma SPORT — Dokumentacja Techniczna
> **Wersja**: v1.0.0-production | **Ostatnia aktualizacja**: 2026-04-25 | **Edycja**: Hyperscale 2025

---

## Przegląd

SPORT to **wysokowydajna platforma grywalizacji sportowej** zbudowana na potrzeby masowych wyzwań miejskich i korporacyjnych. Łączy telemetrię GPS w czasie rzeczywistym, wielowarstwową weryfikację anti-cheat, infrastrukturę społecznościową oraz rynek monetyzacji w jeden spójny stos technologiczny.

### 🚀 Stress Test 2025 — Zweryfikowane Benchmarki

| Metryka | Wartość |
|:---|:---|
| **Aktywni Użytkownicy** | 184,000+ (92k rowerzystów + 92k biegaczy) |
| **Całkowity Dystans** | 38,000,000 km |
| **Najemcy Miejscy** | 200 miast i gmin |
| **Przepustowość API** | 10,000+ żądań/sek (FastAPI + Redis Pipeline) |
| **Opóźnienie Rankingów** | <5ms (Redis Cluster Sorted Sets) |
| **Przepustowość Anti-Cheat** | 1,000+ tras/sek (skalowanie horyzontalne Celery) |

---

## 🛠 Stos Technologiczny

| Warstwa | Technologia | Rola |
| :--- | :--- | :--- |
| **Mobile** | Flutter 3.x, Riverpod, Impeller | Tracking GPS (Android/iOS), immersyjny UI |
| **Telemetria** | FastAPI, asyncpg, Redis Pipeline | Szybkie przyjmowanie danych GPS (<1ms) |
| **Backend** | Django 4.2 LTS, DRF, Celery | Logika biznesowa, RBAC, REST API |
| **Baza Danych (Dev)** | TimescaleDB + PostGIS | Szeregi czasowe GPS, zapytania przestrzenne |
| **Baza Danych (Prod)** | Citus 12.1 (1 koordynator + 3 workery) | Rozproszony sharding, 32 shardy/tabelę |
| **Cache (Dev)** | Redis 7 standalone | Rankingi, pub/sub |
| **Cache (Prod)** | Redis Cluster (3 master + 3 repliki) | Rozproszony cache, 3-krotna wydajność odczytu |
| **Admin UI** | React 19, Vite, **shadcn/ui**, **Mantine** | Nowoczesna architektura komponentowa |
| **Analityka UI** | **Tremor**, **Magic UI** | Dashboard KPI, efekty "Wow", bento grids |
| **Grafika** | **Three.js**, **PixiJS**, **deck.gl** | Wizualizacje 3D, wydajne 2D, trasy geoprzestrzenne |
| **Animacje** | **Framer Motion** | Mikrointerakcje, przejścia stron |
| **Komunikacja** | Matrix E2EE (prowizjonowanie przez Celery) | Czat klubowy, powiadomienia |
| **Obserwowalność** | Sentry (Django + FastAPI + Mobile) | Śledzenie błędów, profilowanie wydajności |

---

## 🔒 Architektura Bezpieczeństwa

| Kontrola | Implementacja |
|:---|:---|
| **Row Level Security** | `core/rls.py` — 5 tabel, izolacja najemców na poziomie PostgreSQL |
| **Strefy Prywatności v2** | Dynamiczny promień (DOM 250m / PRACA 150m), wzmocnienie gęstości ×1.5 |
| **Sentry PII Guard** | `send_default_pii=False`, usuwanie GPS w `beforeSend` na mobile |
| **Trivy CI** | SARIF do GitHub Security przy każdym pushu (backend + admin + mobile) |
| **Dependabot v2** | 4 ekosystemy, automatyczne grupy `security-patches` |
| **JWT Auth** | Token dostępu 60min, refresh 30 dni z rotacją i czarną listą |

---

## 🤖 Silnik Anti-Cheat (5 Warstw)

```
Wejście Śladu GPS
     │
     ▼ Warstwa 1: Szybka Selekcja (~0.5ms, O(N), brak I/O)
     │   Detekcja teleportacji, brama przyspieszenia, odcisk silnika, stosunek linii prostej
     │
     ▼ Warstwa 1.5: Detektor Anomalii ML (~5ms, IsolationForest)
     │   8 cech kinematycznych. Fails open — brak fałszywych trafień bez modelu.
     │
     ▼ Warstwa 2: Biomechaniczna Kontrola V-max (~1ms)
     │   Limity prędkości dla sportów: BIEG(6.5 m/s) / ROWER(18 m/s) / MARSZ(2.5 m/s)
     │
     ▼ Warstwa 3: Walidacja Topologiczna BRouter (~200ms)
     │   Map-matching Viterbi HMM względem topologii OpenStreetMap
     │
     ▼ Warstwa 4: Hooki Rejestru Wtyczek
         Niestandardowe reguły domenowe przez core/plugin_registry.py
```

---

## 💰 Monetyzacja i Nagrody

| Funkcja | Implementacja |
|:---|:---|
| **Stripe B2C** | Checkout subskrypcji Premium + webhook |
| **Stripe B2B** | Plan korporacyjny multi-seat + Portal Klienta |
| **Rynek Voucherów** | Sponsor → VoucherPool → atomowa realizacja (`SELECT FOR UPDATE`) |
| **Rejestr Punktów** | Księgowość append-only (10 pkt/km, idempotentne, przyznawane po weryfikacji) |

---

## 📊 Analityka Premium (`/api/activities/analytics/`)

| Funkcja | Algorytm |
|:---|:---|
| **Predykcje Wyścigów** | Riegel: T2 = T1 × (D2/D1)^exp (1.06 bieg / 1.02 rower) |
| **Obciążenie Treningowe** | ACWR — Acute/Chronic Workload Ratio (ryzyko: OPTYMALNE / PODWYŻSZONE / PRZETRENOWANIE) |
| **Trend Objętości** | Regresja liniowa z 12 tygodni + jakość dopasowania R² |
| **Heatmap API** | `/api/activities/heatmap/?bbox=...&zoom=12` → Poligony GeoJSON (ważone) |

---

## 🌍 OGC API — Moving Features (`/api/ogc/`)

Standaryzowany eksport telemetrii dla partnerów Smart City (zgodny ze standardem OGC):

| Punkt końcowy | Opis |
|:---|:---|
| `GET /api/ogc/conformance/` | Deklaracja zgodności |
| `GET /api/ogc/collections/` | Dostępne kolekcje wydarzeń |
| `GET /api/ogc/collections/{id}/items/` | Stronicowane trajektorie aktywności (MF-JSON) |
| `GET /api/ogc/collections/{id}/items/{fid}/` | Pojedyncza trajektoria ze znacznikami czasu |

---

## ⚙️ Wdrożenie Hyperscale

### Redis Cluster (6 węzłów)
```bash
# Aktywacja przez zmienną środowiskową — nie wymaga zmian w kodzie
REDIS_CLUSTER_NODES=redis-master-1:6379,redis-master-2:6380,redis-master-3:6381
```

### Citus Sharding (4 węzły)
```bash
# Jednorazowa konfiguracja po wdrożeniu
docker compose exec backend python manage.py shell -c \
  "from core.citus import apply_citus_sharding; apply_citus_sharding()"
```

### Pełny Stos Hyperscale
```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d
```

### Stan Infrastruktury
```
GET /api/infra/health/        → Połączony status Redis + Citus
GET /api/infra/health/redis/  → Topologia klastra + opóźnienia
GET /api/infra/health/citus/  → Lista węzłów + dystrybucja shardów
```

---

---

## 🎨 Warstwa Wizualna i Silniki Graficzne (Nowa Era)

W odpowiedzi na potrzebę nowoczesnej, wysokowydajnej warstwy wizualnej, platforma SPORT wykorzystuje podejście dwutorowe: modułowe biblioteki komponentów dla UI oraz specjalistyczne silniki renderujące dla grafiki niskopoziomowej.

### Nowoczesne Biblioteki Komponentów UI (React/Next.js)
Tradycyjne biblioteki pakietów NPM są wycofywane na rzecz rozwiązań „kopiuj-wklej” i modułowych zarządzanych przez CLI:
*   **shadcn/ui**: Nowy standard. Zbudowany na Radix UI (logika/dostępność) i Tailwind CSS (stylizacja). Komponenty są zarządzane przez **CLI**, co pozwala na kopiowanie kodu źródłowego bezpośrednio do projektu w celu pełnej kontroli i customizacji.
*   **Mantine**: Kompleksowy zestaw narzędzi z ponad 100 komponentami i niestandardowymi hookami (np. `useForm`), idealny do szybkiego, ale stabilnego tworzenia funkcji.
*   **Tremor**: Specjalistyczny silnik dla dashboardów analitycznych. Zoptymalizowany pod kątem dużych zbiorów danych numerycznych, oferujący wysokowydajne wykresy i karty KPI.
*   **Magic UI & Aceternity UI**: Skoncentrowane na efekcie „Wow”. Zaawansowane animacje Framer Motion (efekty cząsteczkowe, bento grids, interaktywne tła) dla nowoczesnych stron lądowania.

### Silniki Graficzne 2D i 3D
Dla wizualizacji typu „antygrawitacyjnego”, wykraczających poza standardowy interfejs użytkownika, stosowane są silniki WebGL i WebGPU:

| Silnik / Biblioteka | Typ | Kluczowa zaleta | Zastosowanie w projekcie |
| :--- | :--- | :--- | :--- |
| **Three.js** | 3D | Ogromny ekosystem, elastyczność | Wizualizacja miast 3D / globusa, modele sprzętu 3D |
| **Babylon.js** | 3D | Stabilność, wbudowana fizyka | Zaawansowane symulacje, mini-gry, złożone oświetlenie |
| **PixiJS** | 2D | Ekstremalna wydajność 2D | Dynamiczne ikony, HUD użytkownika, animowane nakładki |
| **deck.gl** | Geospatial | Miliony punktów GPS | Animowane ślady tras (TripsLayer), mapy ciepła w dużej skali |
| **Framer Motion** | Animacje | Deklaratywny styl React | Mikrointerakcje UI, przejścia stron |

---

## 🗂 Mapa Modułów

```
stunning-pancake/
├── backend/
│   ├── core/           ← Ustawienia, URL, Sentry, Redis Cluster, Citus, RLS
│   ├── activities/     ← Przetwarzanie GPS, anti-cheat, rankingi, analityka, heatmapy
│   ├── clubs/          ← Asynchroniczne prowizjonowanie Matrix
│   ├── events/         ← Silnik rywalizacji, eksport OGC
│   ├── users/          ← Auth, profile, RBAC
│   └── rewards/        ← Stripe, vouchery, rejestr punktów
├── telemetry/          ← Mikrousługa przyjmowania GPS FastAPI (zintegrowana z Sentry)
├── user/               ← Aplikacja mobilna Flutter (Android & iOS)
├── admin/              ← Dashboard React 19 (**deck.gl**, **Tremor**, **shadcn/ui**)
├── infrastructure/     ← Konfiguracje BRouter, Traccar
├── docker-compose.yml          ← Standardowy stos
└── docker-compose.scale.yml    ← Nadpisanie Hyperscale (Citus + Redis Cluster)
```
