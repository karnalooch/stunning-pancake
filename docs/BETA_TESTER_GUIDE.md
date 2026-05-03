# 🧪 SPORT v0.2.0-rc.1 — Release Candidate Tester Guide

## 🔐 Access

**Version**: `0.2.0-rc.1` (2026-05-03)

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
# Fill SENDGRID_API_KEY, STRAVA_CLIENT_ID, GARMIN_CLIENT_ID (optional for demo)
docker-compose up --build -d
```

The deploy automatically runs migrations, creates admin accounts, and seeds basic demo data.
**For full RC dataset (55+ activities)**, run after deploy:
```bash
docker compose exec backend python manage.py seed_activities --clear
```

---

## 📱 Mobile App
```bash
cd mobile
npm install
npx expo start
```
Required: `EXPO_PUBLIC_API_URL` (backend URL). Bridgeless mode enabled (`newArchEnabled: true`).

---

## 🧠 What To Test

### Mobile — Tracking (Game Vibe)
1. **Map-first experience** — map 90% screen, HUD auto-hides after 3s idle
2. **Tap to reveal HUD** — HUD returns on tap, shows distance (jumping digits), pace, speed, HR, elapsed time
3. **START MISSION** — green button starts tracking, turns to red "ABORT & SYNC"
4. **Metal Slug border** — 2px black + 1px gold inner around map
5. **Octopath vignette** — dark gradient on map edges
6. **POI markers** — sponsor location circles on the map

### Mobile — Quest Log (Activities)
1. Activities show **S/A/B/C/D grade badges** based on verification score
2. Empty state shows ghost sprite + "NO MISSIONS COMPLETED YET"
3. Share button generates status message

### Mobile — Leaderboard
1. TOP 3 podium with elite/cyclist/runner sprites (Gold/Silver/Bronze)
2. "My Rank" fixed HUD at bottom — always visible
3. Real data from backend (requires seeded activities)

### Mobile — Item Shop (Rewards)
1. XP balance card at top
2. "BUY" redeem buttons (green when affordable, red when disabled)
3. AthleteSprite loading/empty states

### Mobile — Profile & Wearables
1. **Strava CONNECT** — opens Strava OAuth in browser
2. **Garmin CONNECT** — opens Garmin OAuth in browser  
3. **SYNC** button imports activities from connected wearables
4. Connection status shown per service (connected + last sync)
5. QR identity code (toggleable), privacy zones, incognito mode

### Admin — Dashboard
1. **Per-tenant breakdown table** — users, activities, distance, verified %, status badge per tenant
2. **Dynamic stat cards** — growth badges from real API data
3. **ModeratorWorklist** — approve/reject buttons with confirmation modals
4. **User create/delete** — role selector, tenant picker, confirmation

### Admin — WhiteLabel Engine
1. Color pickers update tenant branding
2. **Deploy Branding** button → success notification
3. Asset upload section (coming in v0.3)

---

## 🐛 Bug Report Format
```
Version: 0.2.0-rc.1
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
| 11 pixel-art assets need generation | See `docs/ASSET_MANIFEST.json` |
| Garmin OAuth needs `GARMIN_CLIENT_ID` env var | Falls back to mock token in demo |
| Instance Wizard deploy button | Shows "Coming in v0.3" notification |
| Seed data not auto-run on deploy | Run `seed_activities --clear` manually |

---

## 📦 Architecture Overview

| Component | Tech | Port | Status |
|---|---|---|---|
| Backend API | Django + DRF | 8000 | ✅ |
| Celery Worker | Celery + Redis | — | ✅ |
| Celery Beat | django-celery-beat | — | ✅ |
| Telemetry | FastAPI + WebSocket | 8001 | ✅ |
| Global Admin | Vite + React + Mantine | 3001 | ✅ |
| Tenant Admin | Vite + React | 3002 | ✅ |
| Moderator | Vite + React | 3003 | ✅ |
| BRouter | Java + Gradle | 17777 | ✅ |
| DB | PostgreSQL + PostGIS | 5432 | ✅ |
| Redis | Redis 7 | 6379 | ✅ |
| Traccar | Traccar GPS | 8082 | ✅ |
| Nginx | nginx:alpine | 80/443 | ✅ |

---

*Contact via beta tester channel for questions.*
