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

---

## 📱 Mobile Deployment & Maintenance
The mobile app supports two types of updates:
1. **Native Builds (APK/iOS)**: Required when adding new native libraries (e.g., Bluetooth, specialized sensors) or changing app icons/splash screens.
   - Command: `cd mobile; npm run build:android` (profile: `preview`).
   - Local APK: `app-release.apk` (generated for custom native modules).
2. **OTA Updates (Over-The-Air)**: Instant updates for UI changes, bug fixes, or logic updates without resubmitting to stores.
   - Command: `cd mobile; eas update --branch production --message "Update UI theme"`.

## 📈 Future Roadmap
- [x] **Firebase Integration**: Transitioned from Sentry to Firebase for client and server production observability.
- [x] **OTA & Dynamic UI**: Implemented remote deployment framework via EAS Updates (`production` / `preview` branches) and successfully rolled out the initial OTA fix sequence.
- [x] **MapLibre Native v11**: Fully upgraded tracking maps to MapLibre v11.
- [x] **Stability and RBAC**: Resolved React DOM proxy unmount exceptions for smooth dashboard/user flows.
- [ ] **Integration with Wearable SDKs**: Garmin, Apple Watch, and Strava sync.
- [ ] **AI-Generated Challenges**: Personalized athlete goals based on performance history.

**Built with pride by your AI Coding Assistant.**
