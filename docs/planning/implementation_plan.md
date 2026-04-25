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

- [x] **Framework & Core**:
    - [x] Upgrade to React Native 0.78 (Bridgeless Mode).
    - [x] Install and configure **Tamagui v4** (optimizing compiler).
- [x] **Visuals & UI**:
    - [x] Integrate **React Native Skia** for charts and gamification.
    - [x] Implement **Mapbox SDK** with 3D Terrain and custom layers.
- [x] **State & Sync**:
    - [x] Refactor state management to **Legend-State** (micro-observables).
    - [x] Integrate **PowerSync Client** for zero-latency local-first data access.


## Phase 3: Admin & Analytics Overhaul (Weeks 6-8)
*Goal: Migrate to Next.js 15 and WebGL big-data visualization.*

- [x] **Architecture Migration**:
    - [x] Initialize **Next.js 15 (App Router)** for the `admin/` folder.
    - [x] Migrate component logic to **React Server Components (RSC)**.
- [x] **UI & Data Vis**:
    - [x] Implement **shadcn/ui** with the Obsidian design system.
    - [x] Integrate **deck.gl** for high-density GPS track rendering (WebGL).
- [x] **BI Layer**:
    - [x] Deploy **Cube.js** for headless business intelligence.
    - [x] Create Tremor-based KPI dashboards for Club Moderators.


## Phase 4: User Journey & Security Hardening (Weeks 9-10)
*Goal: Polish the onboarding and ensure absolute privacy.*

- [x] **Auth & Onboarding**:
    - [x] Implement **Passkeys (FIDO2)** for passwordless login.
    - [x] Build the 3-minute TTV onboarding flow with progressive disclosure.
- [x] **Privacy Guard**:
    - [x] Finalize on-device **Privacy Zones v2** (masking before sync).
    - [x] Audit Sentry PII stripping for GPS coordinates.

## Phase 5: Advanced Operational Control & Branding (Weeks 11-12)
*Goal: Enable granular performance management and real-time branding.*

- [x] **Dynamic Performance Tuning**:
    - [x] Implement **Data Ingestion Throttling** (adjust GPS polling resolution on the fly).
    - [x] Add server-side controls for telemetry processing depth (Quality vs. Performance).
- [x] **Live Hyper-Edit Mode (Designer System)**:
    - [x] Implement `DesignerProvider` for persistent UI state management (Admin/Web).
    - [x] Integrate `@dnd-kit` for real-time dashboard layout reordering.
    - [x] Build `EditableText` system for in-flight content modification.
    - [x] **Mobile HUD Designer**: Implement long-press HUD customization with MMKV persistence.
- [x] **Adaptive Integrity**:
    - [x] Build a UI for real-time **Anti-Cheat Sensitivity** adjustment (Kinematics & ML thresholds).
    - [x] Integrate **Deck.gl** and real-time backend API polling (Axios + Tanstack Query).
- [ ] **White-Label Engine**:
    - [ ] Implement **Remote Asset Injection** for Logos, Sponsorship Overlays, and Splash Screens.
- [ ] **Outdoor HUD Optimization**:
    - [ ] Create a **High-Contrast HUD** mode for mobile (direct sunlight accessibility).


---

## Technical Debt & Optimization (Ongoing)
- [x] **ML Optimization**: Refine Z-score anomaly detection logic in `ml_retrain.py` and `ml_anomaly.py` (dynamic thresholds based on standard deviation).
- [ ] **Battery Audit**: Stress test `react-native-background-geolocation` in background/pocket scenarios.
- [x] **Legal Audit**: Verify RODO/VAT OSS compliance in the tax generation module.
