# CHANGELOG — SPORT Platform

## v0.2.0-rc.1 (2026-05-03) — Release Candidate

### Added — Phase 1: Real Data
- **Admin stats endpoint** (`/api/activities/admin/stats/`) — per-tenant breakdown (users, activities, distance_km, verified_pct), new users/activities last 7d, verification stats
- **Seed 55+ demo activities** (`python manage.py seed_activities`) — realistic GPS LineString tracks (loop & out-and-back), mixed verification scores (60% verified, 25% suspicious, 15% rejected), 6 POIs, 13 vouchers across 10 athletes in 2 tenants

### Added — Phase 2: Flows That Work
- **User management** — `POST /api/users/create/`, `DELETE /api/users/<id>/delete/` with role+tenant selection, audit-logged
- **Invitation flow** — `POST /api/users/invitation/` generates temp credentials + sends email via SendGrid
- **Activity moderation** — `POST /api/activities/admin/approve/<id>/`, `POST /api/activities/admin/reject/<id>/`
- **Admin Users page** — Create/Delete/Invite modals with role selector and tenant picker, functional delete with confirmation
- **WhiteLabel engine** — Fixed API URL, added success/error notifications, auto-loads current branding on mount
- **POI markers** on MapLibre map with `CircleLayer` (theme-aware colors)
- **Leaderboard fix** — correctly extracts `.leaderboard` array from API response envelope
- **Role normalization** — `IsAdminRole` uses `GLOBAL_OWNER`/`TENANT_ADMIN`/`TENANT_MODERATOR` (matching DB values)

### Added — Phase 3: Game Vibe
- **TrackingScreen redesign** — map 90%+ screen height, HUD auto-hides after 3s (tap to restore), Metal Slug industrial border (2px black + 1px gold inner), Octopath vignette gradient on map edges, spring animations (damping 14, stiffness 100)
- **GameHUD component** — score-style jumping digits for distance, pace/speed/HR/elapsed metrics, semi-transparent black background with gold border
- **Quest Log (ActivitiesScreen)** — S/A/B/C/D verification grade badges, "MISSION" terminology, pixel-art loading states
- **Item Shop (RewardsScreen)** — "BUY" button theme, AthleteSprite loading/empty states, XP guidance text
- **Tab bar** — replaced lucide-react-native icons with generated pixel-art PNGs (nav_home, nav_history, nav_ranking, nav_rewards, nav_profile)
- **Beta Feedback** — `BetaFeedback` model + `POST /api/activities/beta-feedback/`, `GET .../list/`, `POST .../<id>/resolve/`
- **11 pixel-art assets specified** — timer, pace, distance, shield badge, S/A grades, 4 border corners, mission start button (Metal Slug style)

### Added — Phase 4-5: Strava & Garmin
- **StravaService** — `get_status()`, full token refresh, activity sync with activity-type mapping (`Ride`→`BIKE`, `Run`→`RUN`, `Walk`→`WALK`)
- **GarminService** — full OAuth2 implementation (`get_auth_url`, `exchange_code`, `refresh_token`, `sync_activities`), Garmin Connect API integration
- **Wearable status endpoint** — `GET /api/activities/wearables/sync/` returns `{strava, garmin}` connection status
- **Mobile ProfileScreen** — real CONNECT/SYNC buttons replacing "COMING SOON" stubs, status display with last sync timestamp, `Linking.openURL` for OAuth flow

### Added — Phase 6: Infrastructure
- **EmailService (SendGrid)** — `send_password_reset()`, `send_invitation()`, `send_beta_acknowledgment()` with HD-2D themed HTML templates
- **Password reset** — `POST /api/users/password/reset/` (request token), `POST /api/users/password/reset/confirm/` (apply new password)
- **Nginx production config** — `infrastructure/nginx/conf.d/default.conf` with `/api/` → backend, `/ws/` → telemetry, `/` → admin
- **Railway deployment configs** — `backend/`, `admin/`, `telemetry/railway.json`

### Added — Phase 7: Polish & Stability
- **Bridgeless (New Architecture)** — `newArchEnabled: true` in `app.config.js`
- **Global error handling** — admin API client 401→logout, 403/5xx→Mantine notifications, mobile Alert.alert wrapping
- **Admin panel full redesign** — stripped sci-fi cyberpunk (Taskbar, WinWindow, fake CPU stats, GOD_MODE), replaced with clean Windows 11 professional theme (AppShell sidebar, PageHeader, unified Card+withBorder, slate/blue palette). Removed DesignerProvider, GlobalLoader, TenantLoader, InstanceWizard (6 dead files). Net: −1400 lines.
- **DB performance indexes** — `activities_activity`: `tenant+is_verified`, `tenant+created_at`, `user+tenant`
- **Citus sharding** — ready-to-use: `apply_citus_sharding()`, `add_citus_worker()`, `rebalance_shards()`, 4 distributed + 6 reference tables

### Fixed
- `IsAdminRole` properly reads `GLOBAL_OWNER`/`TENANT_ADMIN`/`TENANT_MODERATOR` (was `GLOBAL_ADMIN`/`OWNER`/`LOCAL_MODERATOR`)
- `new_users_today` now shows actual today count (was copying `total_users`)
- WhiteLabel API URL double-`/api` prefix bug in `handleDeploy` fixed
- Activity queryset `tenant_id` filter in `TenantActivityListView` (was filtering by `user__tenant_id`)
- Leaderboard mobile response unwrapping — extracts `.leaderboard` array from envelope

### Known Issues
- 11 pixel-art assets listed in `docs/ASSET_MANIFEST.json` need manual generation (PNG, 32×32, Metal Slug style)
- Seed data must be run manually on Railway: `python manage.py seed_activities --clear`
- `@tremor/react` peer dependency conflict (React 19 vs React 18) — workaround: `--legacy-peer-deps`
- Garmin OAuth fallback uses mock token when `GARMIN_CLIENT_ID` is unset (demo mode)

---

## v0.1.0-beta.1 (2026-04-30) — Closed Beta

### Added
- **LLM-Powered Avatar Trainer** (`LlmCoachService`)
  - Dynamic, personality-driven coaching messages (Drill Sergeant / Motivator / Analyst)
  - OpenAI-compatible API via backend proxy (API key never leaves the server)
  - Circuit breaker (3 consecutive failures → 60s fallback)
  - Response cache per session with per-trigger-type keys
  - Rate limiting (max 1 call per 15s per trigger type)
  - Timeout handling (5s) with 1 retry
  - Graceful fallback to static Polish templates on any LLM failure
  - Firebase Crashlytics monitoring: P95 (>450ms) and P99 (>1900ms) latency tracking

- **System Intelligence AI** (Admin Dashboard)
  - Real-time LLM-powered analytical insights (Integrity Alerts, Growth Insights, Global Strategy)
  - Configurable model (default: gpt-4o) via `VITE_LLM_MODEL`
  - Static demo data fallback when LLM is unavailable

- **Backend LLM Proxy** (`/api/llm/proxy/`)
  - Routes mobile LLM requests through the server — API key stays server-side
  - CSRF-exempt, CORS-enabled, JSON-only endpoint

- **Test Suite** (40+ tests across 6 files)
  - `LlmCoachService.test.ts` — caching, circuit breaker, rate limiting, timeout, Polish, personality consistency
  - `AvatarTrainerService.test.ts` — session lifecycle, all 9 trigger categories, template variables, fallback
  - `TriggerEngine.test.ts` — priority queue, FIFO, deduplication, cooldown, auto-dismiss
  - `Integration.test.ts` — AvatarTrainerService + TriggerEngine end-to-end flow
  - `PopUpDialog.test.ts` — maxWidth 220, typewriter 40ms/char, sprites, animations, Solar Mode

### Fixed
- TypeScript compilation — `TriggerCategory` naming collision between `LlmCoachService` and `TriggerEngine` resolved
- TypeScript errors in `LeaderboardScreen`, `RewardsScreen`, `TrackingScreen` fixed
- `RewardsScreen` missing `View` import from tamagui
- Firebase Crashlytics — now conditionally initializes on native platforms

### Changed
- Version bumped to 0.1.0-beta.1 across all components
- `AvatarTrainerService` refactored: synchronous → async LLM-first dispatch with pending-trigger deduplication
- `dev.ps1` build tags updated from v2.1 to v0.1.0-beta.1
- `docker-compose.yml` — added LLM env args (`VITE_LLM_API_KEY`, `VITE_LLM_API_URL`, `VITE_LLM_MODEL`) to admin services

### Known Issues
- `@tremor/react` peer dependency conflict (React 19 vs React 18) — workaround: `--legacy-peer-deps`
- GPS spoofing detection still relies on pre-LLM heuristics (ML model pending)

---

## Previous Versions
*(v1.0.0 through pre-beta) — development builds prior to closed beta 0.1.0*
