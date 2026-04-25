# Admin Panel Technical Architecture

## 1. Multi-App Deployment (The 3-Container Strategy)
To ensure maximum security and isolation, the SPORT administrative interface is split into three independent web applications. While they share the same codebase, they are compiled into distinct bundles at build time.

### 1.1 Application Modes (`VITE_APP_MODE`)
The deployment mode is locked via environment variables during the build process:

*   **GLOBAL_ADMIN** (Port 3001): High-level platform management. Includes tenant onboarding and global analytics.
*   **LOCAL_ADMIN** (Port 3002): B2B dashboard for club owners and city coordinators. Scoped to a specific Tenant ID.
*   **MODERATOR** (Port 3003): Operational tool for Anti-Cheat verification and track inspection.

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
