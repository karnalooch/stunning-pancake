# SPORT Owner OS — Admin Panel

## Overview
The Owner Command Center (SPORT Owner OS) — a sovereign, cross-platform admin panel built with Vite + Electron for complete platform control.

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
Output: `dist-exe/SPORT Owner OS.exe`

## Access
- **Local**: `http://localhost:3000`
- **Login**: `global_owner` / `admin123`
- **API Docs**: `http://localhost:8000/api/schema/swagger-ui/`

## Features
- Multi-tenant dashboard with real-time telemetry
- Live-Ghost athlete tracking via WebSocket
- Anti-cheat moderation panel
- City/competition management
- Sponsor reward marketplace
- White-label branding injection
