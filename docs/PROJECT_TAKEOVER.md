# 4VELO — project takeover

This is the operational starting point for a new owner. Product documents describe the intended platform; they are not proof that every feature is production-ready.

## What is in the repository

| Area | Technology | Primary path | First verification |
|---|---|---|---|
| API and domain model | Django, DRF, PostGIS, Celery | `backend/` | `python manage.py check` and backend tests |
| Telemetry ingest | FastAPI, Redis, PostgreSQL | `telemetry/` | telemetry pytest suite |
| Owner/admin UI | React, Vite, Mantine | `admin/` | lint, typecheck, tests, production build |
| Athlete app | Expo, React Native | `mobile/` | lint, typecheck and Jest |
| Shared contracts | pnpm workspace packages | `packages/` | token and OpenAPI drift checks |
| Runtime topology | Docker Compose, Railway, Kubernetes | `infrastructure/`, Compose files | configuration review, then a staging deployment |

## Safe first startup

1. Use Node 20 LTS, pnpm 9.15, Python 3.11/3.12 and Docker Compose 2.
2. Copy `.env.example` to `.env` and replace every `CHANGE_ME` used by the selected services.
3. Keep `RUN_DEMO_SEED=0` outside an isolated demo environment.
4. Start with `docker compose up -d` and inspect `docker compose ps` and service logs.
5. Run the quality commands below before changing product behavior.

The backend now creates an initial owner without a built-in password. Set a strong `ADMIN_PASSWORD`; if omitted, the one-time generated password is printed during first creation. Existing owner passwords are not reset on container restart.

## Quality baseline

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter admin lint
corepack pnpm --filter admin typecheck
corepack pnpm --filter admin test -- --run
corepack pnpm --filter admin build
corepack pnpm --filter mobile lint
corepack pnpm --filter mobile typecheck
corepack pnpm --filter mobile test -- --ci --runInBand
python scripts/check_docs_links.py
python scripts/check_openapi_drift.py
```

Backend and full-stack checks require PostgreSQL/PostGIS and Redis; use the CI workflow or Docker Compose rather than silently replacing them with SQLite.

## Verified takeover progress — 2026-09-10

The following work is merged into `main` and backed by repository history and CI results:

| Area | Evidence | Verified result |
|---|---|---|
| Safe backend startup | PR #34 | Demo seeding is opt-in, existing owner passwords are not reset and the backend uses an explicit container entrypoint |
| Repository inventory | PR #37 | Component, dependency, infrastructure and documentation map recorded in `docs/reports/REPOSITORY_MAP.md` |
| Quality command inventory | PR #38 | Commands and environment-dependent blockers recorded in `docs/reports/QUALITY_COMMAND_MATRIX.md` |
| Risk and ownership inventory | PR #39 | Prioritized evidence register and owner decisions recorded in `docs/reports/RISK_AND_OWNERSHIP_MAP.md` |
| Telemetry authentication | PR #43 and PR #53 | Required JWT configuration fails closed and telemetry uses PyJWT 2.13.0 |
| Dependency and tenant hardening | PR #49, PR #52 and PR #54 | Pillow and Django security updates merged; user administration has explicit tenant-boundary tests |
| Playwright lifecycle | PR #45 | Preview server is managed by Playwright; the job has a 45-minute limit and each E2E phase has a 15-minute global limit |
| Admin cleanup | PR #56 | Unused admin code removed; ESLint, unit tests, TypeScript, production build and Playwright E2E passed before merge |

The final PR #56 verification included 23 passing application E2E tests and 8 passing Live Map/WebGL tests. The earlier run lasting more than an hour was not accepted as normal: lifecycle management, bounded timeouts, stale navigation selectors and locale-dependent map assertions were corrected before merge.

This progress does **not** prove production readiness. In particular, it does not verify production secret rotation, provider-managed backups, restore time, production telemetry flags, external account ownership or a monitored staging release.

### Next takeover tranche

1. Reconcile the open dependency/security inventory with direct runtime dependencies; fix critical and high findings in isolated PRs.
2. Verify production configuration without exposing values: telemetry JWT enforcement, allowed origins, demo flags and secret ownership.
3. Perform an isolated PostGIS backup-and-restore exercise and record measured RPO/RTO evidence.
4. Run the critical staging journey: sign in, record or synchronize an activity, ingest telemetry and review it in admin.
5. Select Railway or Kubernetes as the primary production path and mark the other path experimental until it has an owner and release gate.
6. Continue small code cleanups by module, preserving behavior and requiring lint, typecheck, unit tests, build and relevant E2E checks before merge.

## Current takeover risks

| Priority | Risk | Owner action |
|---|---|---|
| P0 | Production credentials and third-party accounts are external to Git | Rotate and inventory Railway, Expo, Firebase, map, email, payments, Strava and Garmin access before release |
| P0 | Product documentation contains unverified maturity and scale claims | Treat load-test reports as evidence only when raw results and target configuration are reproducible |
| P0 | Demo and production data paths were previously coupled | Keep demo seeding opt-in and verify production does not set `RUN_DEMO_SEED=1` |
| P1 | The repository contains hundreds of documents and many historical screenshots | Preserve evidence, but move stale material out of the active navigation in a dedicated cleanup change |
| P1 | Backend startup runs migrations automatically | Adopt a single-release migration job before horizontal production scaling |
| P1 | Mobile, admin and root React versions must remain aligned through workspace overrides | Upgrade only with Expo compatibility checks and a clean lockfile install |
| P2 | Railway and Kubernetes configurations coexist | Select one production deployment model and mark the other experimental or archival |

## Recommended ownership order

1. Establish a green local/CI baseline.
2. Inventory secrets, cloud services, domains, stores and billing ownership.
3. Verify one critical user journey end to end: sign in, record/sync activity, telemetry ingest, admin review.
4. Verify backup and restore before load testing.
5. Reduce active scope to a release candidate; postpone optional AI, large-scale simulation and secondary deployment targets until the core journey is stable.

## Definition of “production-ready”

A README claim is not sufficient. A capability is production-ready only when it has an owner, automated acceptance test, monitored staging deployment, rollback procedure and current runbook. Record exceptions explicitly in the release checklist.
