# Struktura Projektu SPORT (v2.0)

```
stunning-pancake/
├── .github/
│   └── workflows/
│       └── ci.yml              ← CI: Ruff + Django tests + TS + FastAPI tests
│
├── backend/                    ← Django Core (Port 8000)
│   ├── core/
│   │   ├── settings.py         ← Django config (TimescaleDB, Redis, Celery)
│   │   ├── urls.py             ← Root URL routing
│   │   ├── celery.py           ← Celery app + Beat schedule
│   │   ├── plugin_registry.py  ← PluginRegistry + Voucher Hotspot plugin [NEW]
│   │   └── matrix_provisioner.py ← Matrix E2EE room auto-provisioning [NEW]
│   │
│   ├── activities/
│   │   ├── models.py           ← Activity, PrivacyZone, POI, Voucher
│   │   ├── services.py         ← BRouterService, PrivacyService, TelemetryService
│   │   ├── signal_processing.py ← Kalman Filter + Haversine + Anomaly Detection [NEW]
│   │   ├── viterbi_matching.py  ← HMM/Viterbi Map Matching (Newson & Krumm) [NEW]
│   │   ├── signals.py          ← Post-save pipeline (Kalman → BRouter → Plugins)
│   │   ├── tasks.py            ← Celery async: process_activity, leaderboard_digest [NEW]
│   │   ├── leaderboards.py     ← Redis Sorted Sets (city/event/club scope) [UPGRADED]
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── tests.py            ← Unit tests: Kalman, Viterbi, Haversine, pipeline [NEW]
│   │
│   ├── events/
│   │   ├── models.py           ← Event, Participation, Achievement
│   │   ├── services.py         ← EventProgressService, EventNormalizationService
│   │   ├── views.py            ← REST: leaderboard, tenant-standing, OGC boundary [NEW]
│   │   ├── serializers.py      ← DRF serializers [NEW]
│   │   ├── urls.py             ← DefaultRouter [NEW]
│   │   ├── tasks.py            ← close_expired_events, publish_scheduled_events [NEW]
│   │   ├── admin.py            ← Full GIS admin for Event/Participation/Achievement [NEW]
│   │   └── tests.py            ← Unit tests: LeaderboardService, NormalizationService, Registry [NEW]
│   │
│   ├── clubs/
│   │   ├── models.py           ← Club, ClubMembership, ClubChallenge
│   │   ├── signals.py          ← Matrix auto-provisioning on Club creation [NEW]
│   │   ├── apps.py             ← ready() → loads signals [UPGRADED]
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── users/                  ← Auth, RBAC, UserProfile
│   └── pyproject.toml          ← Ruff + mypy strict + pytest config [NEW]
│
├── telemetry/                  ← FastAPI Telemetry Engine (Port 8001) [NEW]
│   ├── main.py                 ← Batch ingest, WebSocket live, TimescaleDB hypertable
│   ├── requirements.txt        ← fastapi, uvicorn, asyncpg, pydantic
│   └── Dockerfile
│
├── admin/                      ← React/Vite Admin Dashboard (Port 5173)
│   └── src/
│       └── views/
│           ├── LiveTrackingView.tsx ← WebSocket FastAPI + HTTP fallback [UPGRADED]
│           ├── EventsView.tsx
│           ├── AntiCheatView.tsx
│           ├── AnalyticsView.tsx
│           └── ClubsView.tsx
│
├── mobile/                     ← React Native Mobile App [UPGRADED]
│   ├── package.json            ← RN 0.74, MapLibre, TanStack Query, Zustand, Zod
│   └── src/
│       ├── App.tsx             ← Root navigation + QueryClientProvider [NEW]
│       ├── screens/
│       │   ├── ActiveSessionScreen.tsx ← Live GPS session with adaptive sampling [NEW]
│       │   ├── EventsScreen.tsx        ← Events list with TanStack Query [NEW]
│       │   └── LeaderboardScreen.tsx   ← Rank medals + progress bars [NEW]
│       └── services/
│           ├── GpsSyncManager.ts ← Adaptive GPS + MMKV buffer + batch upload
│           └── api.ts            ← Axios + Zod + JWT auto-refresh
│
├── docs/
│   ├── constitution.md               ← Project Constitution v2.0 (25 sections)
│   ├── sport_technical_documentation.md ← Technical docs v2.0 (all modules)
│   ├── project_structure.md          ← This file
│   └── adr/                          ← Architecture Decision Records (placeholder)
│
└── docker-compose.yml          ← TimescaleDB + FastAPI + Django + Redis + Traccar + BRouter
```

## Przepływ danych (v2)

```
Mobile GPS → [Batch 30s] → FastAPI :8001 → TimescaleDB hypertable
                                        ↓
                                   WebSocket broadcast
                                        ↓
                              Admin Dashboard (Live Map)

Activity.finish() → Django Signal → Kalman Filter → Viterbi HMM
                                                    → BRouter validate
                                                    → is_verified=True
                                                    → LeaderboardService (Redis)
                                                    → EventProgressService
                                                    → PluginRegistry.fire('activity.verified')
                                                         → Voucher Hotspot plugin
```

## Kluczowe zasady architektury

| Zasada | Implementacja |
|:---|:---|
| **Core Immutability** | Pluginy tylko przez `PluginRegistry.fire()` + Django Signals |
| **Signal Truth Layer** | Kalman → Viterbi → BRouter (3-etapowy pipeline) |
| **Async Everything** | FastAPI ingest + Celery tasks; Django API = synchronous |
| **TimescaleDB** | Hypertable `gps_points` auto-tworzone przez FastAPI startup |
| **OGC Compliance** | `/api/events/{id}/ogc/boundary/` — Moving Features standard |
