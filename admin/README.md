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
pnpm install   # from repo root
pnpm --filter admin dev
```

### Electron Dev (Vite + Electron)
```bash
npm run electron:dev
```

### Production Build
```bash
pnpm --filter admin build
```

### Docker (Railway / local)
Build context is **repo root** (pnpm monorepo):
```bash
docker build -f admin/Dockerfile -t sport-admin .
```
Railway: `rootDirectory=/`, `dockerfilePath=admin/Dockerfile` — see `admin/railway.json`.

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

Live Map lives under `src/modules/analytics/live-map/`:

| Path | Responsibility |
|------|----------------|
| `LiveMap.tsx` | Page composition only |
| `components/*.tsx` | Toolbar, drawers, panels |
| `engine/*.ts` | Markers, LOD, layers, poll/WS, filters, privacy |
| `workers/*` | Meso cluster Web Worker |

Public export: `live-map/index.ts`. Do not grow `LiveMap.tsx` with marker/layer math; extend `engine/` or `components/`.

**Zoom LOD E2E (screenshots):** `npm run test:e2e:live-map` — starts Vite with `VITE_E2E=1`, captures one PNG per tier (`e2e/live-map-zoom.spec.ts-snapshots/`). Update baselines: `npm run test:e2e:live-map:update`. Numeric crossfade audit: `node scripts/audit-live-map-lod.mjs`.
- Anti-cheat moderation panel
- City/competition management
- Sponsor reward marketplace
- White-label branding injection
