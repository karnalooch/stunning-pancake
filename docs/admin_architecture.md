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
Each directory contains the views and logic for a specific business domain:
*   `analytics/`: BI dashboards and usage statistics.
*   `anti-cheat/`: Integrity monitoring and anomaly lists.
*   `moderation/`: Interactive track review and moderation tools.
*   `social/`: Management of clubs, challenges, and events.
*   `tracking/`: Real-time map-based athlete tracking.

### 2.3 Shared (`src/shared/`)
Reusable assets across all modules:
*   `components/`: UI library (TopBar, Sidebar, MapTrackViewer).
*   `hooks/`: Shared React hooks (Auth, API fetching).
*   `types/`: Centralized TypeScript definitions.

## 3. Security & Code Splitting
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
*Status: Production Ready | Architecture Version: 2.1.0*
