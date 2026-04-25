# Admin Panel Technical Architecture

## 1. Technical Stack
The Management Panel is built using the **Obsidian** design system (Technical Blue / Glassmorphism) with an ultra-modern 2025/2026 enterprise stack.

- **Framework**: **Next.js 15+ (App Router)** leveraging **React Server Components (RSC)** for maximum edge-rendering performance and zero client-side waterfalls.
- **Styling**: **Tailwind CSS v4** + **shadcn/ui** — utility-first precision with beautiful, highly accessible headless UI components.
- **Analytics Visualization**: **Tremor** (dashboard metrics) + **Apache ECharts** (complex data models).
- **State Management**: **Zustand** (UI State) + **TanStack Query v5** (caching & mutations).
- **Designer System**: **@dnd-kit** for real-time layout orchestration and persistence.
- **Geospatial Engine**: **MapLibre GL JS** combined with **deck.gl**. This WebGL-powered data visualization stack allows rendering millions of GPS telemetry points and spatial anomalies at 60FPS.

## 2. Multi-App Deployment (The 3-Container Strategy)
To ensure maximum security and isolation, the SPORT administrative interface is split into three independent web applications. While they share the same codebase, they are compiled into distinct bundles at build time.

### 2.1 Application Modes (`VITE_APP_MODE`)
The deployment mode is locked via environment variables during the build process:
*   **GLOBAL_ADMIN** (Port 3001): High-level platform management. Includes tenant onboarding and global analytics.
*   **LOCAL_ADMIN** (Port 3002): B2B dashboard for club owners and city coordinators. Scoped to a specific Tenant ID.
*   **MODERATOR** (Port 3003): Operational tool for Anti-Cheat verification and track inspection.

## 3. Moderator Command Center
A high-performance interface for reviewing flagged activities.
- **Split-screen Layout**: Flagged activities list (left) + Detailed Track Map (right).
- **Interactive Map**: Renders the problematic track via `deck.gl` overlays with anomaly markers (speed violations, teleport points).
- **Action Suit**: One-click Approve, Reject, or Ban User via Server Actions.

## 4. Hyper-Edit Mode (Live Designer)
The platform features an "In-Flight" editing system that allows administrators to customize the interface without code changes.

### 4.1 Designer Engine
- **DesignerProvider**: A React context that tracks `isEditMode`, custom content mapping, and layout order.
- **DND Orchestration**: Uses `@dnd-kit` to allow reordering of dashboard widgets (KPI cards, charts) in real-time.
- **Inline Editing**: The `EditableText` component enables direct modification of headers, labels, and metrics via `contentEditable`.

### 4.2 Persistence Layer
- Layout and content changes are serialized and stored in **LocalStorage** for immediate persistence.
- (Planned) Syncing of design manifests to the backend via the **White-Label Engine**.

## 5. Modular Directory Structure
The source code under `admin/src/` follows a domain-driven modular structure:
- **`src/core/`**: Shell, routing, and theme configuration.
- **`src/providers/`**: Context providers (Auth, Designer, Query).
- **`src/shared/components/`**: Atomic UI library (EditableText, DraggableWidget, StatsCard).
- **`src/modules/`**: Business domains (analytics, anti-cheat, tracking).

## 6. Security & RBAC
The panel enforces Role-Based Access Control via Next.js middleware and secure Server Actions:
- **`GLOBAL_ADMIN`**: Full system oversight and tenant management.
- **`MODERATOR`**: Focused access to the Anti-Cheat and verification suite.
- **`TENANT_ADMIN`**: Scoped access to city/corporate data.

---
*Status: PRODUCTION READY (Hyper-Edit Enabled) | Architecture Version: 3.1.0*
