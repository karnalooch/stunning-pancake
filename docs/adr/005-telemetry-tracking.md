# ADR 005: Telemetry & Background Tracking

## Status
Accepted (2026-05-13)

## Context
The core value of the SPORT app is accurate ride/run tracking. This data must be collected even when the screen is off or the app is in the background. We previously used `react-native-background-geolocation` (TransistorSoft) but found it too heavy for our custom telemetry needs.

## Decision
We migrated to **Expo Location + Expo Task Manager** for background tracking.
- **Background Task**: A named task (`BACKGROUND_LOCATION_TASK`) handles incoming GPS coordinates.
- **Buffering Strategy**: Coordinates are buffered in MMKV (`gps_buffer`) and uploaded in batches every 30 seconds to the telemetry endpoint to save battery.
- **Dynamic Resolution**: We support multiple "Polling Resolutions" (HYPERSCALE, BALANCED, POWER_SAVE) to allow users to trade accuracy for battery life.

## Consequences
- **Positive**: Reduced app bundle size and less complex native dependency management.
- **Positive**: Full control over the ingestion pipeline and batching logic.
- **Requirement**: Users must grant "Always Allow" location permissions for the background task to function reliably.
