# IMPLEMENTATION PLAN: Hyper-Performance Modernization 2025/2026

## Phase 1: Infrastructure & Data Foundation (Weeks 1-2)
*Goal: Prepare the high-throughput pipeline and local-first syncing.*

- [x] **Database Modernization**:
    - [x] Configure TimescaleDB Hypertables for the `activities_telemetry` table.
    - [x] Implement PostGIS `ST_Subdivide` on the road network graph for faster geofencing.
- [x] **PowerSync Integration**:
    - [x] Deploy PowerSync Service (Docker).
    - [x] Define sync rules between PostgreSQL and mobile SQLite.
- [x] **FastAPI Ingestion**:
    - [x] Finalize the async `/api/telemetry/ingest/stream` endpoint.
    - [x] Implement Redis pub/sub for real-time leaderboard updates.


## Phase 2: Mobile Engine Upgrade (Weeks 3-5)
*Goal: Achieve 120FPS and local-first reactivity.*

- [ ] **Framework & Core**:
    - [ ] Upgrade to React Native 0.78 (Bridgeless Mode).
    - [ ] Install and configure **Tamagui v4** (optimizing compiler).
- [ ] **Visuals & UI**:
    - [ ] Integrate **React Native Skia** for charts and gamification.
    - [ ] Implement **Mapbox SDK** with 3D Terrain and custom layers.
- [ ] **State & Sync**:
    - [ ] Refactor state management to **Legend-State** (micro-observables).
    - [ ] Integrate **PowerSync Client** for zero-latency local-first data access.

## Phase 3: Admin & Analytics Overhaul (Weeks 6-8)
*Goal: Migrate to Next.js 15 and WebGL big-data visualization.*

- [ ] **Architecture Migration**:
    - [ ] Initialize **Next.js 15 (App Router)** for the `admin/` folder.
    - [ ] Migrate component logic to **React Server Components (RSC)**.
- [ ] **UI & Data Vis**:
    - [ ] Implement **shadcn/ui** with the Obsidian design system.
    - [ ] Integrate **deck.gl** for high-density GPS track rendering (WebGL).
- [ ] **BI Layer**:
    - [ ] Deploy **Cube.js** for headless business intelligence.
    - [ ] Create Tremor-based KPI dashboards for Club Moderators.

## Phase 4: User Journey & Security Hardening (Weeks 9-10)
*Goal: Polish the onboarding and ensure absolute privacy.*

- [ ] **Auth & Onboarding**:
    - [ ] Implement **Passkeys (FIDO2)** for passwordless login.
    - [ ] Build the 3-minute TTV onboarding flow with progressive disclosure.
- [ ] **Privacy Guard**:
    - [ ] Finalize on-device **Privacy Zones v2** (masking before sync).
    - [ ] Audit Sentry PII stripping for GPS coordinates.

---

## Technical Debt & Optimization (Ongoing)
- [ ] **ML Optimization**: Refine Z-score anomaly detection logic in `ml_retrain.py`.
- [ ] **Battery Audit**: Stress test `react-native-background-geolocation` in background/pocket scenarios.
- [ ] **Legal Audit**: Verify RODO/VAT OSS compliance in the tax generation module.
