# MOBILE ARCHITECTURE: "SPORT" Platform
> Last Updated: 2026-04-24 | **Hyperscale Edition** (Post Milestone 5)

## 1. React Native Foundation (0.76+ New Architecture)

The mobile app (Android/iOS) is built on React Native 0.76 with the **New Architecture** (TurboModules + Fabric Renderer) for maximum performance.

| Component | Library | Purpose |
|:---|:---|:---|
| Framework | Expo (Config Plugins) | Managed workflow, OTA updates |
| State (Server) | TanStack Query | API caching, background refresh |
| State (UI) | Zustand | Lightweight global state |
| Storage | **MMKV** (C++ native) | GPS buffer, offline cache |
| Navigation | Expo Router | File-based routing |
| Observability | **SentryService.ts** | Error tracking (GPS-stripped) |

---

## 2. GPS Tracking Engine: `GpsSyncManager.ts` (v3)

Battery-aware, production-hardened tracking with automatic accuracy adaptation.

### Features
- **Battery Adaptation**: Switches `HIGH → MEDIUM` accuracy automatically at <20% battery.
- **Metrics Pipeline**: Real-time `elevationGainM` and `paceSecPerKm` calculated on-device.
- **Offline-first**: Points buffered in MMKV, synced in 30s batches to FastAPI.
- **Error Boundary**: `onError` callback wired to `SentryService.sentryCapture()`.

### Batch Sync Flow
```
GPS Hardware → Background Geolocation → GpsSyncManager
                                           │ every 30s (or on finish)
                                           ▼
                              POST /api/telemetry/ingest/batch
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

- **Segment Bridging**: Linear interpolation fills gaps at zone entry/exit — prevents geometric re-identification.
- **Sentry**: `beforeSend` hook strips any GPS coordinates before transmission to Sentry.

---

## 4. Observability: `SentryService.ts`

```typescript
import { initSentry, sentryCapture } from '@/services/SentryService';

// In App.tsx (before any component mounts)
initSentry();

// Automatic in GpsSyncManager._handleError():
sentryCapture(error, 'GpsSyncManager.sync');
```

- No-op if `SENTRY_DSN` is not set (local dev).
- **GPS-stripping `beforeSend`**: Breadcrumbs containing `lat=` or `GPS` are filtered before transmission.

---

## 5. Visualization: MapLibre GL

High-performance vector map engine (`@maplibre/maplibre-react-native`).

- **Glowing Tracks**: Dynamic line styling with real-time gradient updates.
- **Heatmap Layer**: Consumes `/api/activities/heatmap/?bbox=...` → renders activity density.
- **Vector Tiles**: Dark-mode optimized OSM tiles (PMTiles or CDN).
- **Live Overlays**: Pace, elevation, ACWR injury risk indicator.

---

## 6. Premium Analytics: `/api/activities/analytics/`

Available for premium users via the `analytics_summary_view` endpoint:

| Feature | Logic |
|:---|:---|
| **Trend Analysis** | Linear regression (slope + R²) over 12 weeks of volume |
| **Race Predictions** | Riegel formula: T2 = T1 × (D2/D1)^1.06 (per sport type) |
| **Training Load** | ACWR (Acute/Chronic Workload Ratio): `OPTIMAL / ELEVATED / OVERTRAINING_RISK` |
| **Race Targets** | 5K / 10K / Half-Marathon / Marathon predictions from best effort |

---

## 7. Directory Structure (Domain-Driven)

```
mobile/src/
├── app/              ← Expo Router file-based pages
├── features/
│   ├── tracking/     ← Active session UI, map view
│   ├── leaderboard/  ← City/event rankings
│   ├── social/       ← Matrix club chat
│   ├── rewards/      ← Voucher marketplace, points balance
│   └── analytics/    ← Premium charts (Riegel, ACWR, heatmap)
├── services/
│   ├── GpsSyncManager.ts  ← Battery-aware GPS engine (v3)
│   ├── SentryService.ts   ← Observability (GPS-stripped)
│   ├── MatrixClient.ts    ← E2EE club chat
│   └── ApiClient.ts       ← JWT-authenticated HTTP client
├── components/       ← Atomic UI (Atoms → Molecules → Organisms)
└── hooks/            ← Shared React hooks
```

---

## 8. Security & Privacy Checklist

| Control | Implementation | Status |
|:---|:---|:---|
| Privacy Zones v2 | Dynamic radius masking, density boost, segment bridging | ✅ |
| Mock GPS detection | Rejection of simulated GPS providers | ✅ |
| E2EE Chat | Matrix protocol, server-side room provisioning | ✅ |
| Sentry PII guard | GPS-stripping `beforeSend`, `send_default_pii=False` | ✅ |
| JWT Auth | Short-lived tokens (60min) + refresh rotation (30d) | ✅ |
