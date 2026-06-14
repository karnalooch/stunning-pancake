# Ride Feature Contract

## Responsibilities

- Active ride lifecycle: start, pause, resume, stop, summary handoff.
- HUD rendering: status bar, data grid, action bar, map and edge banners.
- Turn-by-turn stage-1 primitives: route polyline + navigation hint banner.
- Voice cues and reduced-motion compatibility for eyes-free mode.
- Recovery integration with GPS durability services.

## Integration points

- `app/useRideLifecycle.ts`
- `screens/ActiveRideHUDScreen.tsx`
- `components/RideMapView.tsx`
- `components/ride/*`
- `services/GpsSyncManager.ts`
- `services/gpsSyncUpload.ts`
