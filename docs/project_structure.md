# PROJECT STRUCTURE: SPORT PLATFORM (MILESTONE 2)

```text
stunning-pancake/
├── .github/
│   └── workflows/
│       └── ci.yml              ← Automated testing (Ruff, Pytest, ESLint)
│
├── backend/                    ← Django Core (Port 8000)
│   ├── core/                   ← System settings & Plugin Registry
│   ├── activities/             ← The "Signal Processing" Heart
│   │   ├── signal_processing.py ← Layer 1 & 2 Anti-Cheat logic
│   │   ├── viterbi_matching.py  ← HMM Map Matching core
│   │   └── tasks.py            ← Celery pipeline orchestration
│   ├── events/                 ← Competitions & Leaderboards
│   ├── clubs/                  ← Matrix-integrated social clubs
│   └── users/                  ← Identity & RBAC
│
├── telemetry/                  ← FastAPI Ingestion Engine (Port 8001)
│   └── main.py                 ← Redis Direct Bridge + WebSocket Live
│
├── admin/                      ← React 19 Admin Dashboard (Port 5173)
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapTrackViewer.tsx ← MapLibre track renderer
│   │   │   └── Sidebar.tsx        ← RBAC-enabled navigation
│   │   └── views/
│   │       ├── ModeratorView.tsx  ← Flagged activity review panel
│   │       └── AntiCheatView.tsx  ← System health & heuristic stats
│   └── package.json            ← Vite + TypeScript configuration
│
├── mobile/                     ← React Native Mobile App (Expo)
│   └── src/
│       ├── services/
│       │   └── GpsSyncManager.ts ← Haversine tracking & MMKV buffering
│       └── screens/
│           ├── ActiveSessionScreen.tsx ← Live session telemetry
│           └── LeaderboardScreen.tsx   ← Real-time rank visualization
│
├── docs/                       ← Engineering & Business Documentation
│   ├── constitution.md         ← Core principles & Safety Constitution
│   ├── milestone2_engine_v2.md ← Technical spec for current phase
│   └── architecture/           ← Module-specific deep dives
│
└── docker-compose.yml          ← Integrated development environment
```

## Core Architecture Principles

| Principle | Implementation |
|:---|:---|
| **Signal Truth Layer** | 3-Layer validation: Fast Gate → V-max → BRouter |
| **Telemetry Ingestion** | Traccar → Redis Pub/Sub → FastAPI → WebSocket/TimescaleDB |
| **Scalable Rankings** | Redis Sorted Sets (Live) + PostGIS Materialized Views (Official) |
| **Modularity** | `pluggy`-based sport validators & Matrix-integrated social clubs |
| **Offline-First** | MMKV-based local buffering with adaptive background sync |

## Key Directories Breakdown

### `/backend/activities`
This is where the mathematical brain of the project lives. It handles coordinate smoothing, distance calculations, and the anti-cheat heuristics.

### `/admin/src/views`
The control panels for different user roles. `ModeratorView` is the primary interface for managing system integrity in Milestone 2.

### `/mobile/src/services`
The client-side telemetry engine. Responsible for battery-aware GPS polling and real-time metric derivation.
