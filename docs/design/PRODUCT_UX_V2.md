# 4VELO Product UX v2 — Current UI Authority

| | |
|---|---|
| **Status** | **APPROVED / NORMATIVE / CURRENT** |
| **Decision date** | 2026-09-28 |
| **Owner role** | Product / Mobile / Admin Frontend |
| **Tracks** | GitHub Issue #346 (authority) · #348 / PR #349 (mobile UI-1) |
| **Machine mobile authority** | `MOBILE_UI_VISUAL_AUTHORITY_V1.json` (legacy path retained for validator compatibility; `currentAuthority` points here first) |
| **Applies to** | 4VELO mobile UI and 4VELO CONTROL (admin/web) information architecture, shell, visual language and legacy retirement |
| **Supersedes for UI direction** | `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` hard-freeze direction, Frozen UI v1.2 intent, dated mobile UI audits and the current admin shell/IA descriptions where they conflict |

## 1. Decision

4VELO is keeping its product capabilities and cycling character, but the current UI is no longer a protected structure.

The migration is a **controlled teardown and replacement of the presentation layer**:

- preserve backend/API/auth/GPS/telemetry/ride-domain contracts unless a separate task explicitly changes them;
- preserve useful product capabilities;
- replace shell, navigation, routine visual primitives and screen composition where the current UI blocks the new product direction;
- delete legacy UI only after its consumers have been migrated and verified;
- do not preserve a screen, route or component merely because it exists today.

This explicitly replaces the previous default of **preserving the current mobile IA**.

## 2. Shared brand DNA

Mobile and CONTROL should feel related without looking identical.

Keep:

- deep navy / ink as structural colour;
- orange as the primary action / energetic accent;
- warm cream/parchment where it strengthens identity;
- cycling, route, city and rider imagery;
- restrained pixel-art accents for identity, achievements, celebration and selected branded moments.

Retire as default UI grammar:

- arcade/game-shell framing;
- pixel fonts for routine labels, navigation, metrics, forms or settings;
- thick black outlines and hard offset shadows on ordinary controls/cards;
- decorative cards used where a simple list, map, table or data row is clearer;
- visual effects whose only purpose is to make a utility screen look “premium”.

The product should read first as a **serious cycling/outdoor platform**, with recognisable 4VELO character layered on top.

## 3. Mobile information architecture v2

The primary mobile shell is:

1. **Today** — current context, ride readiness, recent/ongoing activity, training/recovery context and one clear path into riding.
2. **Discover** — map-first discovery: routes, segments, places, events and nearby/community context. Do not require an intermediate “hub” screen merely to reach the map.
3. **Start Ride** — dominant ride entry. Sport/profile selection and ride readiness belong here; the live ride itself leaves the normal tab-shell mental model.
4. **Club** — clubs, city/community identity, challenges, leaderboards and social competition.
5. **You** — profile, progress, history, trends, equipment, preferences and account actions.

### 3.1 Live ride flow

Live ride is a focused operational flow, not a normal content tab:

`Start Ride -> Active Ride -> Summary`

Pause/recovery should be expressed as ride-state overlays/sheets where safe instead of separate product destinations.

The live ride must remain:

- map/data first;
- sunlight readable;
- one-hand operable;
- explicit about GPS/sync/recovery state;
- conservative about motion and decoration.

## 4. Mobile legacy disposition

This is a migration contract, not permission to delete files blindly.

| Current surface | v2 decision | v2 home |
|---|---|---|
| `RideDashboardScreen` | **REPLACE / harvest useful modules** | Today + Start Ride |
| `GameTabBar` | **REPLACE** | Product bottom navigation v2 |
| `CityHubScreen` / Compete | **MERGE / RECOMPOSE** | Club |
| `ExploreHubScreen` | **DELETE after migration** | Discover opens useful discovery/map content directly |
| `ExploreMapScreen` | **KEEP / REDESIGN** | Discover |
| `AthleteProfileScreen` | **REPLACE / RECOMPOSE** | You |
| `TrainingLogScreen` | **MERGE** | You -> Progress/History |
| `PerformanceTrendsScreen` | **MERGE** | You -> Progress |
| `GlobalLeaderboardScreen` | **MOVE** | Club |
| `ClubsDirectoryScreen` | **MERGE** | Club |
| `SegmentsScreen` | **MOVE / MERGE** | Discover and/or Club depending on context |
| `GpsDiagnosticsScreen` | **DEMOTE** | Start Ride / Settings -> Advanced diagnostics |
| `ActiveRideHUDScreen` | **KEEP domain / REDESIGN chrome** | Live ride flow |
| `RidePausedScreen` | **DELETE when overlay parity exists** | Active Ride pause sheet/overlay |
| `RideSummaryScreen` | **KEEP domain / REDESIGN** | End of live ride flow |
| `SettingsScreen` | **KEEP capability / REDESIGN** | You -> Settings |
| `MarketplaceScreen` | **MERGE / REHOME** | Discover/Club/You based on actual product purpose |
| `VisionGalleryScreen` and fixture-only visual surfaces | **REMOVE from product navigation** | test/dev tooling only if still required |

## 5. 4VELO CONTROL information architecture v2

The desktop/admin product is renamed in UI language to **4VELO CONTROL**.

Target top-level IA:

1. **Overview** — operational summary and exceptions that need attention.
2. **Riders** — people, identity, account status, tenant membership and support actions.
3. **Rides** — activities, moderation context, ride details and operational review.
4. **Map** — live/operational geospatial view and simulator-related map workflows.
5. **Community** — clubs, cities, challenges, leaderboards and community moderation.
6. **Events** — event lifecycle and participation operations.
7. **Content** — product content and configurable presentation/content surfaces.
8. **Trust** — anti-cheat, moderation, audit and safety/security operator workflows.
9. **Business** — tenants, branding, sponsors, vouchers/rewards and commercial configuration.
10. **System** — platform configuration, integrations, diagnostics and privileged system tools.

### 5.1 CONTROL principles

- functionality is not removed merely because the old navigation grouping is removed;
- RBAC remains authoritative and must be enforced at route/action level, not just hidden in navigation;
- dashboards exist to support operator decisions, not to showcase decorative KPI cards;
- tables, search, filters, bulk actions, maps and clear status are preferred over animated “premium” chrome;
- destructive and privileged actions must remain explicit and auditable;
- desktop density may be higher than mobile density, but hierarchy must remain obvious.

## 6. Legacy retirement rules

Every legacy surface must be classified as **KEEP, MERGE, REPLACE or DELETE** before removal.

A legacy file/component may be deleted only when all applicable checks are true:

1. repository search confirms **0 runtime consumers** outside tests/fixtures intentionally being removed;
2. routes/deep links have a defined replacement or are deliberately retired;
3. required behaviour has migrated;
4. relevant unit/integration/E2E tests pass;
5. mobile route/screen audits or admin route/RBAC audits still pass as applicable;
6. docs no longer instruct users/operators to use the removed surface;
7. final diff is checked for dead imports and stale assets.

Do not keep compatibility wrappers indefinitely. If a wrapper exists only to bridge a migration, give it an explicit removal condition.

## 7. Migration sequence

### UI-0 — authority and inventory

- establish this document as the current UI authority;
- mark conflicting frozen/snapshot documents as superseded or historical;
- maintain a real legacy disposition from current code.

### UI-1 — shells

Mobile implementation is tracked in **#348 / PR #349**:
- replace `GameTabBar`;
- establish Today / Discover / Start Ride / Club / You route contract;
- make Discover map-first and retire the intermediate Explore hub;
- keep live ride behaviour intact while changing entry/navigation.

CONTROL:
- replace old sidebar grouping with the v2 CONTROL IA;
- preserve all current RBAC and route capabilities.

### UI-2 — primary flows

**Implementation tracking:** Today / Start Ride separation is delivered by GitHub Issue #354 / PR #356. Club recomposition is delivered by Issue #358 / PR #359. You recomposition is tracked by Issue #360 / PR #361.

- Today and Start Ride;
- Discover map-first flow;
- Club;
- You;
- CONTROL Overview, Riders, Rides and Map.

### UI-3 — secondary flows

- progress/history/trends;
- settings and diagnostics;
- events/content/trust/business/system;
- remaining utility screens.

### UI-4 — retirement

- delete zero-consumer legacy screens/components/assets;
- remove compatibility aliases;
- update visual baselines and E2E navigation expectations.

## 8. Non-negotiable preserved contracts

This UX decision does not itself authorise changes to:

- authentication/session semantics;
- backend/API schemas;
- GPS capture, buffering or recovery;
- telemetry ingest and retry guarantees;
- ride start/stop data integrity;
- RBAC/tenant isolation;
- audit logging;
- release/native provenance gates;
- accessibility and reduced-motion obligations.

Any such change requires its own scoped issue and evidence.

## 9. Acceptance criteria

The migration is complete when:

- mobile primary navigation exposes **Today / Discover / Start Ride / Club / You**;
- the live ride is a focused flow outside ordinary content navigation;
- no intermediate legacy hub exists only to forward the user to the real task;
- routine typography and controls are modern and legible;
- pixel art remains recognisable but specialist;
- CONTROL navigation matches the v2 operator IA while preserving capabilities and RBAC;
- deleted legacy components have 0 consumers and corresponding tests/docs are updated;
- new visual and route baselines replace legacy frozen-UI assumptions.

## 10. Evidence and historical documents

Dated audits and Frozen UI v1.x documents remain useful evidence of the previous implementation. They are **not** current product-direction authority after this decision.

When an older document contains an independently valid safety/runtime fact, that fact remains valid only if it is also supported by current code or a current non-visual contract.
