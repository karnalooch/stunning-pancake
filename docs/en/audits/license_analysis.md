# LICENSE ANALYSIS: Legal Risk Management

This document analyzes the licenses of components used in the SPORT project for commercial safety.

## 1. Open Source Foundation
The SPORT platform is based exclusively on components with permissive licenses, ensuring no requirement to open-source proprietary modifications (no viral GPL risk).

| Component | License | Compliance |
| :--- | :--- | :--- |
| **Backend (Django/FastAPI)** | BSD/MIT | ✅ Full |
| **Frontend (React/Vite)** | MIT | ✅ Full |
| **Mobile (React Native)** | MIT | ✅ Full |
| **Maps (MapLibre)** | BSD | ✅ Full |
| **Database (PostgreSQL)** | PostgreSQL | ✅ Full |

## 2. PostGIS Isolation (GPL)
PostGIS is licensed under GPL, however, as a separate database service connected via standard SQL protocol, it does not impose an obligation to share the application code. SPORT maintains strict isolation between business logic and database extensions.

## 3. PowerSync and Scaling
PowerSync uses a "Source-Available" type license. It is free for small and medium deployments, however, at enterprise scale (e.g., serving an entire country), it may require a commercial license.

---
*Last updated: 2026-04-26*
