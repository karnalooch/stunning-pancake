# 🏁 SPORT PLATFORM — HANDOVER GUIDE (v2.0)

Congratulations! You are now the owner of a state-of-the-art, multi-tenant sports ecosystem. This guide provides instructions on how to launch, seed, and present the platform.

## 🚀 5-Minute Launch Guide

### 1. Prerequisite Checklist
- **Docker & Docker Compose** (Latest version)
- **Node.js 20+**
- **Python 3.12+**

### 2. Ignition Command
Run the full stack (Database, Redis, Backend, Admin) using Docker:
```bash
docker-compose up --build -d
```

### 3. Initialize & Seed (The "Magic" Step)
To populate the platform with Cities, Sponsors, and Athletes for a live demo:
```bash
# Enter the backend container
docker-compose exec backend python manage.py migrate
docker-compose exec backend python seed_data.py
```

### 4. Access Points
- **Admin Dashboard**: `http://localhost:3000` (Login: `global_owner` / `admin123`)
- **API Documentation**: `http://localhost:8000/api/schema/swagger-ui/`
- **Public Landing Page**: `http://localhost:3000/landing`

---

## 🛠️ Tech Stack Architecture
- **Backend**: Django + FastAPI (Python Powerhouse)
- **Database**: PostgreSQL + TimescaleDB (Time-series optimization for GPS)
- **Admin**: React + Mantine + Framer Motion (Visual Magic)
- **Mobile**: Expo + React Native (Cross-platform)
- **Anti-Cheat**: BRouter (OSM Routing) + Scikit-Learn (ML Anomalies)

## 🎨 Role-Based Access Control (RBAC)
1. **GLOBAL_OWNER**: Access to all tenants, billing, and system telemetry.
2. **TENANT_ADMIN**: City/Company management, moderator invitation.
3. **TENANT_MODERATOR**: Anti-Cheat verification and user management.
4. **SPONSOR**: Dashboard for POI performance and reward distribution.
5. **ATHLETE**: GPS tracking, stats, and rewards (Mobile focus).

## 🔒 Security & Privacy
- **RLS (Row Level Security)**: PostgreSQL policies enforce data isolation between tenants at the database level.
- **Privacy Zones v2**: Automatic track masking (segment bridging) to protect user home/work addresses.

---

## 📈 Future Roadmap
- [ ] Integration with Wearable SDKs (Garmin, Apple Watch).
- [ ] AI-Generated personalized challenge recommendations.
- [ ] Real-time city-wide heatmaps for urban planning.

**Built with pride by your AI Coding Assistant.**
