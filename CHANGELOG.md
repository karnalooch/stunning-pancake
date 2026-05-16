# CHANGELOG — 4VELO Platform

## v0.3.3-dev (2026-05-16) — Audit System + Integration Sprint

### Added
- **Audit System (Phase A)**: 8 static audit scripts + 2 Playwright E2E tests. Covers route parity, dead screens, mobile parity, API gaps, RBAC consistency, redirect chains, env variable drift, dead imports. CI job `audit` in `ci.yml`. Run via `npm run audit:all`.
- **12 new admin routes**: Departments, DepartmentUsers (`/departments/:id/users`), EventsManager, SponsorshipAnalytics, RewardsVouchers, BetaFeedback, ExportCenter, LeaderboardManager, RbacManager, ApiPlayground, FeatureFlags, DepartmentAnalyticsPage
- **4 new dashboard subcomponents**: ActivityTimeline, AuditLog, TrendAnalysis, SystemHealth — embedded in Dashboard for GLOBAL_OWNER
- **Missing rewards migration**: `rewards/migrations/0001_initial.py` — creates Sponsor, VoucherPool, Voucher, PointsLedger tables
- **22 new env keys**: EXPO_PUBLIC_*, DEEPSEEK_*, GEMINI_*, TRACCAR_USER/PASS, ML_RETRAIN_*, GLOBAL_OWNER_*, ADMIN_*, ALLOWED_HOSTS, DATABASE_URL, TOKEN_ENCRYPTION_KEY, DJANGO_SUPERUSER_*, DEPARTMENTS_ENABLED

### Fixed
- **5 dead sidebar links**: departments, analytics/events, analytics/sponsorship, analytics/vouchers, analytics/feedback — all now routed
- **4 RBAC mismatches**: sidebar roles not matching PermissionGuard permissions. Fixed by restricting sidebar roles (Option A: restrictive). Departments → removed TENANT_MODERATOR. AntiCheat → removed TENANT_ADMIN. Analytics/sponsorship+vouchers → GLOBAL_OWNER only.
- **Double department URL prefix**: `department_urls.py` router had `r'departments'` while parent include already prefixes `api/users/departments/`. Changed to `r''`. Endpoint tree/users/assign/remove now accessible.
- **3 `.map is not a function` crashes**: Users.tsx departments fetch, Departments.tsx both fetches — added `Array.isArray()` guards
- **3 backend 500 errors**: TelemetryConfigView.post() — `get_redis()` without try-catch. sponsor_stats_view — DB ProgrammingError (no migrations). 4 Matrix E2EE endpoints — `get_redis()` + `json.loads()` without try-catch.
- **Celery Beat SchedulingError**: `recalculate_city_leaderboard` missing `city_id` arg. Task now accepts optional param, iterates all cities when empty.
- **MapLibre unmount crash**: `Invalid type: container` — dynamic import resolved after component unmount. Added cancelled flag guard.
- **Catch-all redirect false positive**: audit-redirects.ts now recognizes separate `<Routes>` auth branches.

### Changed
- **Screen count**: 39 → **46 total** (30 admin routable + 16 mobile). 0 orphans, 0 dead links, 0 RBAC mismatches.
- **API coverage**: 20 unique FE endpoints → all matched to BE. 82 BE endpoints total. Departments endpoints fully functional.
- **.env.example**: Reorganized sections, added 22 missing keys, removed duplicates.
- **Audit report added**: `docs/AUDIT_REPORT_2026-05-16.md` — comprehensive audit results post-fix.

## v0.3.2-dev (2026-05-15) — Admin Dashboard World-Class Redesign

### Added
- **Design System**: Complete CSS token system (80+ variables) with full dark mode in `globals.css`
- **StatCard Component**: New reusable KPI card with Framer Motion staggered animations, trend indicators (up/down/flat), 8 gradient colour variants, skeleton loading states
- **PageHeader Enhancements**: Gradient title support, breadcrumbs slot, improved typography
- **Admin Docs**: `docs/admin/README.md` — comprehensive documentation of design system, architecture, component API

### Changed
- **Brand Color**: Switched primary from blue to indigo (`#6366F1 → #8B5CF6` gradient)
- **Sidebar (Layout.tsx)**: Collapsible (260px ↔ 72px) with grouped navigation (Overview/Management/Operations/System), active accent bar, dark mode toggle, user profile card with gradient avatar, state persisted in localStorage
- **Dashboard (Dashboard.tsx)**: Personalized time-of-day greeting, staggered card animations, skeleton loading, health badges (Healthy/Review/Critical), quick stats grid (verified/pending/kcal), animated tenant table rows
- **Login Page (LoginPage.tsx)**: Split-screen premium design — gradient branding panel with hero text + feature bullets + decorative blobs on left, animated form card on right, animated error messages with AnimatePresence
- **Theme (index.ts)**: Refined Mantine overrides for Card, Table, Modal, Drawer, Tooltip, Notification, Menu, Progress — all using CSS variables
- **App.tsx**: `defaultColorScheme="auto"` for OS-preference-based dark mode

### Removed
- Unused `VariantColorsResolver` import from theme config
- Redundant CSS import ordering (moved Google Fonts @import to top of globals.css)

## v0.3.1-dev (2026-05-10) â€” Rebranding to 4VELO + Crash Fixes

### Fixed
- **Root cause of `Property 'C' doesn't exist` crash**: `CityHubScreen.tsx` and `ActivityDetailScreen.tsx` had `C.onBackground` at module-level (outside component) â†’ TypeError during `loadModuleImplementation`
- **StyleSheet imports**: All 13 screens â€” `StyleSheet` now imported from `react-native-unistyles` (supports `(theme) => {}` callback). React Native's `StyleSheet.create()` does not support callbacks.
- **App.tsx**: `useStyles()` hook moved from `renderAuthUI()` (regular function) to component level â€” React hooks must be called at component top-level
- **OnboardingScreen.tsx**: Removed unused `StyleSheet` import from `react-native`
- **ThemeService.tsx**: All fallback values corrected from `'octopath'`/`'solar'` to `'stitch'` (the only registered theme)
- **App.tsx ErrorBoundary**: Safe color extraction with try-catch and hardcoded fallback colors

## v0.3.1-dev (2026-05-10) â€” Rebranding to 4VELO

### Changed
- **Rebranding**: Project renamed from "SPORT" to **4VELO** across the entire stack
- **Branding**: Logo SVGs updated to display "4VELO"
- **Mobile**: App display name changed to "4VELO" (visible on home screen), splash screen, login title, notification titles all updated
- **Admin**: Product name changed to "4VELO Owner OS", all UI labels updated
- **Backend**: API title, project name, email templates all updated
- **Docker**: All container names prefixed with `4velo_` instead of `sport_`
- **Documentation**: README, CHARTER, CHANGELOG header, HANDOVER, design docs updated

### Fixed
- **EAS Build**: Reverted Android package name to `com.sport.athlete` to maintain Firebase `google-services.json` compatibility

## v0.3.0-dev (2026-05-06) â€” STITCH Mobile Redesign Begins

### Security â€” Phase A Audit
- **Dependency scan**: 0 CVEs in backend (pip-audit) and admin (npm audit); 5 LOW in mobile test deps only
- **SAST (Bandit)**: 5 MEDIUM findings â€” all missing timeouts in wearables.py â†’ **ALL FIXED**
- **Secret scanning**: 0 API key leaks (detect-secrets + manual regex)
- **Config hardening**: CORS restricted to whitelist (was `CORS_ALLOW_ALL_ORIGINS=True`), DRF rate limiting added (anon 30/min, user 300/min, login 5/min), 5Ă— `timeout=` added to Strava/Garmin API calls
- **Report**: `reports/PHASE_A_REPORT.md`

### Docs â€” Mobile Design SSOT
- **Renamed**: `docs/DESIGN.md` â†’ `docs/designmobile.md` â€” updated Section 10 with 15 STITCH screen design decisions extracted from HTML mockups
- **New**: `plans/screen-architecture-plan.md` â€” 4-tab navigation (RIDE, COMPETE, EXPLORE, PROFILE) + Settings stack, Expo Router structure
- **New**: `plans/security-audit-plan.md` â€” 3-phase security strategy (A: static audit, B: code review, C: full pentest)
- **Cleanup**: Removed 14 superseded V3.0 mobile design files (VISUAL_MANIFESTO.md, MOBILE_UI_PLAN.md, AUDIT_V3_MOBILE_REPORT.md, old mockups, debug screenshots)

### Mobile â€” STITCH Phase 1 Screens (P0)
- **RideDashboardScreen**: Pre-ride landing with hero card (active ride / idle states), metric tiles grid, weekly load bar chart
- **RideSummaryScreen**: Post-ride celebration â€” achievement badge, S/A/B/C/D rank, stats bento, elevation progress bar, BACK TO HUB CTA
- **CityHubScreen**: City competition dashboard â€” City of the Week banner, City Wars VS bar, local leaderboard, nearby quests
- **ActivityDetailScreen**: Ride deep-dive â€” header info card, stats bento, route map placeholder, achievements carousel, performance chart, Share/Download FIT buttons
- **ActiveRideHUDScreen**: Pending â€” refactor of existing TrackingScreen

### Mobile â€” Technical Debt & Refactoring
- **Absolute Unistyles Refactoring**: Eliminated the static `const C = stitchTheme.colors` anti-pattern across all 16 screens. Implemented dynamic `StyleSheet.create(theme => ...)` and `useStyles()` hooks ensuring instant theme reactivity and fixing state propagation issues.
- **Dead Code Elimination**: Removed deprecated screens (`TrackingScreen.tsx`, `ProfileScreen.tsx`, `RewardsScreen.tsx`, `LeaderboardScreen.tsx`, `ActivitiesScreen.tsx`) that were superseded by STITCH Phase 1 screens.
- **Docs Cleanup**: Removed duplicate `docs/design_mobile.md`.

---

## v0.2.0-rc.1 (2026-05-03) â€” Release Candidate

### Added â€” Phase 1: Real Data
- **Admin stats endpoint** (`/api/activities/admin/stats/`) â€” per-tenant breakdown (users, activities, distance_km, verified_pct), new users/activities last 7d, verification stats
- **Seed 55+ demo activities** (`python manage.py seed_activities`) â€” realistic GPS LineString tracks (loop & out-and-back), mixed verification scores (60% verified, 25% suspicious, 15% rejected), 6 POIs, 13 vouchers across 10 athletes in 2 tenants

### Added â€” Phase 2: Flows That Work
- **User management** â€” `POST /api/users/create/`, `DELETE /api/users/<id>/delete/` with role+tenant selection, audit-logged
- **Invitation flow** â€” `POST /api/users/invitation/` generates temp credentials + sends email via SendGrid
- **Activity moderation** â€” `POST /api/activities/admin/approve/<id>/`, `POST /api/activities/admin/reject/<id>/`
- **Admin Users page** â€” Create/Delete/Invite modals with role selector and tenant picker, functional delete with confirmation
- **WhiteLabel engine** â€” Fixed API URL, added success/error notifications, auto-loads current branding on mount
- **POI markers** on MapLibre map with `CircleLayer` (theme-aware colors)
- **Leaderboard fix** â€” correctly extracts `.leaderboard` array from API response envelope
- **Role normalization** â€” `IsAdminRole` uses `GLOBAL_OWNER`/`TENANT_ADMIN`/`TENANT_MODERATOR` (matching DB values)

### Added â€” Phase 3: Game Vibe
- **TrackingScreen redesign** â€” map 90%+ screen height, HUD auto-hides after 3s (tap to restore), Metal Slug industrial border (2px black + 1px gold inner), Octopath vignette gradient on map edges, spring animations (damping 14, stiffness 100)
- **GameHUD component** â€” score-style jumping digits for distance, pace/speed/HR/elapsed metrics, semi-transparent black background with gold border
- **Quest Log (ActivitiesScreen)** â€” S/A/B/C/D verification grade badges, "MISSION" terminology, pixel-art loading states
- **Item Shop (RewardsScreen)** â€” "BUY" button theme, AthleteSprite loading/empty states, XP guidance text
- **Tab bar** â€” replaced lucide-react-native icons with generated pixel-art PNGs (nav_home, nav_history, nav_ranking, nav_rewards, nav_profile)
- **Beta Feedback** â€” `BetaFeedback` model + `POST /api/activities/beta-feedback/`, `GET .../list/`, `POST .../<id>/resolve/`
- **11 pixel-art assets specified** â€” timer, pace, distance, shield badge, S/A grades, 4 border corners, mission start button (Metal Slug style)

### Added â€” Phase 4-5: Strava & Garmin
- **StravaService** â€” `get_status()`, full token refresh, activity sync with activity-type mapping (`Ride`â†’`BIKE`, `Run`â†’`RUN`, `Walk`â†’`WALK`)
- **GarminService** â€” full OAuth2 implementation (`get_auth_url`, `exchange_code`, `refresh_token`, `sync_activities`), Garmin Connect API integration
- **Wearable status endpoint** â€” `GET /api/activities/wearables/sync/` returns `{strava, garmin}` connection status
- **Mobile ProfileScreen** â€” real CONNECT/SYNC buttons replacing "COMING SOON" stubs, status display with last sync timestamp, `Linking.openURL` for OAuth flow

### Added â€” Phase 6: Infrastructure
- **EmailService (SendGrid)** â€” `send_password_reset()`, `send_invitation()`, `send_beta_acknowledgment()` with HD-2D themed HTML templates
- **Password reset** â€” `POST /api/users/password/reset/` (request token), `POST /api/users/password/reset/confirm/` (apply new password)
- **Nginx production config** â€” `infrastructure/nginx/conf.d/default.conf` with `/api/` â†’ backend, `/ws/` â†’ telemetry, `/` â†’ admin
- **Railway deployment configs** â€” `backend/`, `admin/`, `telemetry/railway.json`

### Added â€” Phase 7: Polish & Stability
- **Bridgeless (New Architecture)** â€” `newArchEnabled: true` in `app.config.js`
- **Global error handling** â€” admin API client 401â†’logout, 403/5xxâ†’Mantine notifications, mobile Alert.alert wrapping
- **Admin panel full redesign** â€” stripped sci-fi cyberpunk (Taskbar, WinWindow, fake CPU stats, GOD_MODE), replaced with clean Windows 11 professional theme (AppShell sidebar, PageHeader, unified Card+withBorder, slate/blue palette). Removed DesignerProvider, GlobalLoader, TenantLoader, InstanceWizard (6 dead files). Net: â’1400 lines.
- **DB performance indexes** â€” `activities_activity`: `tenant+is_verified`, `tenant+created_at`, `user+tenant`
- **Citus sharding** â€” ready-to-use: `apply_citus_sharding()`, `add_citus_worker()`, `rebalance_shards()`, 4 distributed + 6 reference tables

### Fixed
- `IsAdminRole` properly reads `GLOBAL_OWNER`/`TENANT_ADMIN`/`TENANT_MODERATOR` (was `GLOBAL_ADMIN`/`OWNER`/`LOCAL_MODERATOR`)
- `new_users_today` now shows actual today count (was copying `total_users`)
- WhiteLabel API URL double-`/api` prefix bug in `handleDeploy` fixed
- Activity queryset `tenant_id` filter in `TenantActivityListView` (was filtering by `user__tenant_id`)
- Leaderboard mobile response unwrapping â€” extracts `.leaderboard` array from envelope

### Known Issues
- 11 pixel-art assets listed in `docs/ASSET_MANIFEST.json` need manual generation (PNG, 32Ă—32, Metal Slug style)
- Seed data must be run manually on Railway: `python manage.py seed_activities --clear`
- `@tremor/react` peer dependency conflict (React 19 vs React 18) â€” workaround: `--legacy-peer-deps`
- Garmin OAuth fallback uses mock token when `GARMIN_CLIENT_ID` is unset (demo mode)

---

## v0.1.0-beta.1 (2026-04-30) â€” Closed Beta

### Added
- **LLM-Powered Avatar Trainer** (`LlmCoachService`)
  - Dynamic, personality-driven coaching messages (Drill Sergeant / Motivator / Analyst)
  - OpenAI-compatible API via backend proxy (API key never leaves the server)
  - Circuit breaker (3 consecutive failures â†’ 60s fallback)
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
  - Routes mobile LLM requests through the server â€” API key stays server-side
  - CSRF-exempt, CORS-enabled, JSON-only endpoint

- **Test Suite** (40+ tests across 6 files)
  - `LlmCoachService.test.ts` â€” caching, circuit breaker, rate limiting, timeout, Polish, personality consistency
  - `AvatarTrainerService.test.ts` â€” session lifecycle, all 9 trigger categories, template variables, fallback
  - `TriggerEngine.test.ts` â€” priority queue, FIFO, deduplication, cooldown, auto-dismiss
  - `Integration.test.ts` â€” AvatarTrainerService + TriggerEngine end-to-end flow
  - `PopUpDialog.test.ts` â€” maxWidth 220, typewriter 40ms/char, sprites, animations, Solar Mode

### Fixed
- TypeScript compilation â€” `TriggerCategory` naming collision between `LlmCoachService` and `TriggerEngine` resolved
- TypeScript errors in `LeaderboardScreen`, `RewardsScreen`, `TrackingScreen` fixed
- `RewardsScreen` missing `View` import from tamagui
- Firebase Crashlytics â€” now conditionally initializes on native platforms

### Changed
- Version bumped to 0.1.0-beta.1 across all components
- `AvatarTrainerService` refactored: synchronous â†’ async LLM-first dispatch with pending-trigger deduplication
- `dev.ps1` build tags updated from v2.1 to v0.1.0-beta.1
- `docker-compose.yml` â€” added LLM env args (`VITE_LLM_API_KEY`, `VITE_LLM_API_URL`, `VITE_LLM_MODEL`) to admin services

### Known Issues
- `@tremor/react` peer dependency conflict (React 19 vs React 18) â€” workaround: `--legacy-peer-deps`
- GPS spoofing detection still relies on pre-LLM heuristics (ML model pending)

---

## Previous Versions
*(v1.0.0 through pre-beta) â€” development builds prior to closed beta 0.1.0*
