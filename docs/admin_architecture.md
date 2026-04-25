# ADMIN PANEL ARCHITECTURE: "SPORT"

## 1. Technical Stack
The Management Panel is built using the **Obsidian** design system (Technical Blue / Glassmorphism) with an ultra-modern 2025/2026 enterprise stack.

- **Framework**: **Next.js 15+ (App Router)** leveraging **React Server Components (RSC)** for maximum edge-rendering performance and zero client-side waterfalls.
- **Styling**: **Tailwind CSS v4** + **shadcn/ui** — utility-first precision with beautiful, highly accessible headless UI components.
- **Analytics Visualization**: **Tremor** (dashboard metrics) + **Apache ECharts** (complex data models).
- **State Management**: **Zustand** (UI State) + **TanStack Query v5** (caching & mutations).
- **Data Grids**: **TanStack Table v8** (headless) for dense data management with server-side sorting/filtering powered by RSC.
- **Geospatial Engine**: **MapLibre GL JS** combined with **deck.gl**. This WebGL-powered data visualization stack allows rendering millions of GPS telemetry points and spatial anomalies at 60FPS.

## 2. Core Modules (Milestone 2)

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
