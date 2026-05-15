# 🏛️ Architektura Systemu 4VELO

Kompletny opis architektury platformy 4VELO — wysokowydajnego ekosystemu sportowego B2B/B2C.

---

## 📐 Diagram architektury (wysoki poziom)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KLIENT (Frontend)                               │
├──────────────────────┬──────────────────────┬───────────────────────────┤
│  📱 Mobile App       │  🖥️ Admin Panel      │  🌐 Public Landing        │
│  React Native + Expo │  React + Mantine     │  React + Vite             │
│  (iOS/Android)       │  (Web)               │  (Web)                    │
└──────────┬───────────┴──────────┬───────────┴─────────────┬─────────────┘
           │                      │                         │
           │ REST API             │ REST API                │ REST API
           │ WebSocket            │                         │
           ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Django + DRF)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  🔐 Authentication    │  🏃 Activities       │  👥 Users & RBAC        │
│  JWT + SimpleJWT      │  CRUD + Validation   │  Roles + Permissions    │
│                       │                      │                         │
│  🏆 Leaderboards      │  💳 Payments         │  📊 Analytics           │
│  Redis Sorted Sets    │  Stripe Integration  │  Heatmap + BI           │
│                       │                      │                         │
│  🛡️ Anti-Cheat        │  🔗 Wearables        │  🎁 Rewards             │
│  4-Layer Pipeline     │  Strava + Garmin     │  Vouchers + Points      │
└──────────┬───────────┴──────────┬───────────┴─────────────┬─────────────┘
           │                      │                         │
           ▼                      ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐
│  🐘 PostgreSQL   │  │  🔴 Redis        │  │  📡 Telemetry (FastAPI)     │
│  + PostGIS       │  │  Cache + Queue   │  │  Real-time ingestion        │
│  + TimescaleDB   │  │  Leaderboards    │  │  GPS tracking               │
│  + RLS           │  │  Sessions        │  │  WebSocket live             │
└──────────────────┘  └──────────────────┘  └─────────────────────────────┘
           │                      │                         │
           ▼                      ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐
│  🗺️ BRouter      │  │  📧 SendGrid     │  │  💳 Stripe                  │
│  Route validation│  │  Email delivery  │  │  Payments + Payouts         │
└──────────────────┘  └──────────────────┘  └─────────────────────────────┘
```

---

## 🔧 Backend — Django + DRF + PostGIS + Celery

### Technologia

| Komponent | Technologia | Wersja |
|-----------|-------------|--------|
| Framework | Django | 4.2.x |
| REST API | Django REST Framework | 3.15.x |
| GIS | PostGIS + djangorestframework-gis | 1.1.x |
| Auth | djangorestframework-simplejwt | 5.3.x |
| Social Auth | django-allauth | 65.14.x |
| Tasks | Celery + django-celery-beat | 5.4.x |
| Monitoring | Sentry SDK | 2.22.x |
| Email | SendGrid | 6.11.x |
| ML Anti-Cheat | scikit-learn + numpy | 1.5.0 / 1.26.4 |

### Struktura modułów

```
backend/
├── core/               # Konfiguracja Django, middleware, URL-e
│   ├── settings.py     # Ustawienia główne
│   ├── middleware.py   # TenantRLSMiddleware, ImpersonationAuditMiddleware
│   └── urls.py         # Główne routowanie API
├── users/              # Użytkownicy, RBAC, tenanci
│   ├── models.py       # User, Tenant, AuditLog
│   ├── rbac_models.py  # Permission, Role, RolePermission, UserRole
│   ├── rbac_views.py   # API RBAC
│   ├── permissions.py  # Klasy uprawnień DRF
│   └── serializers.py  # Serializery
├── activities/         # Aktywności, anti-cheat, wearables
│   ├── models.py       # Activity, PrivacyZone, POI, Voucher
│   ├── views.py        # Endpointy aktywności
│   ├── admin_views.py  # Endpointy admina
│   ├── services.py     # TelemetryService
│   ├── wearables.py    # StravaService, GarminService
│   ├── signal_processing.py  # Przetwarzanie sygnału GPS
│   ├── ml_anomaly.py   # ML anomaly detection
│   ├── viterbi_matching.py   # HMM Viterbi matching
│   └── tasks.py        # Zadania Celery
├── clubs/              # Kluby sportowe
├── events/             # Wydarzenia sportowe
├── rewards/            # System nagród i punktów
└── requirements.txt    # Zależności Python
```

### Middleware

| Middleware | Cel |
|------------|-----|
| [`TenantRLSMiddleware`](../backend/core/middleware.py:6) | Ustawia `app.tenant_id` w sesji PostgreSQL dla Row-Level Security |
| [`ImpersonationAuditMiddleware`](../backend/core/middleware.py:48) | Loguje akcje adminów i sesje impersonowane do `AuditLog` |

---

## 🖥️ Frontend — React + Mantine + Vite

### Technologia

| Komponent | Technologia | Wersja |
|-----------|-------------|--------|
| Framework | React | 18+ |
| UI Library | Mantine | 7+ |
| Build Tool | Vite | 5+ |
| Routing | React Router | 6+ |
| State Management | Zustand | 4+ |
| HTTP Client | Axios | 1.7.x |
| Charts | Tremor | 3+ |

### Struktura modułów

```
admin/
├── src/
│   ├── App.tsx               # Główny komponent aplikacji
│   ├── main.tsx              # Entry point
│   ├── api/
│   │   └── client.ts         # Konfiguracja Axios + interceptory
│   ├── core/
│   │   ├── Layout.tsx        # Główny layout aplikacji
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx # Ekran logowania
│   │   │   └── useAuth.ts    # Hook auth (Zustand store)
│   │   ├── guards/
│   │   │   ├── RoleGuard.tsx       # Guard na podstawie roli
│   │   │   └── PermissionGuard.tsx # Guard na podstawie uprawnień
│   │   └── components/
│   │       └── PageHeader.tsx
│   └── modules/
│       ├── dashboard/        # Dashboard + ModeratorWorklist
│       ├── users/            # Zarządzanie użytkownikami
│       ├── tenants/          # Tenants + White-Label Engine
│       ├── analytics/        # CityAnalytics, GlobalHeatmap
│       ├── anti-cheat/       # AntiCheat, AdaptiveIntegrity
│       ├── sponsor/          # SponsorDashboard
│       ├── settings/         # SettingsScreen
│       └── public/           # LandingPage
└── package.json
```

### Stan auth (Zustand)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  permissions: string[];
  login: (token, refresh, user) => Promise<void>;
  logout: () => void;
  impersonate: (token, user) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roleSlug: string) => boolean;
}
```

---

## 📱 Mobile — React Native + Expo

### Technologia

| Komponent | Technologia |
|-----------|-------------|
| Framework | React Native (Expo) |
| UI | Tamagui + Skia |
| State | Legend-State |
| Storage | MMKV |
| Maps | react-native-maps |
| GPS | expo-location |

### Kluczowe funkcje

- Map-first tracking z auto-hide HUD
- Offline-first z SQLite
- 4-warstwowy anti-cheat po stronie serwera
- Integracje z Strava i Garmin

---

## 🗄️ Schemat bazy danych

### Główne tabele

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Tenant    │       │    User     │       │  Activity   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (UUID)   │──┐    │ id (PK)     │──┐    │ id (PK)     │
│ name        │  │    │ username    │  │    │ user_id (FK)│
│ logo        │  │    │ role        │  │    │ tenant_id   │
│ primary_color│ │    │ tenant_id   │──┘    │ type        │
│ config_json │  │    │ is_premium  │       │ start_time  │
│ is_active   │  │    │ stripe_*    │       │ end_time    │
│ max_users   │  │    └─────────────┘       │ distance    │
└─────────────┘  │           │               │ route_path  │
                 │           │               │ is_verified │
                 │           ▼               └─────────────┘
                 │    ┌─────────────┐
                 │    │  UserRole   │       ┌─────────────┐
                 │    ├─────────────┤       │    POI      │
                 └─── │ id (UUID)   │       ├─────────────┤
                      │ user_id     │       │ id (PK)     │
                      │ role_id     │       │ tenant_id   │
                      │ tenant_id   │       │ name        │
                      │ expires_at  │       │ location    │
                      └─────────────┘       │ category    │
                           │                └─────────────┘
                           ▼
                    ┌─────────────┐
                    │    Role     │
                    ├─────────────┤
                    │ id (PK)     │
                    │ slug        │
                    │ name        │
                    │ is_system   │
                    └─────────────┘
```

### Relacje

| Tabela | Relacja | Opis |
|--------|---------|------|
| Tenant → User | 1:N | Tenant ma wielu użytkowników |
| User → Activity | 1:N | Użytkownik ma wiele aktywności |
| User → UserRole | 1:N | Użytkownik ma wiele przypisań ról |
| UserRole → Role | N:1 | Wiele przypisań do jednej roli |
| Tenant → POI | 1:N | Tenant ma wiele punktów POI |
| POI → Voucher | 1:N | POI ma wiele voucherów |

---

## 🔴 Serwis komunikacji — Redis + Celery

### Architektura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Django      │────▶│  Redis       │◀────│  Celery      │
│  (Producer)  │     │  (Broker)    │     │  (Worker)    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Celery Beat │
                     │  (Scheduler) │
                     └──────────────┘
```

### Kolejki Redis

| Kolejka | Opis |
|---------|------|
| `critical,notifications` | Domyślne kolejki zadań |
| `traccar:positions` | Pozycje GPS z Traccar |
| Leaderboard Sorted Sets | Rankingi miast (`leaderboard:{city_id}`) |

### Zadania Celery

| Zadanie | Opis |
|---------|------|
| `process_activity` | Przetwarzanie i weryfikacja aktywności |
| `sync_wearable_activity` | Synchronizacja aktywności z wearable |
| `retrain_ml_model` | Retrenowanie modelu ML anti-cheat |
| `send_email` | Wysyłka emaili przez SendGrid |

---

## 🛡️ Pipeline Anti-Cheat

### 4-warstwowa walidacja

```
┌─────────────────────────────────────────────────────────────┐
│                    ANTI-CHEAT PIPELINE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Fast Selection Gate (kinematyczny)               │
│  ├── Teleport check (max 500m jump)                        │
│  ├── Acceleration check (max 6.0 m/s²)                     │
│  ├── Motor fingerprint (σ/μ < 5%)                          │
│  └── Straight-line ratio (disp/track > 92%)                │
│                                                             │
│  Layer 2: V-max Kinematic Check                            │
│  ├── Anomaly ratio < 20%                                   │
│  ├── Max 3 consecutive violations                            │
│  └── Speed margin < 110%                                   │
│                                                             │
│  Layer 3: BRouter Topological Path Validation              │
│  ├── Route matches OSM network                             │
│  ├── Validates against cycling/walking paths               │
│  └── Rejects impossible routes                             │
│                                                             │
│  Layer 4: HMM Viterbi Signal Processing                    │
│  ├── Hidden Markov Model matching                          │
│  ├── Probabilistic path validation                         │
│  └── Final verification score                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Konfiguracja (zmienne środowiskowe)

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `GATE_TELEPORT_M` | 500 | Max skok GPS w metrach |
| `GATE_MAX_ACCEL` | 6.0 | Max przyspieszenie fizjologiczne |
| `GATE_MOTOR_VAR` | 0.05 | Max współczynnik zmienności silnika |
| `GATE_STRAIGHT_RATIO` | 0.92 | Min ratio prostej do trasy |
| `VMAX_ANOMALY_RATIO` | 0.20 | Max ratio anomalii |
| `VMAX_CONSECUTIVE` | 3 | Max kolejnych naruszeń |
| `VMAX_MARGIN` | 1.10 | Margines prędkości |

---

## 🔐 Row Level Security (RLS)

### Architektura izolacji tenantów

```
┌─────────────────────────────────────────────────────────────┐
│                    RLS FLOW                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Request → TenantRLSMiddleware → SET app.tenant_id = '...' │
│                                                             │
│  PostgreSQL RLS Policy:                                     │
│  CREATE POLICY tenant_isolation ON activities              │
│    USING (tenant_id = current_setting('app.tenant_id'));   │
│                                                             │
│  GLOBAL_OWNER → bypasses RLS (app.tenant_id = '')          │
│  TENANT_ADMIN → sees only own tenant data                  │
│  ATHLETE → sees only own data                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Department Hierarchy (Organizational Units)

Wspiera strukturę organizacyjną wewnątrz tenantów:

- **Firmy**: działy (IT, HR, Sprzedaż)
- **Szkoły**: klasy (4A, 4B, 5A)
- **Uczelnie**: wydziały/katedry
- **NGO**: zespoły projektowe
- **Miasta**: dzielnice/osiedla

Model: `Department` z relacją parent/children, przypisaniem do tenanta, moderatorem i typem.

---

> **Zobacz także:** [C4 Architecture Diagrams](./diagrams/architecture_c4.md)
