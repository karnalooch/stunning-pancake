# ADR 004: Persistent Storage & Offline-First (MMKV)

## Status
Accepted (2026-05-13)

## Context
A sports application requires high-performance, synchronous access to local data (user settings, offline maps, cached activities). Traditional `AsyncStorage` is too slow for frequent telemetry buffering and its asynchronous nature introduces complexity in background tasks.

## Decision
We use **MMKV** (`react-native-mmkv`) as our primary key-value storage engine.

### Implementation: The "Lazy Storage" Pattern
To avoid "JSI Runtime not ready" crashes—particularly during the Android background task initialization or when the app is launched via a deep link—we implement a lazy accessor pattern in all services.

```typescript
let _storage: MMKV | null = null;
function getStorage() {
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'app-buffer' });
    } catch (e) {
      // Fallback for Remote Debugging (non-JSI environment)
      return { set: () => {}, getString: () => null, ...mockStorage };
    }
  }
  return _storage;
}
```

### Strategic Usage
- **Telemetry Buffering**: GpsSyncManager appends points to a `gps_buffer` string in MMKV. This ensures no data is lost if the app process is killed between network batches.
- **Background Safety**: By using MMKV in `expo-task-manager` callbacks, we achieve thread-safe persistence that is significantly more reliable than `AsyncStorage` or `SQLite` in low-memory background states.

## Consequences
- **Positive**: Blazing fast data persistence (~30x faster than AsyncStorage).
- **Positive**: Reliability in background tasks (Expo Task Manager).
- **Negative**: Development Friction. Since MMKV is a C++ JSI module, it cannot be used with the "Remote Debugger" (Chrome). Developers must use "Flipper" or "React Native Debugger" with New Architecture / JSI support enabled, or rely on console logs from the device.
