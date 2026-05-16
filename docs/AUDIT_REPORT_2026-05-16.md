# Raport audytu 4VELO — 2026-05-16

> Wygenerowano automatycznie przez `npm run audit:all` po pełnym cyklu naprawczym.

---

## Podsumowanie ogólne

| Audyt | Status | Errors | Warnings | Kluczowa zmiana |
|-------|--------|--------|----------|-----------------|
| **Route Parity Check** | 🟡 | 0 | 7 | 5 dead linków naprawionych, +7 nowych tras (system/*, analytics/*) |
| **Dead Screen Detection** | 🟢 | 0 | 0 | 17 orphanów podłączonych — wszystkie 30 plików zaimportowane |
| **Mobile Screen Parity** | 🟢 | 0 | 0 | 16/16 screenów — wszystkie 3 fazy kompletne |
| **API Gap Analysis** | 🟡 | 0 | 45 | FE↔BE mapping poprawny. 45 endpointów BE bez konsumenta FE (mobile/webhook/wearables) |
| **RBAC Consistency** | 🟢 | 0 | 0 | 4 mismatche naprawione — wszystkie role sidebar zgodne z PermissionGuard |
| **Redirect Chain** | 🟢 | 0 | 0 | Catch-all false positive naprawiony, brak pozostałych problemów |
| **Env Variable Drift** | 🟡 | 0 | 17 | 22 klucze dodane do .env.example; 11 unused + 6 missing (specyficzne dla platform) |

---

## 1. Route Parity Check — 🟡 0 ERR / 7 WARN

```
✅ All 11 sidebar links have matching routes (was: 6/11)
⚠️ 7 routes without sidebar entries:
   /owner/departments/:id/users           (DepartmentUsers sub-route)
   /owner/system/export                   (ExportCenter)
   /owner/system/leaderboards             (LeaderboardManager)
   /owner/system/rbac                     (RbacManager)
   /owner/system/api-playground           (ApiPlayground)
   /owner/system/feature-flags            (FeatureFlags)
   /owner/analytics/departments           (DepartmentAnalyticsPage)

Sidebar: 11 entries | Routes: 24 | Coverage: 11/11 sidebar ✅
```

**Naprawione:** Dodano 12 nowych routes (departments, departments/:id/users, analytics/events, analytics/sponsorship, analytics/vouchers, analytics/feedback, system/export, system/leaderboards, system/rbac, system/api-playground, system/feature-flags, analytics/departments). Systemowe trasy dostępne przez URL — sidebar można rozszerzyć w przyszłości.

---

## 2. Dead Screen Detection — 🟢 0 ERR / 0 WARN

```
All 30 module files imported somewhere
  analytics: 16 files  ✅
  anti-cheat: 1 files  ✅
  dashboard: 3 files   ✅
  departments: 2 files  ✅
  public: 1 files       ✅
  settings: 3 files     ✅
  sponsor: 1 files      ✅
  tenants: 1 files      ✅
  users: 1 files        ✅
  auth: 1 files         ✅ (LoginPage)

Orphans: 0 (was: 17)
```

**Naprawione:** Podłączono 17 orphan screenów:
- 8 jako nowe `<Route>` w App.tsx
- 5 wbudowanych w Dashboard.tsx (ActivityTimeline, AuditLog, TrendAnalysis, SystemHealth, ActivityDetail)
- 4 systemowe route (ExportCenter, LeaderboardManager, RbacManager, ApiPlayground)

---

## 3. Mobile Screen Parity — 🟢 0 ERR / 0 WARN

```
Expected in plan: 16
Found in screens/: 16
All planned screens present ✅
No extra screens ✅

Phase completion:
  ✅ Phase 1 (P0): 5/5 — RideDashboard, ActiveRideHUD, RideSummary, CityHub, ActivityDetail
  ✅ Phase 2 (P1): 5/5 — RidePaused, GlobalLeaderboard, Marketplace, AthleteProfile, TrainingLog
  ✅ Phase 3 (P2): 5/5 — Segments, ExploreMap, ClubsDirectory, PerformanceTrends, Settings + Onboarding
```

Brak uwag — mobile w pełni zgodny z planem architektury ekranów.

---

## 4. API Gap Analysis — 🟡 0 ERR / 45 WARN

```
FE calls: 30 (20 unique) → all matched to BE endpoints ✅
BE endpoints without FE consumer: 45

Key observations:
  - All 20 unique FE endpoints have BE counterparts
  - 45 BE-only endpoints are expected:
    · Wearables/OAuth: Strava (3), Garmin (3), sync (1) — mobile-only
    · Stripe webhooks: checkout, portal, webhook (4) — backend-only
    · Auth internal: token refresh/verify, password reset (5) — consumed via axios interceptor
    · Clubs/Challenges API (6) — future mobile features
    · Leaderboard multi-tenant API (4) — future competitive features
    · Infra health checks (3) — internal monitoring
    · User registration/password (5) — partially consumed
```

Brak błędów krytycznych. Wszystkie admin FE wywołania API mają backend.

---

## 5. RBAC Consistency — 🟢 0 ERR / 0 WARN

```
All 11 sidebar entries have consistent roles vs PermissionGuard ✅
6 permissions used across 20 routes:

  ✅ activities.approve    — AntiCheat, ModeratorWorklist
  ✅ activities.view       — Dashboard, ActivityDetail, EventsManager, BetaFeedback, SystemHealth, AuditLog, TrendAnalysis, ActivityTimeline
  ✅ poi.view              — SponsorDashboard, SponsorshipAnalytics
  ✅ users.edit            — WhiteLabel, Users, Settings
  ✅ users.view            — Users, Departments, DepartmentUsers
  ✅ vouchers.view         — SponsorDashboard, RewardsVouchers
```

**Naprawione:**
- AntiCheat: usunięto `TENANT_ADMIN` z roles sidebar (brak `activities.approve`)
- Działy: usunięto `TENANT_MODERATOR` z roles sidebar (brak `users.view`)
- Analytics/Sponsorship: tylko `GLOBAL_OWNER` (brak `poi.view` dla TENANT_ADMIN)
- Analytics/Vouchers: tylko `GLOBAL_OWNER` (brak `vouchers.view` dla TENANT_ADMIN)

---

## 6. Redirect Chain Audit — 🟢 0 ERR / 0 WARN

```
2 Navigate routes:
  ✅ * → /login              (unauthenticated fallback)
  ✅ * → /owner/dashboard    (authenticated fallback)

2 <Routes> blocks confirmed — auth branching, no ambiguity
No redirect loops or chains detected
```

**Naprawione:** Audyt rozpoznaje osobne `<Routes>` bloki dla authenticated/unauthenticated i nie flaguje jako duplikat.

---

## 7. Environment Variable Drift — 🟡 0 ERR / 17 WARN

```
.env.example keys: 86
Env vars in code: 81

11 unused in .env.example:
  DB_PASSWORD, POSTGRES_DB, POSTGRES_USER     — managed by DATABASE_URL in code
  CITUS_SHARD_COUNT, RLS_APP_ROLE             — hyperscale config (future)
  PRIVACY_DENSITY_*, REWARDS_POINTS_PER_KM    — used in Django settings via os.environ
  TRACCAR_DB_PASSWORD, VITE_TELEMETRY_*       — deprecated in favor of unified URLs

6 missing from .env.example:
  DYNO, RAILWAY_SERVICE_NAME, RENDER          — PaaS platform auto-set vars (not developer-facing)
  E2E_BASE_URL                                — Playwright test config (CI only)
  OAUTH_STATE_TTL                             — used in backend, should be documented
  DEPARTMENTS_ENABLED                         — already added (audit false positive)
```

**Naprawione:** Dodano 22 nowe klucze do `.env.example` (EXPO_PUBLIC_*, DEEPSEEK_*, GEMINI_*, TRACCAR_USER/PASS, ML_RETRAIN_*, GLOBAL_OWNER_*, ADMIN_*, ALLOWED_HOSTS, DATABASE_URL, TOKEN_ENCRYPTION_KEY, DJANGO_SUPERUSER_*).

---

## Metryki projektu

| Metryka | Wartość |
|---------|---------|
| Ekrany admin (pliki .tsx) | 30 |
| Ekrany admin (routowalne) | 20 |
| Ekrany admin (w sidebarze) | 11 |
| Ekrany mobile (pliki) | 16 |
| Ekrany mobile (zgodne z planem) | 16/16 |
| Orphan screens | 0 |
| Dead linki sidebar | 0 |
| RBAC mismatche | 0 |
| FE API endpoints (unikalne) | 20 |
| BE API endpoints | 82 |
| Env klucze w .env.example | 86 |
| Audyty w CI | `audit` job w `ci.yml` |
| Komenda | `npm run audit:all` (8 audytów) |

---

## Pliki audytu

| # | Skrypt | Typ |
|---|--------|-----|
| 1 | `scripts/audit-routes.ts` | Route Parity Check |
| 2 | `scripts/audit-screens.ts` | Dead Screen Detection |
| 3 | `scripts/audit-mobile-routes.ts` | Mobile Screen Parity |
| 4 | `scripts/audit-api-gaps.ts` | API Gap Analysis |
| 5 | `scripts/audit-rbac.ts` | RBAC Consistency |
| 6 | `scripts/audit-redirects.ts` | Redirect Chain Audit |
| 7 | `scripts/audit-env.ts` | Environment Variable Drift |
| 8 | `scripts/audit-dead-imports.ts` | Dead Import Detection |
| — | `admin/e2e/navigation-smoke.spec.ts` | E2E Navigation Smoke |
| — | `admin/e2e/routing-registry.spec.ts` | E2E Route Liveness Probe |

---

*Wygenerowano: 2026-05-16 | Podstawa prawna: Phase A Audit Suite*
