# ADR 004: Persistent Storage & Offline-First (MMKV)

## Status
Accepted (2026-05-13)

## Context
A sports application requires high-performance, synchronous access to local data (user settings, offline maps, cached activities). Traditional `AsyncStorage` is too slow for frequent telemetry buffering and its asynchronous nature introduces complexity in background tasks.

## Decision
We use **MMKV** (`react-native-mmkv`) as our primary key-value storage engine.
- **Synchronous API**: Allows instant reads/writes during high-frequency telemetry events.
- **Multi-Instance**: Separate instances are used for different domains (e.g., `theme_mode`, `gps-buffer`).
- **Dev Fallback**: Since MMKV relies on JSI (JavaScript Interface), it fails in remote debugger environments (like Chrome Debugger). We implement a "Lazy MMKV" pattern with a mock object fallback in services to prevent crashes during development.

## Consequences
- **Positive**: Blazing fast data persistence (~30x faster than AsyncStorage).
- **Positive**: Reliability in background tasks (Expo Task Manager) where asynchronous bridges can be unstable.
- **Negative**: Requires careful handling of the "Runtime not ready" error during the app's initialization phase (solved by lazy initialization in `getStorage()` helpers).
