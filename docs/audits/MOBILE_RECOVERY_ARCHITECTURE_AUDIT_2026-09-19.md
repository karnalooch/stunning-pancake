# 4VELO Mobile Recovery Architecture Audit — 2026-09-19

> **Status:** DRAFT / evidence document  
> **Tracker:** #149, #151  
> **Scope:** mobile application architecture and presentation/runtime boundary  
> **Normative visual authority:** `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` and `MOBILE_UI_DESIGN_CONTRACT_V1.md` remain authoritative.  
> **Important:** this document does not authorize package-id migration or deletion of legacy code.

## 1. Why this audit exists

A manual emulator pass on 2026-09-19 failed visual/runtime sign-off. The observed build showed multiple legacy visual artifacts, a broken/empty Explore state, and no usable transition after tapping Start Ride.

Static repository inspection then showed that the mobile problem is broader than one screen:

1. takeover-era Frozen UI v1.2 primitives coexist with legacy arcade/pixel presentation;
2. Vision fixtures mostly replace displayed data, not the ride execution environment;
3. presentation screens frequently import transport/storage/domain services directly;
4. navigation, sharing, ride lifecycle, dev fixtures and feature orchestration are concentrated in a small number of bootstrap files;
5. current CI/audit checks can pass without proving the critical user journey in a fresh emulator runtime.

Runtime recovery is tracked separately in #150. This audit defines the migration boundary for #152/#153.

## 2. Current boot path

Committed entry path:

```text
mobile/index.ts
  -> security/installRedaction
  -> theme/unistylesSetup
  -> App.tsx
      -> useAuthSession
      -> useRideLifecycle
          -> rideSessionService
          -> GpsSyncManager
          -> gpsEncryptedStorage
              -> expo-crypto
              -> expo-secure-store
              -> react-native-mmkv
      -> NavigationShell
```

The import order in `index.ts` is intentional and should be preserved: privacy redaction and Unistyles configuration happen before the main UI dependency graph.

## 3. Dependency/install finding

Repository state on main:

- root package manager: `pnpm@12.4.2`;
- Node contract: `>=24.21.0 <25`;
- workspace uses hoisted linking;
- `mobile/package.json` directly declares `expo-crypto ~55.0.19`;
- `pnpm-lock.yaml` resolves `expo-crypto 55.0.19` in the mobile importer.

Therefore the local Metro error `Unable to resolve module expo-crypto` must not be treated as evidence that the dependency is absent from manifests. #150 must first prove the physical install tree and a fresh frozen install.

## 4. KEEP / REBUILD / DELETE-LATER matrix

| Area | Decision | Evidence / reason |
|---|---|---|
| `mobile/index.ts` bootstrap ordering | **KEEP concept** | Redaction + Unistyles setup before App is a sound bootstrap contract. |
| `App.tsx` orchestration | **REBUILD** | Owns updates, fonts, auth, ride lifecycle, onboarding, sound, theme/night and navigation branching in one composition. |
| `useAuthSession` behavior | **KEEP behavior / REHOME integration** | Real session, OAuth, profile and onboarding behavior is valuable; new AppRoot should depend on an auth boundary rather than embedding all orchestration. |
| API client/service layer | **KEEP** | Existing request, token, endpoint and typed service behavior remains useful. |
| ride/GPS/durability services | **KEEP** | Data safety, encrypted storage, outbox, background tracking and finalization are independently valuable. Wrap behind a ride-controller interface. |
| `NavigationShell.tsx` | **REBUILD** | Navigation, sharing, monitoring, fixture routes and feature callbacks are mixed together. |
| route types / route paths | **KEEP intent / REWRITE composition** | Primary IA remains Ride, Compete, Explore, Profile. |
| hidden `Tracking` bottom tab | **REBUILD** | Active Ride should be outside ordinary browsing, not a hidden tab filtered from the tab bar. |
| Frozen semantic colors | **KEEP** | Correct takeover-era direction. |
| Frozen product typography | **KEEP** | Correct separation between routine product type and specialist pixel type. |
| `components/product/*` | **KEEP / extend** | Modern semantic primitives do not depend on arcade UI. |
| current screen implementations | **REBUILD presentation** | Most remain legacy, service-coupled or incomplete. |
| `RideMapView`, ride data/status/action concepts | **KEEP contracts / audit presentation** | Active Ride contract explicitly retains functional map/data/control concepts. |
| Vision fixture data singleton | **REBUILD** | Display fixtures do not isolate execution; Start Ride still crosses real API/GPS/storage. |
| `PixelText`, `ArcadeButton`, `GameCard`, routine `OrnateFrame` | **DELETE-LATER / specialist only** | Frozen UI forbids these as routine product chrome. |
| `GameTabBar` | **DELETE-LATER after replacement** | Uses legacy pixel typography/visual model and hidden tracking-tab pattern. |
| `SceneBackground` abstraction | **REVIEW / specialist only** | Scenic brand art is allowed on selected surfaces, but legacy generated assets are not approved visual authority. |
| legacy generated scenes/sprites as visual target | **DELETE-LATER / do not reuse as target** | Current authority marks old generated asset inventory as non-normative/unapproved. |
| `com.sport.athlete` native identity | **KEEP TEMPORARILY** | Rename requires a separate controlled native/EAS/store/credentials decision. |

## 5. Navigation inventory

Registered destinations in the current shell:

### Main tabs

- Ride
- Compete
- Explore
- Profile
- Tracking (hidden from the rendered tab bar)

### Root stack

- MainTabs
- Settings
- TrainingLog
- GpsDiagnostics
- Clubs
- Segments
- ExploreMap
- Marketplace
- ActivityDetail
- PerformanceTrends
- GlobalLeaderboard
- RidePaused
- RideSummary
- VisionGallery

The route set itself is not the main problem. The problem is the composition and responsibility boundary.

### Critical ride route

```text
RideDashboardScreen
  -> NavigationShell.handleStartRide
  -> useRideLifecycle.handleStartRide
  -> startRideSession
  -> ActivityService.createSession
  -> GpsSyncManager.startTracking
  -> encrypted storage + foreground/background location
  -> navigate MainTabs/Tracking only after success
```

The Start Ride button is statically wired. The manual no-op cannot yet be attributed to a missing `onPress`; #150 must establish which fresh bundle is actually running and which runtime dependency fails.

## 6. Fixture boundary failure

`EXPO_PUBLIC_VISION_FIXTURES=true` currently changes items such as:

- bypassing auth/onboarding;
- rider/profile data;
- city hub data;
- activity history;
- leaderboard data;
- Home preview values.

It does **not** replace:

- activity session creation;
- encrypted GPS storage bootstrap;
- location permissions;
- background tracking;
- finalization.

This makes the visual harness non-deterministic for the most important interaction.

### Required replacement

```text
RideController
  ├── ProductionRideController
  │     -> existing ride/GPS/durability services
  └── VisionRideController
        -> deterministic in-memory state machine
```

Both adapters must implement the same interaction contract so visual/smoke tests traverse the real navigation behavior without requiring live GPS/API.

## 7. Presentation-to-service coupling

Current direct dependencies include:

- Onboarding -> AuthService, DepartmentService, EventService, Expo Location;
- CityHub -> ActivityService, OfflineCacheService;
- AthleteProfile -> AuthService;
- TrainingLog -> ActivityService;
- Settings -> PrivacyService, WearableService, RiderPreferencesService;
- ExploreMap -> POIService;
- ActivityDetail -> ActivityService, OfflineCacheService;
- PerformanceTrends -> ActivityService, OfflineCacheService;
- GlobalLeaderboard -> ActivityService, OfflineCacheService;
- Marketplace -> RewardsService.

New shell dependency direction:

```text
screen
  -> feature hook/controller
  -> repository/controller interface
  -> production or deterministic adapter
  -> existing services
```

New feature screens must not import GPS managers, raw API clients, MMKV or SecureStore.

## 8. Duplicate/legacy UI systems

### Confirmed duplicate button concept

`OnboardingScreen.tsx` defines a local `PrimaryButton` implementation while the repository also contains the takeover-era `components/product/PrimaryButton.tsx`.

### Legacy presentation remains widespread

Examples include:

- `PixelText`;
- `ArcadeButton`;
- `GameCard`;
- `OrnateFrame`;
- pixel display fonts in routine labels/metrics;
- hard pixel shadows;
- legacy scene/sprite composition.

This is not prevented by the current screen-token guard. The guard protects raw colors and product primitives, but it does not claim that all existing screens have migrated.

## 9. Safe-area inconsistency

Safe-area policy differs across screens.

Examples:

- RideDashboard uses `SafeAreaView edges={[]}`;
- some screens use top-only safe area;
- Active Ride uses top+bottom;
- several primary tab screens rely on custom headers/views.

The manual pass showed status-bar overlap. The rebuilt shell needs a canonical screen/layout primitive with explicit edge ownership.

## 10. Screen-specific findings

### Onboarding

- direct network/domain calls inside the screen;
- direct Expo Location usage;
- legacy scene/sprite art;
- duplicate local PrimaryButton.

**Decision:** rebuild presentation and move orchestration behind an onboarding controller.

### Home

The takeover-era #147 work moves Home toward Frozen UI primitives, but the manual sign-off cannot be accepted until #150 proves the fresh runtime and #152 provides a deterministic ride adapter.

**Decision:** reuse useful T79 work selectively inside the new feature boundary; do not merge the current PR merely because static CI is green.

### Active Ride

The existing map/data/status/action concepts align with the product contract better than most legacy screens.

**Decision:** preserve functional components and lifecycle contracts, rebuild composition/typography/control hierarchy in the first vertical slice.

### Ride Summary

Current presentation assumes success. It does not model pending/failure as distinct summary states.

**Decision:** rebuild around explicit finalization truth.

### Compete

`CityHubScreen` mixes API loading, retry, cache, fixtures, game progression, haptics, legacy scene/chrome and navigation callback behavior.

**Decision:** split controller/data from presentation before visual rebuild.

### Explore

`ExploreHubScreen` is a CTA/card landing surface.
`ExploreMapScreen` renders a POI list with coordinates; it does not render a functional map.

Frozen UI requires Explore to be map-first.

**Decision:** full feature rebuild after Ride slice.

### Profile

Mixes API fetch, rider stats, game progression, client-derived achievements and legacy RPG-like presentation.

**Decision:** rebuild presentation; keep real stats/data contracts.

### Segments

Contains unconditional local production-looking rows such as Riverside Dash / Lookout Peak / ShadowRider / AeroQueen.

**Decision:** remove hard-coded production-looking data during feature rebuild; fixtures must be explicit and gated.

### Clubs

Current screen always renders an empty state.

**Decision:** treat as incomplete feature surface, not visual-complete UI.

## 11. Critical ride-finalization truth defect

Current `useRideLifecycle.handleStopRide()` can set a non-null ride summary from its `finally` block whenever distance > 0 even when:

- uploads remain pending;
- finalization returned false;
- stop/finalization threw.

`NavigationShell` navigates to `RideSummary` whenever summary becomes non-null, and the current `RideSummaryScreen` always fires success haptics/celebration.

This violates the Frozen UI rule that full celebration is allowed only after durable success.

Tracked separately in #154.

### Required terminal model

```ts
type RideFinishState =
  | { kind: 'durable-success'; summary: RideSummary }
  | { kind: 'pending-finalization'; summary: RideSummary }
  | { kind: 'recovery-required'; summary?: RideSummary; reason: string };
```

The route and Summary UI must render from this truth state.

## 12. CI/audit gaps

### `scripts/audit-mobile-routes.ts`

Checks that planned screen filenames exist. It does not prove:

- reachability;
- CTA behavior;
- navigation result;
- dependency resolution;
- emulator runtime behavior.

### `scripts/audit-screens.ts`

Audits admin module imports, not mobile screens.

### T79 visual tests

Useful for static visual contract protection, but source-string/testID presence cannot prove Start Ride works in a fresh runtime.

### Required T80 gates

- frozen root install;
- fresh Metro bundle;
- exact tested tree/SHA evidence;
- route/interaction tests;
- deterministic Vision ride state machine;
- emulator smoke flow;
- manual screenshots from the exact tested runtime.

## 13. Native identity finding

Expo display name is 4VELO while both native identifiers remain:

```text
Android: com.sport.athlete
iOS:     com.sport.athlete
```

The repository also has an existing EAS project id and update configuration.

Changing the identifiers can change native installation identity and distribution/signing/store continuity assumptions and may require corresponding Google/Firebase configuration changes.

**Decision:** do not rename during runtime recovery. Produce a separate migration decision before pilot release.

## 14. Target architecture

```text
mobile/src/
  app/
    AppRoot.tsx
    providers/
    navigation/

  features/
    ride/
      controller/
      adapters/
      screens/
      components/
    onboarding/
    compete/
    explore/
    profile/

  ui/
    primitives/
    feedback/
    layout/

  theme/
  services/
  domain/
  fixtures/
```

Dependency direction:

```text
AppRoot
  -> providers
  -> navigation
  -> feature screens
  -> feature interfaces/controllers
  -> adapters
  -> existing services/domain
```

## 15. First implementation slice

Only this flow is required for the first clean-shell milestone:

```text
Launch
 -> Home
 -> Start Ride
 -> Active Ride
 -> Pause
 -> Resume
 -> Finish
 -> Summary
 -> Home
```

Compete, Explore, Profile and secondary screens remain on the legacy shell until migrated in later isolated slices.

## 16. Remaining evidence before this audit can be marked complete

1. #150 local frozen-install + fresh-Metro proof;
2. exact local `useRideLifecycle.ts` temporary-diff decision;
3. local orphan/import scan against the checked-out worktree;
4. runtime confirmation of which bundle/branch produced the manual screenshots;
5. separate package-id migration decision before native identifier changes.

