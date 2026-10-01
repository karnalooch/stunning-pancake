# 4VELO Product UX v2 — Current UI Authority

| | |
|---|---|
| **Status** | **APPROVED DIRECTION / NORMATIVE / CURRENT — implementation in progress** |
| **Decision dates** | 2026-09-28; mobile Roadbook amendment 2026-10-01 |
| **Owner role** | Product / Mobile / Admin Frontend |
| **Tracks** | GitHub Issue #346 (authority); #418 / PR #419 (Roadbook and theme packs) |
| **Machine mobile authority** | `MOBILE_UI_VISUAL_AUTHORITY_V1.json` (legacy path retained for validator compatibility; `currentAuthority` points here first) |
| **Mobile composition authority** | [Mobile Visual Composition Architecture v1](./MOBILE_VISUAL_COMPOSITION_ARCHITECTURE_V1.md) |
| **Theme contract** | [Theme packs v1](./THEME_PACKS_V1.md) |
| **Applies to** | Mobile presentation and CONTROL information architecture; the October amendment changes mobile only |
| **Supersedes for UI direction** | The current mobile look, mandatory Grand Prix colours/pixel-art, frozen UI approvals and dated mobile visual snapshots where they conflict |

## 1. Decision

The owner has rejected the existing mobile presentation as a whole. This is a **controlled teardown and replacement of the presentation layer**, not a palette-only facelift. The Roadbook concept and extensible theme direction are approved design inputs, not proof that implemented screens have passed device acceptance.

Preserve useful capabilities and proven backend/API/auth/GPS/telemetry/ride-domain contracts. Extract domain logic from screens where needed. Replace screen layouts, visual components, information hierarchy, typography and user navigation. Do not preserve a screen or illustration merely because it exists or used to be labelled approved.

Delete a replaced legacy surface after its behaviour and consumers have migrated and been verified. Temporary wrappers require an explicit removal condition. Green CI does not constitute owner approval of appearance.

## 2. Visual direction

Mobile Roadbook combines an outdoor route journal outside a ride with a clear instrument during recording. The default palette is off-white, graphite and cobalt. Forest is a second data-only theme; neither is mandatory for all users. Light/dark/system is independent of theme identity, and high contrast is an independent override.

Use semantic colour and typography roles. A theme changes appearance, never routes, session state, consent, destructive-action semantics or minimum touch-target sizes. No pixel fonts in routine labels, metrics or controls. Pixel art, the old orange accent, deep navy and existing illustrations have no protected status in mobile. Optional imagery must support a real place, route or community and must not be necessary for the screen to work.

Prefer sections, map surfaces, readable lists and intentional spacing to stacks of decorative cards. Keep the main action obvious, errors actionable and touch targets at least 48 dp. Respect text scaling, screen readers and reduced motion. Preview metrics must be explicitly identified as sample data; production screens must not invent GPS readiness, sensor connections, routes or saved status.

CONTROL remains a separate operational surface. Its existing navy/ink and orange/cream direction is not being reimplemented by the mobile theme-pack sprint. Related identity does not require identical density or palettes.

## 3. Mobile information architecture

Target user destinations:

1. **Jazda / Ride** — prepare or return to the current session, with one dominant action.
2. **Odkrywaj / Discover** — map-first routes, places and relevant available discovery data.
3. **Klub / Club** — the next shared ride/event, people and community activity.
4. **Ty / You** — activity history, progress, equipment, appearance and account settings.

Start Ride is an action/preparation step, not a fifth destination in the target design. The current runtime **Today / Discover / Start Ride / Club / You** route contract remains a migration boundary until its replacement and deep-link tests are delivered. A new theme picker alone does not complete this navigation migration.

### 3.1 Live ride flow

`Ride preparation -> Active Ride -> Pause/Resume -> Summary`

Live ride is a focused operational flow outside ordinary content navigation. Provide a map composition and a readable instrument composition using the same underlying session. Do not implement separate recording state for the two views.

Keep pause/resume controls predictable. Finishing requires an explicit, protected action. GPS quality, recording, sync backlog and map availability are distinct states. A summary must identify the completed activity and accurately distinguish local durability, pending finalization and server confirmation. Existing recovery states are not replaced with an unconditional success screen.

## 4. Legacy disposition and transition

| Surface | Decision | Removal/migration condition |
|---|---|---|
| `RideDashboardScreen` | REPLACE | New Ride entry preserves truthful activity context and live-session return |
| `StartRideScreen` | REPLACE presentation | Preserve sport/start/error/diagnostic contracts and stable automation IDs |
| `ProductTabBar` / older game shell | REPLACE | Four-destination navigation and deep-link migration verified |
| `ExploreMapScreen` | KEEP map capability / REDESIGN | Real map and route interactions in the new layout |
| `CityHubScreen`, clubs and rankings | MERGE / RECOMPOSE | Useful capabilities have a home in Club |
| `AthleteProfileScreen`, history and trends | RECOMPOSE | Useful capabilities have a home in You |
| `ActiveRideHUDScreen` | KEEP domain / REPLACE presentation | New map/instrument views and real pause/recovery tests |
| `RidePausedScreen` | REMOVE standalone destination | Overlay parity verified; preserve resume/finish behavior |
| `RideSummaryScreen` | REPLACE presentation | Keep durable-success, pending-finalization and recovery-required semantics |
| `SettingsScreen` | REPLACE presentation | Preserve privacy, sensors, account, equipment and diagnostic capabilities |
| `SettingsSections` | TEMPORARY migration host | Remove after its settings capabilities are rebuilt; not visual authority |
| `grandPrix` / `grandPrixNight` runtime names | TEMPORARY aliases | Remove after all legacy consumers migrate; these are not user theme IDs |
| `runtimeTheme.ts` legacy-key adapter | TEMPORARY compatibility | Remove with the last legacy raw-key consumer |
| Vision/workbench surfaces | KEEP tooling, not product navigation | Device/test fixtures only; no false product data |

## 5. 4VELO CONTROL information architecture v2

The desktop/admin product is **4VELO CONTROL**. Target top-level IA remains:

1. **Overview** — operational summary and exceptions needing attention.
2. **Riders** — identity, account status, tenant membership and support.
3. **Rides** — activities, moderation context and operational review.
4. **Map** — live/operational geospatial and simulator workflows.
5. **Community** — clubs, cities, challenges and moderation.
6. **Events** — event lifecycle and participation operations.
7. **Content** — product content and configurable presentation surfaces.
8. **Trust** — anti-cheat, audit and safety/security operator workflows.
9. **Business** — tenants, branding, sponsors, vouchers and commercial configuration.
10. **System** — platform configuration, integrations, diagnostics and privileged tools.

Functionality is not removed because old navigation grouping is removed. Enforce RBAC at route/action level, not merely through hidden menu entries. Prefer tables, filters, search, bulk actions and maps over decorative KPI cards. Destructive/privileged actions remain explicit and auditable. Desktop density may be higher than mobile density.

## 6. Legacy retirement rules

A file can be deleted only after required behavior has migrated, repository search confirms no remaining runtime consumer, replacement deep links/routes are defined, relevant unit/integration/E2E tests pass, applicable route/RBAC audits pass and docs/dead imports/assets are updated.

Do not preserve conflicting visual baselines to defend rejected UI. Replace them with reviewed baselines while retaining independent safety and behavioral assertions.

## 7. Delivery sequence and actual status

Historical UI-1/UI-2 work (#348/#349, #354/#356, #358/#359, #360/#361 and #362) describes the existing runtime, not acceptance of its appearance under Roadbook.

The active sprint is #418 / PR #419:

- implement the versioned data-only theme contract, validation, transactional persistence and migration;
- wire one runtime, real appearance settings, isolated preview, apply/cancel and import/export;
- replace the complete ride vertical slice with the approved visual direction and real domain commands;
- migrate secondary surfaces and navigation, then remove the replaced legacy presentation;
- obtain exact-SHA native/visual evidence and owner acceptance.

Theme-pack code, unit tests or a successful Metro bundle are not a completed native or visual acceptance. PR/issue evidence records which stages have actually run. Do not mark the full app MVP complete based on the theme foundation.

## 8. Preserved contracts

The design does not itself authorize changes to authentication/session semantics, API schemas, GPS capture/buffering/recovery, telemetry retry/durability, ride data integrity, RBAC/tenant isolation, audit logging or release/native provenance gates. Behavioral fixes need explicit scope and evidence. Accessibility obligations remain mandatory for every theme.

No routine APK rebuild per palette change. Use the Gumball cost governor and exact-SHA native proof path when required. Keep unrelated proof/harness work independent.

## 9. Acceptance criteria

The mobile migration is complete only after the new navigation and entire ride flow are implemented with real data and commands; invalid theme packs cannot replace a working theme; selection persists and works offline; preview/cancel has no side effect; changing appearance does not remount the recording subtree; error/recovery/empty states, text scaling and contrasts are reviewed; native behavior and visual parity are evidenced; and owner approval applies to the actual implementation.

A third compliant theme must be installable without editing any screen. CONTROL acceptance remains independently scoped to its operator IA, capabilities and RBAC. Old UI approvals cannot overrule the October mobile replacement decision.

## 10. Evidence

Dated audits, Frozen UI v1.x documents and generated concept boards are historical/design evidence, not proof of runtime behavior. A valid safety/runtime requirement from an older document remains protected when supported by current code or a current non-visual contract.
