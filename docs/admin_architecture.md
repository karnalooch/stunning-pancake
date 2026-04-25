# Admin Panel Technical Architecture

<<<<<<< HEAD
## 1. Technical Stack
The Management Panel is built using the **Obsidian** design system (Technical Blue / Glassmorphism) with an ultra-modern 2025/2026 enterprise stack.

- **Framework**: **Next.js 15+ (App Router)** leveraging **React Server Components (RSC)** for maximum edge-rendering performance and zero client-side waterfalls.
- **Styling**: **Tailwind CSS v4** + **shadcn/ui** — utility-first precision with beautiful, highly accessible headless UI components.
- **Analytics Visualization**: **Tremor** (dashboard metrics) + **Apache ECharts** (complex data models).
- **State Management**: **Zustand** (UI State) + **TanStack Query v5** (caching & mutations).
- **Data Grids**: **TanStack Table v8** (headless) for dense data management with server-side sorting/filtering powered by RSC.
- **Geospatial Engine**: **MapLibre GL JS** combined with **deck.gl**. This WebGL-powered data visualization stack allows rendering millions of GPS telemetry points and spatial anomalies at 60FPS.
=======
## 1. Multi-App Deployment (The 3-Container Strategy)
To ensure maximum security and isolation, the SPORT administrative interface is split into three independent web applications. While they share the same codebase, they are compiled into distinct bundles at build time.

### 1.1 Application Modes (`VITE_APP_MODE`)
The deployment mode is locked via environment variables during the build process:
>>>>>>> c7d817851a47bb37febdcfabab1e3005c2ea977c

*   **GLOBAL_ADMIN** (Port 3001): High-level platform management. Includes tenant onboarding and global analytics.
*   **LOCAL_ADMIN** (Port 3002): B2B dashboard for club owners and city coordinators. Scoped to a specific Tenant ID.
*   **MODERATOR** (Port 3003): Operational tool for Anti-Cheat verification and track inspection.

<<<<<<< HEAD
### 2.1 Moderator Command Center
A high-performance interface for reviewing flagged activities.
- **Split-screen Layout**: Flagged activities list (left) + Detailed Track Map (right).
- **Interactive Map**: Renders the problematic track via `deck.gl` overlays with anomaly markers (speed violations, teleport points).
- **Action Suit**: One-click Approve, Reject, or Ban User via Server Actions.

### 2.2 Event Management
Tools for creating and monitoring municipal/corporate competitions.
- **Geofence Editor**: Interactive polygon drawing tool to define event boundaries.
- **Live Leaderboard**: Real-time ranking visualization via WebSocket/Redis pub-sub, rendered with Tremor dynamic charts.

### 2.3 System Analytics & Observability
- **Cube.js Integration**: Headless BI for massive-scale tenant telemetry analytics.
- **Prometheus/Grafana Integration**: Dashboards visualizing RPS, error rates, and business engine health.

## 3. Component Architecture (Atomic Design)
Components are organized in `src/components/`:
- **Layout/**: `Sidebar`, `AppContainer`, `Navigation`.
- **Maps/**: `DeckGlTrackViewer` (WebGL renderer), `LiveHeatmap`.
- **UI/**: Core **shadcn/ui** primitives (Buttons, Dialogs, Select).
- **Analytics/**: **Tremor** `StatCard`, `AreaChart`, `StatusBadge`.

## 4. Visualization Engine: deck.gl & MapLibre
- **deck.gl**: Primary layer for big-data visualization (WebGL hardware-accelerated).
- **MapLibre GL JS**: Provides high-fidelity basemaps and vector tiles.

## 5. State Management Strategy
- **React Server Components**: Fetches initial data securely on the server.
- **Query Keys**: Standardized keys for activity management (e.g., `['activities', 'flagged']`).
- **Map Context**: A global Zustand store manages the MapLibre/deck.gl instances.

## 6. Security and RBAC
The panel enforces Role-Based Access Control via Next.js middleware and secure Server Actions:
- **`GLOBAL_ADMIN`**: Full system oversight and tenant management.
- **`MODERATOR`**: Focused access to the Anti-Cheat and verification suite.
- **`TENANT_ADMIN`**: View-only or restricted access to specific city/corporate data.
=======
## 2. Modular Directory Structure
The source code under `admin/src/` follows a domain-driven modular structure to ensure scalability and maintainability:

### 2.1 Core (`src/core/`)
Contains the application shell, global routing logic, and centralized theme configuration.

### 2.2 Modules (`src/modules/`)
Each directory contains the views and logic for a specific business domain, now being refactored for the **New Era Visual Stack**:
*   `analytics/`: BI dashboards and usage statistics powered by **Tremor**.
*   `anti-cheat/`: Integrity monitoring with real-time **PixiJS** overlays.
*   `security/`: Real-time RLS audit and tenant isolation monitoring using **Tremor**.
*   `moderation/`: Interactive track review using **deck.gl** and **shadcn/ui**.
*   `social/`: Management of clubs, challenges, and events with **Mantine** forms.
*   `tracking/`: Real-time map-based athlete tracking with **deck.gl** "comet" trails.
*   `health/`: Biometric data studio with **Three.js** visualizations of wearable metrics.

### 2.3 Shared (`src/shared/`)
Reusable assets across all modules:
*   `components/`: UI library based on **shadcn/ui** and **Mantine** (TopBar, Sidebar, MapTrackViewer).
*   `hooks/`: Shared React hooks (Auth, API fetching, `useForm` from Mantine).
*   `types/`: Centralized TypeScript definitions.

## 3. Visual & Graphics Stack
The Admin interface uses a cutting-edge visual stack to ensure a premium user experience and high-performance data visualization.

### 3.1 Component Architecture
*   **shadcn/ui**: Core components (buttons, inputs, dialogs) are integrated directly into the `src/shared/components/` directory using the **shadcn-ui CLI** for granular control over the source code.
*   **Tremor**: Powering the `analytics/` module for high-density data dashboards and KPI cards.
*   **Framer Motion**: Standard for all micro-animations and smooth state transitions.

### 3.2 High-Performance Rendering
*   **deck.gl**: Used in the `tracking/` and `moderation/` modules for rendering millions of GPS points and animated "comet" trails.
*   **Three.js / R3F**: Utilized for 3D visualizations of cities and sport equipment in specialized views.
*   **MapLibre GL**: Base map engine, integrated with custom WebGL layers from deck.gl for geospatial visualization.

## 4. Security & Code Splitting
By using build-time flags, Vite performs **tree-shaking** to physically remove code associated with other modes. For instance, the Moderator's bundle does not contain the logic for financial transactions or tenant configuration, reducing the attack surface.

## 4. Development Workflow
To run a specific app mode locally:
```bash
VITE_APP_MODE=MODERATOR npm run dev
```

To build all apps via Docker/Podman:
```bash
podman-compose up -d --build
```

---
*Status: PRODUCTION READY (New Era Vision Complete) | Architecture Version: 3.0.0*
>>>>>>> c7d817851a47bb37febdcfabab1e3005c2ea977c
