# MOBILE ARCHITECTURE: "SPORT"

## 1. Flutter Foundation (BSD-3)
The mobile app (Android/iOS) is built using Flutter, ensuring UI consistency with native performance.

### Key Components
- **State Management**: Bloc or Riverpod (ensuring predictable data flow).
- **Local Persistence**: SQLite (drift/sqflite) as the "Local Source of Truth".
- **Navigation**: GoRouter (declarative routing).

## 2. Tracking and Telemetry (ISC)
Based on OpenTracks logic, optimized for reliability and low energy consumption.

### Tracking Features
- **Background Service**: Ensuring the session is not interrupted when the app is in the background.
- **Batching**: Points are collected locally and sent to the server in batches (e.g., every 30s) or after reconnecting to the network.
- **Privacy Zones**: Local coordinate masking before sending to the server (Privacy-by-Design).

## 3. Visualization: MapLibre GL (BSD-2/MIT)
High-performance vector map engine.

### Map Features
- **Offline Maps**: Support for `.mbtiles` packages for training in areas without coverage.
- **Custom Styling**: Dark-mode optimized vector tiles with glowing activity tracks.
- **Real-time Overlays**: Displaying current pace, elevation profile, and heart rate zones directly on the map.

## 4. Offline-First Strategy
The application must be fully functional without an internet connection during a session.
- **Local Validation**: Basic heuristic checks (e.g., maximum speed) performed locally.
- **Sync Manager**: Robust synchronization mechanism with conflict resolution.

## 5. Extensibility: Modular Feature Architecture
To ensure the app can scale to millions of users and dozens of features, we follow a **Feature-First** approach:

### 5.1 Directory Structure (Feature-Based)
Instead of layering by type (views/models), we layer by domain:
- `features/telemetry`: Core tracking and GPS logic.
- `features/events`: Competitions, leaderboards, and geofence alerts.
- `features/social`: Matrix chat integration and club management.
- `features/rewards`: Voucher wallet and sponsor POI integration.

### 5.2 Dependency Injection (DI)
- Use of **get_it** or **Riverpod providers** to decouple interface from implementation.
- Allows for easy swapping of the Tracking Engine (e.g., from GPS-only to BLE-sensor integrated) without affecting the UI.

### 5.3 Dynamic UI (Server-Driven Elements)
- Certain UI elements (e.g., Event Banners, Reward Popups) are driven by a backend JSON schema, allowing for real-time app updates without App Store releases.
- Support for **White-Labeling**: Dynamic theme injection (colors, logos) based on the active `tenant_id`.
