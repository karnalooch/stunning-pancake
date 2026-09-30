# 4VELO Mobile Visual Composition Architecture v1

| | |
|---|---|
| **Status** | **APPROVED / NORMATIVE / CURRENT** |
| **Decision date** | 2026-09-30 |
| **Last reviewed** | 2026-09-30 |
| **Owner role** | Product / Mobile / Design |
| **Tracks** | #397 |
| **Product authority** | [Product UX v2](./PRODUCT_UX_V2.md) |
| **Subordinate visual baseline** | [Mobile UI Design Contract v1.2](./MOBILE_UI_DESIGN_CONTRACT_V1.md) |
| **Asset authority** | [Mobile Asset Bible](./MOBILE_ASSET_BIBLE_V1.md) · [Asset Production List](./MOBILE_ASSET_PRODUCTION_LIST_V1.md) · [machine governance](../../assets/ASSET_GOVERNANCE_V1.json) |
| **Translation** | [Polski](../pl/design/MOBILE_VISUAL_COMPOSITION_ARCHITECTURE_V1.md) |
| **canonical_path** | docs/design/MOBILE_VISUAL_COMPOSITION_ARCHITECTURE_V1.md |

## 1. Decision

4VELO mobile presentation is designed **composition-first, asset-second**.

The current product hierarchy is:

```text
Product UX v2
  -> feature/domain state
  -> controller / experience coordinator
  -> visual composition
       map plane
       data plane
       control plane
       brand / emotion plane
  -> tokens / primitives / assets
```

The first three presentation planes are functional. The fourth is optional.

**Brand art may enrich an already-correct composition. It may not create the composition.**

This document resolves the remaining ambiguity between Product UX v2, the older Frozen UI protection documents and asset-governance work.

## 2. Authority order

When mobile visual sources conflict, use this order:

1. **Product UX v2** — product information architecture, user journeys, shell and legacy retirement.
2. **This document** — screen composition, information priority, functional/brand plane boundaries and asset placement.
3. **Mobile UI Design Contract v1.2** — palette, typography, readability, touch-target and restrained Grand Prix identity baseline where compatible with 1–2.
4. **Asset Bible / Production List / Asset Governance JSON** — asset provenance, production role and approval.
5. Dated audits, mockups and historical Frozen UI documents — evidence only.

`MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` remains historical safety/legibility evidence. It is not allowed to override Product UX v2 or this composition contract.

## 3. The four presentation planes

### 3.1 Map plane

Purpose: spatial truth.

Owns:

- user position;
- route geometry;
- maneuver geometry/context;
- nearby route/navigation context;
- recovery-safe map fallback when available.

Rules:

- map is not a decorative background;
- route contrast and user position win over brand detail;
- decorative rider markers must not hide route or maneuver geometry;
- map failure must not erase ride state, controls or recorded metrics;
- map-specific loading/degraded states are explicit.

### 3.1.1 Mobile basemap authority

The canonical mobile basemap style is:

`mobile/assets/map/4velo-ride-v1.json`

It is a repository-owned, Maputnik-editable MapLibre Style JSON derived from OpenFreeMap Liberty with preserved upstream provenance/license notice.

Rules:

- GitHub owns the accepted style artifact; Maputnik is an editor, not the SSOT;
- production code must not fall back to MapLibre demo tiles or direct `tile.openstreetmap.org` raster usage;
- a deployment may set `EXPO_PUBLIC_MAP_STYLE_URL` to another compliant style URL;
- OpenMapTiles/OpenStreetMap attribution remains visible;
- route geometry is rendered as a separate 4VELO overlay above the basemap so product hierarchy does not depend on upstream road colors.

### 3.2 Data plane

Purpose: workout truth at a glance.

Owns:

- one hero metric when the user is moving;
- a bounded set of secondary metrics;
- GPS/sync state when it materially changes trust;
- current maneuver distance when navigation is active.

Rules:

- prioritize size over quantity during the ride;
- avoid card grids that make every metric equally important;
- no metric editing/customization UI while the ride HUD is in normal moving mode;
- tabular numerals and stable geometry are preferred;
- color supplements hierarchy; it does not replace scale/weight/position.

### 3.3 Control plane

Purpose: safe action.

Owns:

- Start;
- Pause / Resume;
- protected Finish/Stop;
- recovery action when the user can meaningfully fix a blocked state.

Rules:

- one primary action at a time;
- Pause/Resume is the dominant active-ride control;
- Finish is protected and visually destructive without competing for constant attention;
- controls remain usable with the brand plane disabled;
- one-hand reach and outdoor recognition outrank decorative consistency.

### 3.4 Brand / emotion plane

Purpose: identity and reward.

Allowed examples:

- one Today/Home hero;
- small rider map marker;
- locality/place identity;
- onboarding scenery;
- achievement art;
- durable-success Summary celebration;
- share-card framing.

Not allowed to own:

- navigation hierarchy;
- essential metrics;
- map readability;
- standard buttons;
- GPS/error truth;
- routine forms/settings;
- pending/recovery state semantics.

The brand plane may disappear entirely and the product must remain coherent.

## 4. Asset-off test

Every major mobile composition must pass this conceptual test:

> Disable optional raster/illustrative brand assets. Is the screen still understandable, visually hierarchical, fully operable and truthful?

PASS requires:

- user can identify the screen/task immediately;
- primary action remains obvious;
- map/data/control hierarchy remains intact;
- no essential label was baked into an image;
- loading/offline/error/recovery states remain complete;
- spacing does not collapse around a missing hero;
- no blank decorative frame becomes a functional dependency.

If the answer is no, fix composition/components first. **Do not generate another asset as a patch.**

## 5. Canonical primary flow

```text
TODAY
  -> START RIDE
      -> ACTIVE RIDE
          -> PAUSED overlay/sheet
          -> ACTIVE RIDE
          -> FINALIZING
              -> SUMMARY
  -> TODAY
```

The live ride is a focused operational flow outside normal bottom-navigation browsing.

## 6. Today composition contract

### Job

Answer, in under a few seconds:

1. Am I ready to ride?
2. What is the clearest next action?
3. Is there one useful piece of recent/current context?

### Composition

```text
Today
  ├─ compact context / greeting
  ├─ ONE dominant ride entry
  ├─ optional single brand/hero moment
  ├─ bounded current/recent context
  └─ ordinary bottom navigation
```

Rules:

- Start Ride is visually dominant.
- Do not build a KPI dashboard around the CTA.
- Weekly/recent data is secondary and collapsible by product need, not decorative card count.
- One hero image maximum in the first viewport.
- Hero art cannot push the ride action below the primary reach/read zone.
- A missing hero must not make Today look unfinished.

## 7. Start Ride composition contract

### Job

Convert intent into a safe, truthful ride start.

### Composition

```text
Start Ride
  ├─ activity/profile choice
  ├─ readiness
  │    ├─ GPS
  │    ├─ sensors where relevant
  │    └─ offline/sync caveat where relevant
  ├─ optional route/workout choice
  └─ dominant START
```

Rules:

- preparation information lives here instead of contaminating the moving HUD;
- diagnostics are demoted unless they block start;
- no decorative dashboard;
- route/workout selection may be rich, but START remains obvious;
- error/recovery states explain the smallest action required to proceed.

## 8. Active Ride composition contract

### Job

Let a rider understand **where to go, how they are doing and how to pause** with minimal attention.

Priority:

1. maneuver / map truth when navigation is active;
2. hero live metric;
3. 2–3 secondary metrics;
4. GPS/recovery state only when relevant;
5. Pause;
6. protected Finish.

Target composition:

```text
┌──────────────────────────────┐
│ maneuver / concise status    │
├──────────────────────────────┤
│                              │
│             MAP              │
│        route + rider         │
│                              │
├──────────────────────────────┤
│ HERO METRIC                  │
│ secondary | secondary        │
├──────────────────────────────┤
│       PAUSE / RESUME         │
│       protected FINISH       │
└──────────────────────────────┘
```

Rules:

- map remains a functional plane, not scenic art;
- avoid stacking independent card components over the map unless each survives a hierarchy review;
- the HUD should not show editing/profile chips in ordinary ride mode;
- battery/time/GPS labels are compact utility information, not a competing top card;
- navigation instruction is one coherent guidance surface, not another generic product card;
- decorative rider art is limited to the marker/identity role;
- moving-state animation and color are conservative;
- no full-screen decorative scene.

## 9. Paused composition contract

Paused is **a Ride state, not a separate product destination**.

Target:

```text
ACTIVE RIDE remains visible/recognisable
        +
bounded scrim / bottom sheet / overlay

PAUSED
  ├─ paused state label
  ├─ RESUME — dominant
  └─ FINISH — protected/destructive
```

Rules:

- keep ride identity and context visible;
- do not navigate to a visually unrelated modal world;
- do not duplicate the entire Ride UI;
- Resume is the clear primary action;
- Finish remains available but protected;
- semantic `pause()` / `resume()` controller commands and persisted lifecycle state drive this surface; presentation state alone is not authority.

## 10. Summary composition contract

### Job

Explain what happened and what happens next.

Base composition:

```text
Summary
  ├─ terminal truth
  ├─ primary result
  ├─ route / effort context
  ├─ bounded secondary metrics
  ├─ share / next action
  └─ optional brand celebration
```

### Durable success

May add:

- `summary_finish_v1`;
- success haptic;
- achievement/celebration layer;
- share-card identity.

### Pending finalization / recovery required

Must not add:

- success celebration;
- victory/rank framing that implies completed durable truth;
- celebratory particles;
- misleading "done" language.

Rules:

- metrics and route context come before gamified decoration;
- rank/XP mechanics are not part of the composition baseline unless separately justified by current Product UX;
- celebration is an optional final layer, never the container for the summary itself.

## 11. Current approved asset disposition

| Asset | Decision | Composition role |
|---|---|---|
| `rider_canonical_v1` | **KEEP / SPECIALIST ONLY** | identity source; onboarding/profile/special moments, not routine chrome |
| `home_hero_day_v1` | **KEEP / BOUNDED** | at most one Today/Welcome hero; never required for hierarchy |
| `place_badge_v1` | **KEEP** | locality identity where a real mark is unavailable |
| `ride_marker_rider_v1` | **KEEP / BOUNDED** | map marker only if route/readability remains superior |
| `ride_action_icons_v1` | **KEEP** | functional control plane; code-generated simple geometry is preferred |
| `summary_finish_v1` | **KEEP / DURABLE-SUCCESS ONLY** | optional celebration after truthful completion |

No approved asset is permission to redesign a screen around that asset.

## 12. Planned asset queue policy

Effective 2026-09-30, planned decorative assets are **not automatic implementation work**.

Before generating/commissioning a planned asset, the issue must state:

1. which current composition has a proven gap;
2. why layout, type, iconography, map/data rendering or standard components cannot solve it;
3. which plane owns the asset;
4. what happens when the asset is unavailable;
5. target render slot/dimensions;
6. accessibility/reduced-motion implications;
7. whether the same need can reuse an approved family.

If those questions are not answered, keep the target planned.

Particularly:

- `home_hero_evening_v1` — optional variant, no current need by default;
- `profile_scene_v1` — do not produce until You composition proves a real identity gap;
- `explore_hero_v1` — map-first Discover must not need it to feel complete;
- `city_scene_*` — specialist community/event identity only;
- `summary_particles_v1` — last-mile durable-success flourish only;
- `achievement_core_set_v1` — only after current Product UX confirms achievements remain a primary product concept.

## 13. Component architecture implications

Presentation components should trend toward:

```text
RideExperience
  ├─ RideMapPlane
  ├─ RideGuidance
  ├─ RideMetrics
  ├─ RideControls
  ├─ RideRecoveryStatus
  └─ RideBrandAccent (optional)
```

Avoid a component architecture where every reusable widget becomes a card and the screen is simply a vertical stack of independent cards.

Reusable does not mean equally weighted.

The Ride controller/domain owns state transitions. Composition consumes semantic state.

## 14. External reference evidence

These sources are architectural/UX references, not visual templates.

### Mapbox Navigation UX Framework

- Docs: https://docs.mapbox.com/android/navigation/ux/guides/
- Session: https://www.youtube.com/watch?v=uTXUqf3MIJ0

Transferable lesson:

- keep a coherent core navigation experience;
- integrate/customize through explicit configuration, event and coordination boundaries;
- branding should customize the experience without dissolving navigation-state ownership.

Do **not** infer that 4VELO should adopt Mapbox UXF or its visual style.

### Uber Driver App architecture

- https://www.uber.com/gb/en/blog/driver-app-ribs-architecture/

Transferable lesson:

- model user/job state independently from screens;
- separate core workflow from optional map capability;
- put mapping behind a bounded abstraction so map failures do not destroy the job state.

Do **not** copy RIBs as a framework merely because the architectural lesson is useful.

### Wahoo product design

- Design-system redesign: https://medium.com/wahoo-product-design/wahoo-releases-biggest-software-update-yet-c67fa22f1034
- Workout/small-display design notes: https://medium.com/wahoo-product-design/elemnt-rival-b988b486529e
- Current Wahoo app release notes: https://support.wahoofitness.com/hc/en-us/articles/360000117504-Wahoo-app-release-notes-Android

Transferable lesson:

- consistency starts with a design system, then each screen/flow is audited for hierarchy;
- sport displays balance **size of information vs amount of information**;
- contrast matters disproportionately during workouts;
- color is used sparingly where it contributes meaning;
- pre-ride setup should get the athlete riding faster, not turn Home into an analytics console.

Do not copy Wahoo branding, icons or layouts.

### Hammerhead Karoo — independent ride review

- https://www.youtube.com/watch?v=RchsWNofg1Q

Useful review sections include basic ride usage, Climber, finish/upload and navigation/mapping.

Transferable lesson:

- evaluate live-ride UI in the context of riding, not as static cards;
- specialized modes can temporarily change data priority without changing the entire product hierarchy;
- finish/upload is part of the ride flow and should read as a state transition, not an unrelated destination.

This is third-party review evidence, not a normative product specification.

## 15. What not to copy

External references do **not** authorize:

- copying copyrighted visual assets;
- cloning proprietary layouts pixel-for-pixel;
- importing a scale-specific framework without need;
- replacing our controller/domain architecture with RIBs/Mapbox internals;
- adding features merely because another product has them.

We copy questions, constraints and hierarchy principles.

## 16. Tooling qualification gate — GitHub-connected by default

GitHub is the system of record for accepted mobile visual/tooling outputs.

A production design/visual tool may participate in the 4VELO workflow only if it provides at least one of:

1. **native GitHub repository/component integration**; or
2. a **deterministic CLI/API/export** that produces versionable repository files which can be reviewed in PRs and validated in CI.

A SaaS workspace by itself is not visual authority.

Required for every production-capable tool:

- documented GitHub/repository integration path;
- a versioned artifact path or explicit component-to-code mapping;
- reproducible export/sync procedure;
- PR/CI review path;
- license/provenance status;
- fallback/export path that avoids trapping the accepted state in one vendor.

### Tool disposition

| Tool | GitHub fit | 4VELO role |
|---|---|---|
| Figma | **CONDITIONAL PASS** | Use Code Connect / Variables API / CLI or another deterministic repo sync. If the active plan cannot provide that, Figma is a design workspace/reference, not the final SSOT. |
| Maputnik | **PASS** | MapLibre Style JSON is versioned in Git; local CLI/export is preferred. GitHub Gist export is useful for sharing but not our authority. |
| Storybook | **PASS** | Stories and components live in the repository; optional visual-regression services may integrate through GitHub Actions. |
| Maestro | **PASS** | YAML flows live in-repo; local CLI is sufficient. Cloud/GitHub Actions is optional and must not force unnecessary native builds. |
| Lucide / Skia / RN libraries | **PASS** | Dependency versions and implementation live in the repository and are reviewed by normal PR/CI. |
| Mobbin / YouTube / vendor screenshots | **RESEARCH-ONLY EXEMPTION** | Reference evidence only; never owns production state or assets. |

Current reference evidence:

- Figma Code Connect can map Figma components directly to a GitHub repository; direct UI integration is plan-dependent: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
- Figma Variables REST API supports automated design-token synchronization with a codebase/GitHub workflow: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
- Maputnik supports local CLI/style JSON export and GitHub Gist export: https://github.com/maplibre/maputnik/wiki/Design-a-Map-Style
- Maestro supports repository-stored flows and optional GitHub Actions/PR integration through Maestro Cloud: https://docs.maestro.dev/maestro-cloud/ci-cd-integration/github-actions

The acceptance rule is stricter than “the tool has a GitHub button”: the **accepted artifact must be reproducible and reviewable from repository evidence**.

## 17. Repo-native visual workbench

The canonical component inspection surface is repository-owned and works without an external SaaS:

- `mobile/src/dev/VisualDesignGalleryScreen.tsx`;
- deterministic fixtures in `mobile/src/dev/visualWorkbenchFixtures.ts`;
- dev/vision-only navigation boundary;
- stable test IDs for Maestro/runtime screenshots;
- explicit map/data/control/brand sections and asset-off inspection.

The workbench renders production components rather than mock replicas.

Storybook may later wrap the same components and fixtures when dependency/lockfile cost is justified. Storybook is an optional adapter, not a prerequisite and not an authority source.

### Exact-SHA Maestro visual proof

The canonical Ride visual proof is repository-owned:

- flow: `mobile/.maestro/flows/visual-proof-ride.yaml`;
- runner: `scripts/run-mobile-maestro-visual-proof.ps1`;
- command: `pnpm mobile:visual:proof`.

The runner is intentionally **artifact-consumer-only**. It does not prebuild or compile Android. It requires a clean worktree, resolves a successful `Mobile Native Smoke` artifact for the exact current Git SHA (or an explicitly supplied run ID), verifies `sourceHeadSha`, `builtGitSha`, package identity, runtime-fixture flags and the APK SHA-256, then installs that exact APK. For the `pilot-local` profile it also fails early unless the Home Lab backend is healthy, establishes the required ADB reverse mappings, grants declared location permissions, launches the package explicitly through the Android launcher and verifies that the app process remains alive before Maestro receives control.

The UI contract is ID-first. Fresh state is owned by the wrapper (`pm clear`), onboarding selects the first available tenant through a stable test ID, skips the optional team step, and finishes without localized-text selectors. Ride transitions wait on stable IDs for Today, Start Ride, Active Ride, Paused and Summary. Maestro writes raw run artifacts under `artifacts/mobile-maestro-visual-proof/<sha>-<timestamp>/maestro/`; the wrapper recursively resolves exactly one copy of each mandatory checkpoint and copies the canonical six PNGs to `screenshots/`. Missing, duplicate or implausibly small screenshots fail closed. The wrapper adds a machine-readable `visual-proof-manifest.json` containing source/artifact/device identity and hashes for every mandatory screenshot plus `visual-proof-summary.md` for human sign-off.

`PASS` means the exact artifact executed the canonical flow and produced complete, hashed evidence. It does **not** replace human visual acceptance. Routine PR/main CI must not invoke this proof or compile an APK merely because JS/UI changed; exact-SHA native evidence remains an explicit Gumball proof dependency.

## 18. Review checklist

For every primary mobile visual PR:

### Architecture

- [ ] Product UX v2 journey is preserved.
- [ ] State comes from a controller/domain boundary.
- [ ] map/data/control/brand planes are identifiable.
- [ ] optional brand art is not carrying functional hierarchy.

### Hierarchy

- [ ] user can name the primary task in ~1 glance;
- [ ] one primary action is obvious;
- [ ] secondary information is genuinely secondary;
- [ ] routine UI is not a pile of equally weighted cards.

### Ride

- [ ] map/guidance remains readable;
- [ ] hero metric dominates secondary metrics;
- [ ] Pause/Resume is obvious;
- [ ] Finish is protected;
- [ ] no edit/customization mode leaks into moving HUD;
- [ ] paused state remains visually part of the same ride.

### Assets

- [ ] asset-off test passes;
- [ ] approved asset role matches governance;
- [ ] no new decorative asset exists merely to fill empty layout space;
- [ ] no text/business truth is baked into raster art.

### Truth

- [ ] loading/offline/GPS/recovery states are explicit;
- [ ] pending/recovery cannot impersonate durable success;
- [ ] celebration is durable-success-only.

## 19. Implementation order after this decision

1. reconcile #388 visual slice against this composition contract;
2. implement #392 semantic Pause/Resume and consume it as the paused overlay state;
3. simplify Active Ride chrome into coherent map/data/control planes;
4. recompose Today and Start Ride around Product UX v2 jobs;
5. recompose Summary around terminal truth first, celebration second;
6. only then reopen planned asset production where a documented gap remains.

## 20. One-sentence rule

> **4VELO should look complete before the artwork loads; artwork should make it recognisably 4VELO, not make it usable.**
