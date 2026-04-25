# 🏆 SPORT — High-Performance Sports Platform (Final v2.0)

A state-of-the-art, high-precision B2B/B2C sports ecosystem designed for city-wide competitions, corporate wellness, and elite telemetry analysis. 

## 🌟 Key Features (Final v2.0)

-   **Visual Magic UI**: Premium "Cyber-Athlete" aesthetic with Windows 11 Mica/Fluent effects, glassmorphism, and spring-based animations.
-   **3-Layer Anti-Cheat**: Kinematic "Fast Selection Gate" + V-max Biomechanical Checks + BRouter Topological Path Validation.
-   **Multi-Tenant Isolation**: Hardened PostgreSQL **Row Level Security (RLS)** ensuring total data separation between cities and companies.
-   **White-Label Engine**: Remote Asset Injection (Logos, Colors, Splash Screens) for instant branding deployment.
-   **Outdoor HUD**: High-Contrast mobile interface (OLED Black + Neon) optimized for accessibility in direct sunlight.
-   **Handover Ready**: Full seed scripts, deployment Dockerfiles, and comprehensive documentation for immediate launch.

## 📂 Documentation & Guides

-   **[🏁 HANDOVER GUIDE](./HANDOVER.md)** — **Start here!** Instructions for 5-minute launch and seeding.
-   **[Architectural Whitepaper](./docs/architecture/sport_architecture_whitepaper.md)** — Core strategies: PostGIS, TimescaleDB, BRouter, RLS.
-   **[User Management V2 (RBAC/RLS)](./docs/architecture/user_management_redesign.md)** — Multi-Tenant logic and role definitions.
-   **[Project Constitution](./docs/guides/constitution.md)** — Mission and identity.

## 🚀 Quick Launch

```bash
docker-compose up --build -d
docker-compose exec backend python seed_data.py
```
Log in at `localhost:3000` with `global_owner / admin123`.

## 📂 Repository Structure
- `/admin`: Next.js 15 / Vite + Mantine (The Command Center)
- `/backend`: Django + FastAPI + PostGIS (The Engine)
- `/mobile`: Expo / React Native (The Athlete App)
- `/docs`: Full technical and business documentation

## ⚖️ License
Built 100% on **Permissive Open Source** foundations (MIT, Apache 2.0, BSD).

**Designed and implemented by Antigravity (Advanced Agentic Coding).**

