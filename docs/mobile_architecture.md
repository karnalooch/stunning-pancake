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
