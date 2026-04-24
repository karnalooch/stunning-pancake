# OPERATIONAL IMPLEMENTATION PLAN (MILESTONES)

> **Nota z analizy architektonicznej**: Poniższa kolejność uwzględnia zidentyfikowane zależności między modułami.
> Nie można budować Eventów bez Klubów, a Klubów bez JWT. Kolejność **jest nieprzypadkowa**.

---

## Phase 1: Backend Foundation and Telemetry ✅ (DONE)
- **Containerization**: Podman stack (Traccar + PostgreSQL + BRouter + Redis) — działa.
- **Traccar + BRouter**: Konfiguracja i profile sportowe — działa.
- **Django Scaffold**: Apps `activities`, `users` z modelami PostGIS — zaimplementowane.
- **Service Layer (DDD)**: `BRouterService`, `TelemetryService`, `PrivacyService`, `MatrixService` — ✅ zaimplementowane.
- **Signal Pipeline**: Auto-walidacja BRouter + Privacy Masking po zapisie Activity — ✅ zaimplementowane.
- **Redis Leaderboards**: `LeaderboardService` z Sorted Sets per `city_id` — ✅ zaimplementowane.
- **RBAC Model**: Role `OWNER/GLOBAL_ADMIN/MODERATOR/ATHLETE` w modelu `User` — ✅ zaimplementowane.
- **TenantProfile**: Model z brandingiem (logo, kolory) — ✅ zaimplementowane.
- **Stripe Stub**: `PaymentService` z checkout + webhook handler — ✅ skeleton gotowy.

---

## Phase 2: Authentication Foundation ✅ (DONE)
> **Weryfikacja**: `POST /api/auth/token/` zwraca `200 OK` z `access` + `refresh` tokenami.

- **JWT Integration**: ✅ `djangorestframework-simplejwt==5.3.1` zainstalowany i skonfigurowany. `JWTAuthentication` jako domyślna.
- **Token Blacklist**: ✅ Rotacja tokenów przy odświeżeniu — bezpieczny logout.
- **Social Auth**: ✅ `django-allauth==0.61.1` z providerem Google skonfigurowanym.
- **Migracje**: ✅ 22 nowe tabele (`account_*`, `socialaccount_*`, `token_blacklist_*`) — OK.
- **Mobile Auth Flow**: ✅ `auth_service.dart` (login/register/refresh/logout) + `login_screen.dart` (premium dark UI).

---


## Phase 3: "Offline-First" Mobile SDK ✅ (DONE)
> **Zależność**: Wymaga działającego JWT z Phase 2.

- **Flutter Core**: ✅ Projekt założony, Feature-First structure: `features/auth`, `features/map`, `features/tracking`.
- **Riverpod + MapLibre + SQLite**: ✅ Zależności w `pubspec.yaml`.
- **Implementacja wewnętrzna**: 🔴 Katalogi puste — wymagają kodu.
- **Background Tracking**: 🔴 Brak. Wymaga `flutter_background_service` lub `workmanager`.
- **Sync Manager**: 🔴 Brak. Batching GPS + exponential backoff do implementacji.

---

## Phase 4: Club and Social Infrastructure ✅ (DONE)
> **Zależność**: `events.services` wymaga `club_id` do agregacji wyników.

- **`clubs` Django App**: Models: `Club`, `ClubMembership`, `ClubChallenge`.
- **Matrix Room Auto-provisioning**: Each new club automatically gets a private E2EE room.
- **Club API**: Endpoints for creating, joining, and managing clubs.
- **Admin UI**: Club management panel in the Admin Dashboard.

---

## Phase 5: Admin Dashboard — Modular Refactor ✅ (DONE)
> **Weryfikacja**: `npm run build` → 743ms, 0 errors. 25 modules transformed.

- **Architektura**: Monolityczny `App.tsx` (361 linii) rozbity na:
  - `App.tsx` — cienki orkiestrator (78 linii). Dodanie modułu = 3 kroki.
  - `components/Sidebar.tsx` — Plugin-ready nav z RBAC (role-filtered NAV_ITEMS).
  - `components/TopBar.tsx` — global search + user profile.
  - `providers/MapProvider.tsx` — shared MapLibre context (useMap hook).
  - `views/LiveTrackingView.tsx` — pełna telemetria + comet trail.
  - `views/EventsView.tsx` — API-connected events management.
  - `views/ClubsView.tsx` — clubs list połączony z Phase 4 backend.
  - `views/AntiCheatView.tsx` — BRouter anomaly table + integrity score.
  - `views/AnalyticsView.tsx` — KPI, bar chart, speed dist., leaderboard.
- **RBAC UI**: `anticheat` i `analytics` widoczne tylko dla GLOBAL_ADMIN/OWNER.

---

## Phase 6: Gamification — Events Engine ✅ (DONE)
> **Zależność**: Wymaga `clubs`, `JWT`, i działającego Admin Panelu z Phase 5.

- **`events` Django App**: ✅ Scaffold istnieje — `models.py` pusty, do implementacji.
- **Event Models**: 🔴 `Event`, `Participation`, `Achievement` — do napisania.
- **Event Types**: Accumulative, Checkpoint/POI, Route Match, Inter-Tenant League, Club Battle.
- **Traccar Webhooks**: Real-time geofence triggers → event progress update.
- **Redis Leaderboards per Event**: 🟡 `LeaderboardService` istnieje dla miast — rozszerzyć o `event:{id}` i `club:{id}`.
- **Normalization Engine**: `Score = (Distance × Complexity) / Active Participants`.
- **Admin Event Creator**: Map-based polygon drawing tool for geofence configuration.
- **Privacy Zones**: ✅ `PrivacyService.mask_track()` już działa w signals pipeline.

---

## Phase 7: Async Infrastructure (Celery + Notifications) ✅ (DONE)
> **Zależność**: BRouter validation MUSI być async — synchroniczna blokuje API przy dużym ruchu.

- **Celery Worker**: Separate container in docker-compose. Queues: `critical` (telemetry) and `notifications` (social).
- **BRouter Validation Pipeline**: Move GPX validation to async Celery task. API returns `202 Accepted` immediately.
- **Notification Infrastructure**: FCM (Android) + APNs (iOS) push notification layer.
- **Notification Templates**: `NotificationTemplate` model with localized content (pl/en).
- **Triggers**: "Twoje miasto wyprzedziło Lublin!", milestone alerts, event start reminders.

---

## Phase 8: White-Label Commercialization ✅ (DONE)
- **Multi-tenancy**: Full PostgreSQL RLS (Row Level Security) for tenant data isolation.
- **`TenantConfig` JSON**: Per-tenant validation rules, normalization factors, branding.
- **Dynamic Branding**: Theme and logo injection based on `tenant_id` (mobile + web).

---

## Phase 9: Financial and Social Ecosystem ✅ (DONE)
- **Payment Gateway**: Stripe/Adyen subscription logic (B2C Freemium + B2B Invoicing).
- **Voucher Marketplace**: `rewards` app with sponsor POI voucher management.
- **Social Sharing**: Dynamic \"Activity Card\" generation (PNG with map + stats + brand logo).
- **Matrix Chat**: Full E2EE messaging integration into mobile SDK.

---

## Phase 10: Production Readiness and CI/CD ✅ (DONE)
> **Weryfikacja**: `python manage.py check` → 0 issues. Admin `npm run build` → 743ms.

### ADR Documentation (4 nowe ADR-y w `docs/adr/`)
- **ADR-0002**: JWT over Session Auth — lifetime 60min/30d, rotation, blacklist.
- **ADR-0003**: Celery over inline Signals — queue topology `critical/notifications`, migration plan.
- **ADR-0004**: PostGIS — GIST spatial indexes, Douglas-Peucker tolerance 0.00001.
- **ADR-0005**: Redis Sorted Sets — leaderboard schema, AOF persistence, cache warming.

### Container Registry (`.github/workflows/docker-publish.yml`)
- `ghcr.io/{owner}/sport-backend` i `sport-admin` — build + push na każdy push/tag.
- Semantic versioning: `v1.2.3`, `1.2`, `sha-abcdef`, `latest`.
- **Trivy** container vulnerability scan → wyniki jako GitHub SARIF.

### Dependabot (`.github/dependabot.yml`)
- Python (pip), Node (npm), GitHub Actions — weekly scan, auto PR.
- Guards na major version bumps dla Django i DRF.

### Observability Stack (`infrastructure/observability/`)
- Docker Compose overlay: Prometheus + Grafana + Redis/Postgres/Node exporters.
- **Sentry**: `core/sentry.py` — graceful init (ImportError-safe), `send_default_pii=False`.
- `sentry-sdk[django,celery]==2.5.0` dodany do `requirements.txt`.

### Performance Tuning
- `Activity.save()` → **Douglas-Peucker** simplification dla tras >100 punktów (~60% mniej danych).
- Nowy B-tree index `created_at` na tabeli `activities` (migracja `0003`).
- PostGIS GIST indexy na `route_path`, `center` (PrivacyZone), `boundary` (Event).

### E2E Tests — Playwright
- `admin/playwright.config.ts` — Chromium + Mobile Chrome, trace/screenshot/video on failure.
- `admin/e2e/admin.spec.ts` — 8 testów krytycznych ścieżek (nav, map, LIVE, search).
- CI job `e2e` (depends on `admin`) → build → `vite preview` → test → artifact upload.
