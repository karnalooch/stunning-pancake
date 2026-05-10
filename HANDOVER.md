# 🏁 4VELO PLATFORM — HANDOVER GUIDE (v0.2.0-rc.1)

This guide provides instructions on how to launch, seed, and present the platform.

## 🚀 Launch Guide

### 1. Prerequisites
- **Docker & Docker Compose** (latest)
- **Node.js 20+** (for mobile/admin dev)
- **Python 3.12+** (for backend dev)

### 2. Start Platform
```bash
cp .env.example .env
# Fill in .env with your values (OPENAI_API_KEY required for LLM features)
docker-compose up --build -d
```

### 3. Access Points
| Service | URL | Login |
|---|---|---|
| **Global Admin** | `http://localhost:3001` | `global_owner` / `admin123` |
| **Tenant Admin** | `http://localhost:3002` | `siedlce_admin` / `siedlce123` |
| **Moderator** | `http://localhost:3003` | — |
| **Backend API** | `http://localhost:8000` | — |
| **API Docs** | `http://localhost:8000/api/docs/` | — |

### 4. Production (Railway)
```
https://docker-backend-production-123c.up.railway.app
```
Login: `global_owner` / `admin123` or `admin@sport.com` / `Sport2026!`

---

## 🛠️ Tech Stack

| Component | Technology | Status |
|---|---|---|
| Backend API | Django + DRF + SimpleJWT | ✅ Deployed |
| Telemetry ingest | FastAPI (separate microservice) | ⚠️ Dev only |
| Database | PostgreSQL + PostGIS | ✅ Deployed |
| Async tasks | Celery + Redis | ⚠️ Dev only |
| Admin panel | React + Mantine v9 + Tremor + Framer Motion | ✅ Deployed |
| Mobile | Expo + React Native + Tamagui + Skia | ⚠️ Dev only |
| Anti-Cheat | Kinematic Gate → V-max → BRouter → Viterbi HMM | ✅ Layers 1-2 |
| AI/LLM | OpenAI-compatible (proxy via backend) | ✅ Deployed |
| Multi-tenant | PostgreSQL RLS | ✅ Deployed |

---

## 🎨 Role-Based Access (RBAC)
1. **GLOBAL_OWNER** — All tenants, billing, system telemetry
2. **TENANT_ADMIN** — City/company management, moderator invitations
3. **TENANT_MODERATOR** — Anti-Cheat verification, user management
4. **SPONSOR** — POI performance, reward distribution
5. **ATHLETE** — GPS tracking, stats, rewards (mobile)

---

## 🔒 Security
- **RLS (Row Level Security)** — PostgreSQL policies enforce data isolation at the database level
- **JWT with token blacklist** — Access 60min, Refresh 30 days
- **Impersonation audit** — All GLOBAL_OWNER admin actions are logged
- **LLM API key** — Never exposed to clients (server-side proxy)

---

## 📱 Mobile

```bash
cd mobile
npm install
npx expo start
# APK build: npm run build:preview:android
# OTA update: eas update --branch production --message "..."
```

Required env: `EXPO_PUBLIC_API_URL` (backend URL)

---

## 📈 Roadmap

- [x] JWT auth + RBAC + RLS
- [x] 4-layer Anti-Cheat (Kinematic → V-max → BRouter → Viterbi)
- [x] LLM Coach + System Intelligence
- [x] HD-2D visual system (mobile)
- [x] Admin panel (Mantine v9)
- [ ] Celery workers on production
- [ ] FastAPI telemetry on production
- [ ] Wearable SDK integrations (Garmin, Strava)
- [ ] AI-generated challenges
