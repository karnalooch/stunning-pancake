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

-   **[Project Constitution](./docs/constitution.md)** — Mission, identity, and the "Safety Constitution".
-   **[Milestone 2: Engine V2 & Anti-Cheat](./docs/milestone2_engine_v2.md)** — Deep dive into the current implementation.
-   **[Business & Anti-Cheat Logic](./docs/business_and_anticheat.md)** — Commercialization paths and verification layers.
-   **[Developer Quick Start](./docs/developer_quickstart.md)** — Setup your environment in 5 minutes.
-   **[AI Toolkit Standards](./docs/ai_toolkit_constitution.md)** — AI Quality and Safety rules.

## 🚀 Quick Start

If you are a developer joining the project:
1. Copy `.env.example` to `.env` and configure your local environment.
2. Run `docker-compose up -d` to spin up the infrastructure (Postgres, Redis, Traccar, BRouter).
3. Follow the specific app setup in `backend/`, `admin/`, or `mobile/`.

## 🌐 i18n Strategy

The platform is **multi-language** by design. **Polish (pl_PL)** is the default locale for end-users, with English (en_US) as the primary development language.

## ⚖️ License

Built 100% on **Permissive Open Source** foundations (MIT, Apache 2.0, BSD). Designed for White-Label commercialization without copyleft (GPL) risks.
