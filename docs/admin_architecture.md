# ADMIN PANEL ARCHITECTURE: "SPORT"

## 1. Technical Stack
The Management Panel is built using the **Obsidian** design system (Technical Blue / Glassmorphism) with a modern React stack.

- **Framework**: React 19 + Vite.
- **Language**: TypeScript (Strict mode).
- **Styling**: Vanilla CSS (CSS Variables) for maximum flexibility and performance.
- **State Management**: TanStack Query (Server State) + React Context (UI State).
- **Visualization**: MapLibre GL JS for high-performance track and geofence rendering.

## 2. Core Modules (Milestone 2)

### 2.1 Moderator Command Center
A high-performance interface for reviewing flagged activities.
- **Split-screen Layout**: Flagged activities list (left) + Detailed Track Map (right).
- **Interactive Map**: Renders the problematic track with anomaly markers (speed violations, teleport points).
- **Action Suit**: One-click Approve, Reject, or Ban User directly from the context.

### 2.2 Event Management
Tools for creating and monitoring municipal/corporate competitions.
- **Geofence Editor**: Interactive polygon drawing tool to define event boundaries.
- **Live Leaderboard**: Real-time ranking visualization via WebSocket/Redis pub-sub.

### 2.3 System Analytics
Materialized view visualization for city-scale performance metrics.

## 3. Component Architecture (Atomic Design)
Components are organized in `src/components/`:
- **Layout/**: `Sidebar`, `AppContainer`, `Navigation`.
- **Maps/**: `MapTrackViewer` (Reusable track renderer), `LiveHeatmap`.
- **Common/**: `StatCard`, `GlassCard`, `StatusBadge` (Obsidian aesthetics).

## 4. State Management Strategy
- **Query Keys**: Standardized keys for activity management (e.g., `['activities', 'flagged']`).
- **Map Context**: `MapProvider` manages the MapLibre instance to ensure only one instance is active per view.

## 5. Security and RBAC
The panel enforces Role-Based Access Control:
- **`GLOBAL_ADMIN`**: Full system oversight and tenant management.
- **`MODERATOR`**: Focused access to the Anti-Cheat and verification suite.
- **`TENANT_ADMIN`**: View-only or restricted access to specific city/corporate data.
