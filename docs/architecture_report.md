# Comprehensive Architectural Report: SPORT Platform
## Scaling Sports Applications with Python, TypeScript, and 4-Level RBAC

### 1. Introduction & Philosophy
The SPORT platform is a high-fidelity sports ecosystem built on real-time GPS telemetry and gamification. Our architecture leverages the "Power Couple" strategy: **Python** for the heavy-lifting backend logic (Anti-Cheat, Spatial Analysis) and **TypeScript** for robust, type-safe interfaces across Mobile and Admin panels.

### 2. Multi-tenancy & Data Isolation (RLS)
To serve multiple independent organizations (cities, clubs) on a single infrastructure, we implement a **Shared Database, Shared Schema** model powered by PostgreSQL **Row-Level Security (RLS)**.

*   **Security Enforcement**: Isolation is moved from the application code (ORM) directly to the database engine.
*   **Fail-Closed Mechanism**: If the backend fails to provide a session context (`app.current_tenant`), the database denies access by default (returning 0 rows).
*   **PostGIS**: All spatial queries (Geofencing via `ST_Intersects`) are performed natively within the database, ensuring high performance for thousands of concurrent athletes.

### 3. 4-Level Role-Based Access Control (RBAC)

| Level | Role | Scope | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Level 1** | **Global Admin** | Global (All Tenants) | Platform config, billing, tenant creation, system audits. Bypasses RLS (`BYPASSRLS`). |
| **Level 2** | **Tenant Admin** | Specific Tenant | Club management, event creation, PoI setup, moderator assignment. |
| **Level 3** | **Moderator** | Specific Tenant | Anti-Cheat monitoring, track verification, incident handling. No billing access. |
| **Level 4** | **User** | Specific Resource | GPS recording, personal stats, leaderboard participation. |

### 4. Modular Admin Architecture
The Admin Panel has been refactored from a monolith into a **Modular Monorepo-style** structure.

#### 4.1 Deployment Strategy (3 Separate Apps)
We deploy three distinct containers built from the same source code using the `VITE_APP_MODE` flag:
1.  **Global Admin Panel** (Port 3001)
2.  **Tenant Admin Panel** (Port 3002)
3.  **Moderation Command Center** (Port 3003)

#### 4.2 Source Code Organization (`admin/src/`)
*   `core/`: Application skeleton, routing, and global styles.
*   `modules/`: Domain-specific logic (Analytics, Anti-Cheat, Moderation, Social, Tracking).
*   `shared/`: Common UI components, hooks, and TypeScript types.

### 5. Anti-Cheat Engine
The platform employs advanced detection algorithms in Python.
*   **BRouter Integration**: Verifies that tracks adhere to real-world topology.
*   **Vector Analysis**: Detects anomalies like E-bike usage or vehicle transport by analyzing acceleration vectors and heart rate correlations (where available).
*   **Human-in-the-Loop**: Flagged sessions are automatically routed to the **Moderator App** for manual review and disciplinary actions (Cropping, Disqualification).

---
*Updated: 2026-04-24 | Arch-Ref: SPORT-PHASE-5-RBAC*
