# IMPLEMENTATION PLAN: Global Admin Panel Modernization

This document outlines the strategic steps to transition the current Global Admin from a placeholder to a production-ready management suite for the SPORT platform.

## 🏛 Phase 0: Foundation (COMPLETED)
- [x] **Vite 8 + React 19** migration.
- [x] **Tailwind CSS v4** integration with `@tailwindcss/vite`.
- [x] **Cyber-Monolith V3.0 Design System**: Windows 11 Fluent/Glassmorphism.
- [x] **Multi-Mode Engine**: Support for `GLOBAL_ADMIN`, `LOCAL_ADMIN`, and `MODERATOR`.

## 🛠 Phase 1: Shell & Core Navigation (Week 1)
*Goal: Build the "OS-like" desktop interface.*

1.  **AppShell Implementation**:
    - Build a persistent **Windows-style Taskbar** at the bottom for quick app switching.
    - Implement a **Glassmorphic Sidebar** for primary navigation categories (Platform, Tenants, Users, System).
2.  **Role-Based Routing**:
    - Configure `react-router-dom` to guard routes based on `VITE_APP_MODE`.
    - Ensure `GLOBAL_ADMIN` can see the "Tenant Creation" and "System Audits" views.
3.  **DesignerProvider Core**:
    - Implement the `DesignerProvider` to manage "Hyper-Edit Mode" state.

## 📊 Phase 2: Global Management Hub (Week 2)
*Goal: Surface platform-wide KPIs and health.*

1.  **Tremor Dashboard**:
    - Integrate **Tremor** for high-density KPIs: Revenue, MAU, Total Distance Tracked.
    - Build a "System Pulse" widget showing real-time load on Redis and TimescaleDB.
2.  **Deck.gl Integration**:
    - Implement a **Global Activity Map**: Visualize high-density point clouds of recent sports activities across the globe.
    - Add "Hotspot" detection for popular city routes.

## 🏢 Phase 3: Tenant & User Management (Week 3)
*Goal: Operational control over white-label instances.*

1.  **Tenant CRUD**:
    - Create an advanced data table (using Mantine) for Tenant management.
    - Implement a **Tenant Onboarding Wizard**: Configure Postgres schema, S3 buckets, and custom branding tokens for new cities/clients.
2.  **User Audit Suite**:
    - Build a global user search with deep-dive telemetry history.
    - Implement "Impersonation Mode" for debugging specific user issues (safe/audited).

## 🎨 Phase 4: Hyper-Edit System (Week 4)
*Goal: Enable no-code branding and layout adjustments.*

1.  **Designer Toolkit**:
    - Build the `EditableText` component for on-the-fly copy changes.
    - Integrate `@dnd-kit` to allow Global Admins to reorder dashboard widgets.
2.  **Style Injection**:
    - Implement a **Branding Editor**: Adjust primary colors, border radii, and background glassmorphism levels.
    - Save these tokens to the backend `branding` table for dynamic client-side injection.

## 🔒 Phase 5: Security & Observability (Ongoing)
*Goal: Ensure platform integrity.*

1.  **Audit Logs View**:
    - A dedicated log explorer for tracking every administrative action.
2.  **Anti-Cheat Control**:
    - Global toggle for Anti-Cheat sensitivity across all tenants.
    - "God Mode" view for real-time biomechanical analysis of suspicious tracks.

---
**Technical Stack:**
- **UI**: Mantine v7 + Tailwind 4.
- **Charts**: Tremor + ECharts.
- **Maps**: MapLibre GL + deck.gl.
- **State**: Zustand + TanStack Query.
