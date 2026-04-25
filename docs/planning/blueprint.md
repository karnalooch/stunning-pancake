# PROJECT BLUEPRINT: "SPORT" (2025/2026 Edition)
> Unified Technical and Architectural Specification

---

## 1. Core Directives (Żelazne Zasady)
*All development MUST adhere to these paramount principles:*
1.  **Immutable Engine Core:** The backend engine is considered finished and stable. Optimization is the priority; major architectural shifts require explicit Project Owner authorization.
2.  **Absolute Legal Compliance:** Full adherence to GDPR/RODO (Privacy-by-Design) and Tax Compliance (VAT OSS/JPK).
3.  **Security & Privacy Fortress:** PCI DSS standards for payments and on-device privacy masking for GPS telemetry are non-negotiable.

---

## 2. Mission & Identity
A high-performance B2B/B2C sports telemetry platform. The ecosystem consists of:
- **Mobile App:** The athlete's companion (tracking, gamification, social).
- **Admin Panel:** The command center for moderators and corporate managers.
- **Backend Core:** The high-throughput ingestion and validation engine.

---

## 3. The User Journey (Athlete Flow)
1.  **Onboarding (3m TTV):** Fast registration via Passkeys/OAuth, progressive data collection.
2.  **The "Aha!" Moment:** First activity with 120FPS Skia visuals and 3D Mapbox terrain.
3.  **Habit Formation:** Deep analytics via Tremor, OneSignal push loops, and Matrix clan interaction.
4.  **Conversion:** Seamless Premium unlock via RevenueCat and Marketplace reward redemption.

---

## 4. Backend & Telemetry Architecture (The Finished Engine)

### 4.1 Hybrid Framework Synergy
- **Django (Auth/Admin/Logic):** Handles identities, tenant management, and complex relational workflows.
- **FastAPI (Telemetry Ingestion):** High-performance async ingestion layer for GPS streams.

### 4.2 Spatial Truth (PostGIS & TimescaleDB)
- **GIST Indexing & ST_Subdivide:** Optimized spatial queries for geofencing.
- **TimescaleDB Hypertables:** Efficient storage and aggregation of time-series GPS data.

### 4.3 3-Layer Anti-Cheat Pipeline
1.  **Fast Selection Gate (O(N)):** Kinematic filter detecting teleports and impossible acceleration.
2.  **V-max Biomechanical Check:** Validating speeds against human physical limits.
3.  **BRouter Topological Validation:** Map-matching via Viterbi HMM against OSM grid.

---

## 5. Mobile Architecture (Hyper-Performance Edition)

### 5.1 Technology Stack
- **Framework:** React Native 0.78+ (Bridgeless / New Architecture).
- **UI & Graphics:** **Tamagui v4** (Zero-runtime UI) + **React Native Skia** (120FPS graphics).
- **State & Sync:** **Legend-State** (Micro-observables) + **PowerSync** (Local-first SQLite streaming).
- **Maps:** **MapLibre SDK** (Open-source vector tiles, zero-cost architecture).

### 5.2 Edge Processing & Privacy
- **Edge Metrics:** Real-time pace/elevation calculated on-device.
- **On-Device Masking (Zones v2):** Dynamic radius masking (HOME/WORK) happens before data leaves the device.
- **Sentry Guard:** Automatic PII/GPS stripping in crash reports.

---

## 6. Admin Panel Architecture (Hyperscale Management)

### 6.1 Technology Stack
- **Framework:** **Next.js 15+ (App Router)** with React Server Components (RSC).
- **Styling & UI:** **Tailwind CSS v4** + **shadcn/ui** + **Tremor** (Analytics dashboards).
- **Visuals:** **deck.gl & MapLibre GL JS** (WebGL hardware-accelerated rendering of millions of points).

### 6.2 Key Features
- **Moderator Center:** Split-screen review with `deck.gl` track overlays.
- **Event Wizard:** Interactive geofence drawing and real-time leaderboard management.
- **BI Layer:** **Cube.js** integration for large-scale telemetry analytics.

---

## 7. Developer Onboarding: Reading Order
1.  **`docs/constitution.md`**: Understand the Iron Rules and Tech Canon.
2.  **`docs/user_journey.md`**: Grasp the intended user experience.
3.  **`docs/backend_architecture.md`**: Study the ingestion and validation flow.
4.  **`docs/mobile_architecture.md`**: Review the local-first and graphics engine.
5.  **`docs/admin_architecture.md`**: Understand the moderation and BI workflows.
