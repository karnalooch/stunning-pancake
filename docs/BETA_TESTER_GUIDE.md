# 🧪 SPORT v0.1.0-beta.2 — Closed Beta Tester Guide

## 🔐 Access

**Version**: `0.1.0-beta.2` (2026-05-03)

### Production (Railway)
| Service | URL | Login |
|---|---|---|
| Backend API | `https://docker-backend-production-123c.up.railway.app` | — |
| API Docs | `https://docker-backend-production-123c.up.railway.app/api/docs/` | — |

### Admin Accounts
| Account | Password | Role |
|---|---|---|
| `global_owner` | `admin123` | GLOBAL_OWNER |
| `admin@sport.com` | `Sport2026!` | GLOBAL_OWNER (alt) |
| `siedlce_admin` | `siedlce123` | TENANT_ADMIN (Siedlce) |

### API Login
```
POST /api/auth/token/
Body: { "username": "global_owner", "password": "admin123" }
```

---

## 🚀 Local Setup

```bash
cp .env.example .env
# Fill OPENAI_API_KEY (required for LLM)
docker-compose up --build -d
```

The deploy automatically runs migrations, creates admin accounts, and seeds demo data.
No manual `seed_data.py` step needed.

---

## 📱 Mobile App
```bash
cd mobile
npm install
npx expo start
```
Required: `EXPO_PUBLIC_API_URL` (backend URL)

---

## 🧠 What To Test

### Mobile — Avatar Trainer
1. Start training session — Avatar-Trainer message expected
2. Simulate low battery (<20%) — CRITICAL alert
3. Simulate GPS loss (accuracy >50m) — alert then recovery
4. HR zone change — HR_ZONE_UP / HR_ZONE_DOWN
5. Personal best — CELEBRATING state + message
6. Personality switch (DRILL_SERGEANT / MOTIVATOR / ANALYST)
7. Disable LLM API (or timeout) — fallback to static templates

### Admin — System Intelligence
1. Dashboard → System Intelligence — 3 sections: Integrity Alert, Growth Insight, Global Strategy
2. Without API key — demo data fallback
3. With API key — dynamic LLM insights
4. Check model badge

### General
- All messages in Polish
- No PL/EN mixing in one message
- Messages stay within dialog box (maxWidth: 220)
- Typewriter effect smooth (40ms/char)
- Character animations (spring entry, floating idle, exit)

---

## 🐛 Bug Report Format
```
Version: 0.1.0-beta.2
Component: [mobile | admin | backend]
Description: [brief]
Steps: [how to reproduce]
Expected: [what should happen]
Actual: [what happened]
```

---

## ⚠️ Known Limitations

| Issue | Workaround |
|---|---|
| `@tremor/react` peer dependency (React 19 vs 18) | `npm install --legacy-peer-deps` |
| Firebase Crashlytics — dev fallback to console | Production needs `google-services.json` |
| LLM API key needed on server | Set `OPENAI_API_KEY` in `.env` |
| Celery workers not on production | Anti-Cheat runs synchronously |
| FastAPI telemetry dev-only | — |

---

## 📦 Architecture Overview

| Component | Tech | Port | Status |
|---|---|---|---|
| Backend API | Django + DRF | 8000 | ✅ |
| Telemetry | FastAPI | 8001 | ⚠️ Dev |
| Global Admin | Vite + React + Mantine | 3001 | ✅ |
| Tenant Admin | Vite + React | 3002 | ✅ |
| Moderator | Vite + React | 3003 | ✅ |
| DB | PostgreSQL + PostGIS | 5432 | ✅ |
| Redis | Redis 7 | 6379 | ✅ |
| Traccar | Traccar GPS | 8082 | ✅ |

---

*Contact via beta tester channel for questions.*
