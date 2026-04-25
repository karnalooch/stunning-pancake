# 🏆 SPORT — High-Performance Sports Platform

A modern, high-precision B2B/B2C sports platform designed for city-wide competitions, corporate wellness, and elite telemetry analysis. Built with a "Power Couple" architecture (Django + FastAPI) and a professional anti-cheat engine.

## 🌟 Key Features (Milestone 2: Engine V2)

-   **3-Layer Anti-Cheat**: Kinematic "Fast Selection Gate" (O(N) pre-filter) + V-max Biomechanical Checks + BRouter Topological Validation.
-   **High-Precision Telemetry**: Kalman-filtered GPS tracks with Haversine distance calculations and Viterbi HMM Map Matching.
-   **Moderator Command Center**: Real-time track visualization via MapLibre GL, automated flagging, and one-click activity review.
-   **City-Scale Rankings**: Instantaneous leaderboard updates using Redis Sorted Sets and PostGIS Materialized Views.
-   **Offline-First Mobile Tracking**: Low-latency, battery-optimized recording with background sync.

## 🛠 Tech Canon (Permissive Stack)

-   **Backend**: Python 3.12 (Django 4.2 LTS / FastAPI)
-   **Mobile**: React Native 0.76 (TypeScript)
-   **Admin Panel**: React 19 + Vite + TypeScript
-   **Databases**: PostgreSQL + PostGIS + TimescaleDB + Redis
-   **Telemetry Core**: Traccar (Apache 2.0)
-   **Map Engine**: MapLibre GL + BRouter (MIT)
-   **Communication**: Matrix Protocol (Apache 2.0)

## 📂 Documentation

-   **[Project Constitution](./docs/guides/constitution.md)** — Mission, identity, and the "Safety Constitution".
-   **[Implementation Plan: User Management & Architecture](./docs/planning/implementation_plan_user_management.md)** — Step-by-step plan to align the codebase with the new RBAC/RLS architecture.
-   **[Milestone 2: Engine V2 & Anti-Cheat](./docs/planning/milestone2_engine_v2.md)** — Deep dive into the current implementation.
-   **[Architectural Whitepaper (The Canon)](./docs/architecture/sport_architecture_whitepaper.md)** — Core strategies: PostGIS, TimescaleDB, BRouter, Android Doze, RLS.
-   **[Business & Anti-Cheat Logic](./docs/architecture/business_and_anticheat.md)** — Commercialization paths and verification layers.
-   **[Developer Quick Start](./docs/guides/developer_quickstart.md)** — Setup your environment in 5 minutes.
-   **[User Management V2 (RBAC/RLS)](./docs/architecture/user_management_redesign.md)** — Architecture for identity, roles, and Multi-Tenant logic.
-   **[AI Toolkit Standards](./docs/guides/ai_toolkit_constitution.md)** — AI Quality and Safety rules.

## 🛠 Testing & Simulation

The platform includes two simulation layers:
1. **Headless Simulator**: `infrastructure/simulators/multi_athlete_sim.py` — High-scale background simulation (10+ athletes on real OSM paths).
2. **Admin UI Plugin (New)**: A floating "User Simulator" widget in the Admin Dashboard.
   - **Start/Stop**: Simulate a single mobile device session.
   - **Anomalies**: Instantly trigger "Warp Speed" or "Teleport" to test Anti-Cheat detection logic.
   - **Types**: Toggle between Runner and Cyclist to verify UI color coding and analytics.

To use the UI Simulator:
1. Open Admin Dashboard (`localhost:3000`).
2. Click the **📱 Sim** button in the bottom-right corner.
3. Select an athlete profile and hit **START SESSION**.

## 🚀 Quick Start

If you are a developer joining the project:
1. Copy `.env.example` to `.env` and configure your local environment.
2. Run `docker-compose up -d` to spin up the infrastructure (Postgres, Redis, Traccar, BRouter).
3. Follow the specific app setup in `backend/`, `admin/`, or `mobile/`.

## 🌐 i18n Strategy

The platform is **multi-language** by design. **Polish (pl_PL)** is the default locale for end-users, with English (en_US) as the primary development language.

## ⚖️ License

Built 100% on **Permissive Open Source** foundations (MIT, Apache 2.0, BSD). Designed for White-Label commercialization without copyleft (GPL) risks.
