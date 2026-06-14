# 4VELO Mobile Full Vision — Implementation Spec (Active)

## Purpose

This document translates the full-vision mobile plan into implementation contracts for the repository. It is an execution SSOT for the mobile app rebuild and complements product/design ADRs.

## Execution snapshot (2026-06-14)

- Type gate: `pnpm exec tsc --noEmit` is green on mobile workspace.
- Regression pack: navigation, onboarding, HUD controls/status, telemetry storage/export, trigger engine, social auth env policy (targeted suites passing).
- Runtime hardening completed in code:
  - release-safe env fallback policy (`API`, `telemetry`, `social auth`) with `__DEV__`-only fallback,
  - navigation/deep-link contract alignment (`RideSummary` optional path param),
  - status/edge-state hardening for Ride/Profile/Detail surfaces.
- Remaining release blockers are operational, not code-level:
  - manual device QA matrix (Android/iOS),
  - cross-functional GO/NO-GO sign-off.

## Canonical sources (SSOT order)

1. `docs/design/DESIGN_SYSTEM_MOBILE.md`
2. `docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md`
3. `docs/pl/DATA_RESILIENCE.md`
4. `docs/adr/012-mobile-performance-budgets.md`
5. `docs/pl/CONSTITUTION.md`

## Operational hardening references

- `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
- `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md`

## Documentation drift to close

- Align `docs/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md` and `docs/pl/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md` status sections.
- Keep product brand naming as `4VELO` only.
- Keep one active stance on background tracking migration in operations docs.
- Keep ADR index in `docs/pl/README.md` updated through ADR 014.

## Target architecture contract (`mobile/src`)

- `app/`: shell composition, lifecycle orchestrators, auth and startup gates.
- `navigation/`: route params, deep links, tab/stack contract, header composition.
- `features/ride`: HUD, map, data fields, lifecycle and edge states.
- `features/compete`: city hub, quests, leaderboard, clubs and segments.
- `features/explore`: map POI and marketplace entry points.
- `features/profile`: athlete profile, trends, training log, settings.
- `components/ui`: reusable chrome primitives, cards, empty/loading/error states.
- `services/`: backend transport, retry, telemetry upload, persistence and integration adapters.
- `theme/` and `assets/`: tokenized visual system and runtime asset mapping.
- `hooks/`: cross-cutting runtime behavior (performance, motion, locale, theme).

## Navigation contract

- Primary tabs: `Ride`, `Compete`, `Explore`, `Profile`.
- Hidden runtime tab: `Tracking` for active ride HUD.
- Root stack overlays/modals: `Settings`, `RidePaused`, `RideSummary`, `GpsDiagnostics`.
- Root stack feature screens: `TrainingLog`, `ActivityDetail`, `ExploreMap`, `Marketplace`, `Clubs`, `Segments`, `PerformanceTrends`, `GlobalLeaderboard`.
- Deep links:
  - `fourvelo://ride/summary/:activityId`
  - `fourvelo://profile/activity/:activityId`
  - `fourvelo://explore/map`
  - `fourvelo://explore/marketplace`
  - `fourvelo://settings`

## Ride domain contract (full vision)

- Ride lifecycle: start, pause, resume, stop, summary handoff.
- Focus HUD with:
  - data grid layouts and profiles,
  - map layer and rider marker,
  - status bar (`GPS`, `battery`, `clock`),
  - stop confirmation interaction.
- Voice cues for eyes-free mode and reduce-motion compatibility.
- Telemetry durability:
  - MMKV buffer and outbox,
  - retry with backoff and `Retry-After` handling,
  - launch/manual recovery flows.
- Turn-by-turn staged delivery:
  - phase 1: route line + distance-to-next-maneuver cue,
  - phase 2: full maneuver cards.

## Engagement domains contract

- `Compete`: city wars, leaderboard, nearby quests, clubs/segments navigation.
- `Explore`: POI map and marketplace route.
- `Profile`: rider stats, trends, activity detail, global leaderboard, settings.
- Every domain must expose:
  - loading state,
  - empty state,
  - offline state,
  - recoverable error state.

## Design system unification contract

- UI components come from `components/ui` only.
- Legacy duplicates in `components/` remain wrappers during migration and must delegate to `components/ui`.
- Theme colors resolve from Stitch and Grand Prix tokens via `theme/*` (no ad-hoc palette literals in feature screens).
- Tab and chrome icons must come from `assets/*` runtime registries.
- Mobile i18n requires complete keys in both `strings.pl.ts` and `strings.en.ts`.

## Non-functional implementation gates

- Performance:
  - HUD min target 60 FPS, budget floor 55 FPS.
  - auto-degrade heavy motion when budget is exceeded.
- Security and privacy:
  - JWT in SecureStore,
  - no secrets in client bundles,
  - privacy zone support maintained in API contracts.
- Accessibility:
  - reduced motion respected by animated layers,
  - color + icon redundant status coding,
  - readable HUD contrast in day/night modes.
- Observability:
  - crash capture and performance violations forwarded via analytics.

## Verification and release gates

- Unit and integration coverage for:
  - navigation contracts,
  - lifecycle edge states,
  - retry and recovery paths.
- Maestro smoke flows:
  - auth,
  - ride lifecycle,
  - GPS recovery,
  - immersive theme.
- Release readiness:
  - no unresolved P0 regression in ride/auth/sync flows,
  - docs status synchronized between EN/PL for mobile scope.
