# MOBILE ARCHITECTURE: "SPORT"

## 1. React Native Foundation (0.76+)
The mobile app (Android/iOS) is built using React Native 0.76, leveraging the **New Architecture** (TurboModules, Fabric) for maximum performance and a smooth 60 FPS experience.

### Key Components
- **Framework**: Expo (Managed Workflow with Config Plugins).
- **State Management**: TanStack Query (Server State) + Zustand (Global UI State).
- **Local Persistence**: **MMKV** — high-performance key-value storage (C++ based).
- **Navigation**: Expo Router (File-based routing, native feel).
- **Styling**: NativeWind (Tailwind CSS for React Native).

## 2. Tracking Engine: Precision Telemetry
The tracking engine is designed for reliability and minimal battery drain, using native background geolocation.

### Tracking Features
- **Background Processing**: `react-native-background-geolocation` ensuring zero data loss during screen-off.
- **Haversine Core**: Real-time distance and pace calculation performed on-device using high-precision Haversine logic.
- **Jitter Filter**: Intelligent noise reduction (>2m threshold) to prevent distance accumulation while stationary.
- **Batch Telemetry**: Points are buffered in MMKV and pushed to the `/api/telemetry/ingest/batch` endpoint every 30s.

## 3. Visualization: MapLibre GL
High-performance vector map engine integrated via `@maplibre/maplibre-react-native`.

### Map Features
- **Glowing Tracks**: Dynamic line styling for active sessions with real-time gradient updates.
- **Vector Tiles**: Dark-mode optimized OSM tiles served via PMTiles or CDN.
- **Interactive Overlays**: Real-time display of pace, elevation, and heart rate zones.

## 4. Offline-First Strategy
The app treats connectivity as a luxury, not a requirement.
- **MMKV Buffering**: All GPS points are stored locally first.
- **Sync Manager**: Asynchronous background sync that retries automatically.
- **Local Metrics**: All statistics (distance, time, speed) are calculated locally.

## 5. Directory Structure (Domain-Driven)
We follow a feature-based organization in `src/`:
- `app/`: Expo Router file-based pages.
- `features/`: Domain logic (tracking, leaderboard, social, rewards).
- `services/`: Singleton managers (GpsSyncManager, MatrixClient, ApiClient).
- `components/`: Reusable Atomic UI elements (Atoms, Molecules).
- `hooks/`: Shared React hooks for telemetry and UI state.

## 6. Security and Privacy
- **Privacy Zones**: Local masking of start/finish coordinates before they leave the device.
- **Mock Detection**: Hard-rejection of activities using simulated GPS providers.
- **E2EE**: Matrix protocol integration for secure, encrypted clan chats.
