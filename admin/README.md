# 4VELO Admin Panel

## Overview
Professional admin panel for the 4VELO platform — built with Vite, React 19, and Mantine 9. Manages users, tenants, anti-cheat, sponsors, and branding across all instances.

## Tech Stack
- **UI**: React 19, Mantine 9, Tailwind CSS 3
- **Visuals**: deck.gl 9, PixiJS 8, Three.js 0.184, Maplibre GL 5
- **Charts**: Recharts 3, Tremor 3
- **Desktop**: Electron 41 (Windows portable `.exe`)

## Quick Start

### Dev Server
```bash
npm run dev
```

### Electron Dev (Vite + Electron)
```bash
npm run electron:dev
```

### Production Build
```bash
npm run build
```

### Windows Executable
```bash
npm run build:exe
```
Output: `dist-exe/4VELO Admin.exe`

## Access
- **Local**: `http://localhost:3000`
- **Login**: `global_owner` / `admin123`
- **API Docs**: `http://localhost:8000/api/schema/swagger-ui/`

## Features
- Multi-tenant dashboard with real-time telemetry
- Live-Ghost athlete tracking via WebSocket

### Live Map module boundaries (SSOT)

Live Map logic is split under `src/modules/analytics/` — keep new code in the matching file:

| Module | Responsibility |
|--------|----------------|
| `liveMapMarkers.ts` | Position types, activity kind, speed helpers |
| `liveMapCities.ts` | Poland sim cities, bounds |
| `liveMapZoom.ts` | Zoom LOD tiers |
| `liveMapLayers.ts` | MapLibre layers, sprites |
| `liveMapInterp.ts` | Position interpolation |
| `liveMapFilters.ts` | Activity/city filters, URL sync |
| `liveMapPrivacy.ts` | Role-based PII masking |
| `liveMapDiagnostics.ts` | Request log, cap honesty, incident bundle |
| `liveMapKeyboard.ts` | Operator keyboard shortcuts |
| `liveMapReplay.ts` | Client replay ring buffer |
| `LiveMapFiltersBar.tsx` | Filter toolbar UI |
| `LiveMapDiagnosticsDrawer.tsx` | NOC diagnostics drawer |
| `LiveMap.tsx` | Page composition only |

Do not grow `LiveMap.tsx` with marker/layer math; extend the table above.

**Zoom LOD E2E (screenshots):** `npm run test:e2e:live-map` — starts Vite with `VITE_E2E=1`, captures one PNG per tier (`e2e/live-map-zoom.spec.ts-snapshots/`). Update baselines: `npm run test:e2e:live-map:update`. Numeric crossfade audit: `node scripts/audit-live-map-lod.mjs`.
- Anti-cheat moderation panel
- City/competition management
- Sponsor reward marketplace
- White-label branding injection
