# MOBILE ARCHITECTURE: "SPORT" Platform
> Last Updated: 2026-04-24 | **Hyper-Performance Edition** (Post Milestone 5)

The mobile app (Android/iOS) is built on **React Native 0.78+** utilizing **Bridgeless Mode** and the **New Architecture** (TurboModules + Fabric Renderer) for unprecedented universal performance.

- **UI Framework**: **Tamagui (v4)** – utilizes an optimizing compiler for static style extraction, ensuring zero-runtime overhead and near-native rendering speeds.
- **Graphics Engine**: **React Native Skia** – hardware-accelerated 2D/3D graphics engine (120FPS) for fluid gamification, custom data visualizations, and high-end gradients.
- **Animation Engine**: **Reanimated 3** – executes complex animations and gesture logic purely on the UI thread via worklets.
- **State & Reactivity**: **Legend-State** – ultra-fine-grained observability to bypass standard React render lifecycle overhead for instantaneous UI updates.
- **Map Engine**: **Mapbox SDK** – hardware-accelerated 3D terrain and custom layers (The map IS the product).
- **Data Sync**: **PowerSync** – providing automatic bidirectional streaming between local SQLite and FastAPI backend for a true local-first experience.

| Component | Library | Purpose |
|:---|:---|:---|
| Framework | **Expo (Universal)** | Managed workflow, OTA updates, universal routing |
| UI Core | **Tamagui v4** | High-performance, zero-runtime design system |
| Graphics | **React Native Skia** | 120FPS custom graphics, fluid charts, gamification |
| Animation | **Reanimated 3** | Worklets & complex vector animations |
| Data Sync | **PowerSync** / SQLite | Local-first reactivity and background data streaming |
| Map | **MapLibre SDK** | Open-source vector maps, zero-cost tiles |
| State | **Legend-State** | Micro-observables for hyper-fast UI updates |
| Payments | **RevenueCat** | IAP & Subscription management |
| Observability | **SentryService.ts** | Error tracking (GPS-stripped) |

---

## 2. GPS Tracking Engine: `GpsSyncManager.ts` (v4)

Battery-aware, production-hardened tracking with automatic accuracy adaptation, powered by local-first streaming.

### Features
- **Battery Adaptation**: Switches `HIGH → MEDIUM` accuracy automatically at <20% battery.
- **Metrics Pipeline**: Real-time `elevationGainM` and `paceSecPerKm` calculated on-device.
- **Offline-first Sync**: Points are written instantly to the **PowerSync** local SQLite database.
- **Bidirectional Streaming**: Automatic background sync with FastAPI using exponential backoff.

### Sync Flow
```text
GPS Hardware → Background Geolocation → PowerSync Local DB
                                           │ automatic bidirectional streaming
                                           ▼
                              POST /api/telemetry/ingest/stream
                                           │
                                     FastAPI :8001
                                           │
                                     Redis → Celery
```

---

## 3. Privacy Architecture: Zones v2

Privacy masking is applied **on-device before any data leaves the phone**.

| Zone Type | Base Radius | Density Boost |
|:---|:---|:---|
| HOME | 250m | ×1.5 if ≥3 nearby zones |
| WORK | 150m | ×1.5 if ≥3 nearby zones |
| CUSTOM | 75m | ×1.5 if ≥3 nearby zones |

- **Segment Bridging**: Linear interpolation fills gaps at zone entry/exit.
- **Sentry**: `beforeSend` hook strips any GPS coordinates before transmission.

---

## 4. Observability: `SentryService.ts`

- No-op if `SENTRY_DSN` is not set (local dev).
- **GPS-stripping `beforeSend`**: Breadcrumbs containing `lat=` or `GPS` are filtered.

---

## 5. Visualization: MapLibre GL & Skia

High-performance vector map engine integrated with Skia graphics.

- **Glowing Tracks**: Dynamic line styling with real-time Skia gradient updates.
- **Heatmap Layer**: Consumes `/api/activities/heatmap/` → renders activity density.
- **Live Overlays**: Pace and elevation rendered natively at 120FPS via Skia.

---

## 6. Premium Analytics: `/api/activities/analytics/`

Available for premium users, visualised via **React Native Skia** interactive charts:

| Feature | Logic |
|:---|:---|
| **Trend Analysis** | Linear regression (slope + R²) over 12 weeks of volume |
| **Race Predictions** | Riegel formula: T2 = T1 × (D2/D1)^1.06 |
| **Training Load** | ACWR (Acute/Chronic Workload Ratio) |

---

## 7. Directory Structure (Domain-Driven)

```text
mobile/src/
├── app/              ← Expo Router file-based pages (Universal)
├── features/
│   ├── tracking/     ← Active session UI (Skia Canvas), map view
│   ├── leaderboard/  ← City/event rankings
│   ├── social/       ← Matrix club chat
│   ├── rewards/      ← Voucher marketplace, points balance
│   └── analytics/    ← Premium charts (Skia/Reanimated)
├── services/
│   ├── GpsSyncManager.ts  ← Battery-aware GPS engine
│   ├── PowerSyncClient.ts ← Offline-first sync manager
│   ├── SentryService.ts   ← Observability (GPS-stripped)
│   ├── DesignerService.ts ← HUD Customizer & Persistence (MMKV)
│   └── ApiClient.ts       ← JWT-authenticated HTTP client
├── components/       ← Tamagui Atomic UI (Atoms → Molecules → Organisms)
└── state/            ← Legend-State observables
```

---

## 8. Hyper-Edit: Mobile HUD Designer

The app features a "Long-Press to Edit" design system for the active session view.

### 8.1 HUD Customization Engine
- **DesignerService**: Uses `react-native-mmkv` for high-speed local persistence of UI configurations.
- **Dynamic HUD**: The `ActiveSessionScreen` renders a variable grid of metrics (Dystans, Czas, Tempo, Prędkość) based on user preference.
- **In-Flight Customization**: A modal overlay allows toggling metric visibility without stopping the active session.

---

## 9. Security & Privacy Checklist

| Control | Implementation | Status |
|:---|:---|:---|
| Privacy Zones v2 | Dynamic radius masking, density boost, segment bridging | ✅ |
| Mock GPS detection | Rejection of simulated GPS providers | ✅ |
| Passkeys (FIDO2) | Passwordless biometric login (FaceID/TouchID) | ✅ |
| OAuth 2.0 + PKCE | Secure auth flow without client secrets | ✅ |
| E2EE Chat | Matrix protocol, server-side room provisioning | ✅ |
| Sentry PII guard | GPS-stripping `beforeSend`, `send_default_pii=False` | ✅ |
| JWT Auth | Short-lived tokens (60min) + refresh rotation (30d) | ✅ |
