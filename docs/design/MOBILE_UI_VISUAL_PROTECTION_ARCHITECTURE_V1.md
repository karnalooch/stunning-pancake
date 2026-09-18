# 4VELO — UI Visual Protection Architecture v1

| | |
|---|---|
| **Status** | **APPROVED / NORMATIVE / HARD VISUAL FREEZE** |
| **Decision date** | 2026-09-18 |
| **Visual freeze** | **v1.2.0 — Adventure Grand Prix / Grand Prix Modern refinement** |
| **Applies to** | 4VELO mobile UI, visual components, assets, screen composition and visual regression |
| **Execution plan** | `docs/TAKEOVER_PLAN_CURRENT.md` |
| **Machine authority** | `MOBILE_UI_VISUAL_AUTHORITY_V1.json` |
| **Asset authority** | `MOBILE_ASSET_BIBLE_V1.md`, `ASSET_GOVERNANCE_V1.json` |

## 0. Authority and supersession

This document is the highest-authority source for **mobile visual implementation and visual-governance decisions**.

All mobile UI/design/art-direction/mockup decisions authored **before the takeover master plan T00 / PR #60** are historical evidence only. They do not constrain new implementation and must not override this architecture.

This specifically supersedes, for visual decisions:

- `DESIGN_SYSTEM_MOBILE.md`;
- ADR 006 visual styling decisions;
- ADR 014 visual styling / immersive-theme decisions;
- `4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md` visual SSOT claims;
- `GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`;
- `MOBILE_ASSET_NANO_BANANA_PROMPTS.md`;
- archived mobile design documents;
- pre-takeover mockups, screenshot baselines and generated-art references;
- the legacy generated asset pack.

Those sources may still explain history or preserve independently valid functional/safety facts. Superseding visual authority does **not** silently remove runtime behaviour, data-safety contracts, accessibility obligations, security rules or ride-safety behaviour. Functional changes remain governed by the current takeover plan and current code contracts.

### Current visual precedence

When sources conflict, use this order:

1. **This document — UI Visual Protection Architecture v1**.
2. **`MOBILE_UI_DESIGN_CONTRACT_V1.md` — Frozen UI v1.2 visual intent**.
3. **Asset governance:** `MOBILE_ASSET_BIBLE_V1.md`, `PLACE_IDENTITY_POLICY_V1.md`, `MOBILE_ASSET_PRODUCTION_LIST_V1.md`, `assets/ASSET_GOVERNANCE_V1.json`.
4. **`TAKEOVER_PLAN_CURRENT.md`** for implementation scope/order.
5. Post-takeover UI audits as evidence.
6. Pre-takeover design documents only as historical context.

A pre-takeover document can become normative again only through an explicit post-takeover decision that copies or re-adopts the rule into a current source.

## 1. Frozen product character

4VELO is:

> **a modern premium cycling/outdoor product with an adventurous Grand Prix identity and deliberate pixel-art emotion.**

It is not a retro game, a generic Strava clone, a green dashboard, a wall of arcade cards, or a collection of unrelated AI graphics.

Two visual modes are intentional.

### 1.1 Immersive / lifestyle mode

Used for onboarding, Home, Explore/discovery, Profile, Ride Summary and city/community/club identity.

Allowed: scenic pixel-art illustration, rider character, achievements, badges, city art and restrained race atmosphere.

### 1.2 Performance / riding mode

Used for Active Ride, pause/recovery, live navigation and safety-critical quick actions.

Required: very high contrast, large clean metrics, real functional map, minimal decoration, sunlight readability, one-hand operation and truthful status.

Pixel art is nearly absent here except tiny identity details such as rider marker.

## 2. Frozen colour system

The semantic visual core is fixed:

- canvas cream: `#FBF3E2`;
- parchment surface: `#F5E6CC`;
- ink/deep navy: `#0B1D33`;
- primary action orange: `#DD6B33`;
- pressed/dark orange: `#9E4318`;
- warm amber/gold: `#D4A373`;
- secondary brown: `#5A4A38`;
- supporting teal/slate: `#1F4E5F`;
- semantic positive/forest: `#3B6A24`;
- destructive red: `#BA1A1A`.

### 2.1 Non-negotiable green rule

Green may express GPS locked/healthy, sync success, genuine positive status, success confirmation, and nature/environment/map content.

Green must not be used for:

- primary CTA;
- active bottom navigation;
- selected sport chip;
- generic selected state;
- XP/progression;
- primary weekly-chart series;
- central Ride action;
- ordinary button background.

### 2.2 Action and selection roles

- primary CTA → orange;
- important progress/highlight → amber/orange;
- selected chip/tab/filter → warm amber/cream/orange treatment;
- app shell/navigation structure → navy;
- destructive → red;
- functional navigation route may use conventional blue/teal where clarity benefits;
- success/GPS → semantic green only.

Screens consume semantic roles, not raw palette choices.

## 3. Typography freeze

Routine UI uses a highly legible modern sans-serif. Metrics use clean tabular numerals. Pixel typography is decorative only.

Pixel font is forbidden in body copy, forms, Settings, routine buttons, routine bottom-navigation labels, map labels, chart labels, live ride metrics, ordinary stat cards and error/help text.

Pixel/display treatment may be used sparingly for achievement badges, special event badges, celebration microcopy and decorative city/brand labels.

No pre-takeover instruction requiring VT323/Press Start 2P/Silkscreen for routine metrics or controls remains authoritative.

## 4. Surface and geometry freeze

Routine product UI uses restrained borders, moderate radii, subtle/tonal elevation, clean spacing and modern readable typography.

Hard pixel borders, ornate frames and offset arcade shadows are special-surface tools, not defaults.

Protected geometry guidance:

- spacing: 4/8/12/16/20/24/32/40/48;
- routine button radius: about 12 dp;
- routine card radius: about 16 dp;
- bottom sheet radius: about 24 dp;
- absolute touch minimum: 44 dp;
- normal touch target: 48 dp;
- primary action: about 52 dp;
- ride-critical action: about 60 dp.

Responsive/accessibility tuning may adjust dimensions without changing semantic hierarchy.

## 5. Pixel-art budget

- **Home:** one dominant hero scene plus limited identity details.
- **Active Ride:** no large decorative scene; tiny rider marker/brand detail only.
- **Summary:** one celebration layer/scene plus achievements when state truth permits.
- **Explore:** pixel art in cards/place identity only; functional map stays modern.
- **Profile:** hero/avatar/achievement identity allowed; real stats remain dominant.
- **Settings/forms/privacy/security:** near-zero decorative pixel art.

## 6. Screen composition contracts

### 6.1 Home / T79

Above fold:

1. lightweight header/rider context;
2. immersive hero;
3. dominant Start Ride CTA;
4. sport selector;
5. compact weekly progress preview.

Start Ride stays visible without scrolling on target fixtures. Selected sport and weekly primary bars are not green. First-use does not show a wall of zeroes. Offline/statistics failure must not block ride start.

### 6.2 Active Ride / T80

Structure: map base → status → optional navigation cue → speed as largest routine number → secondary metrics → pause + protected stop.

No decorative scenic background. GPS green only when actually healthy. Outdoor sunlight and one-hand use are mandatory real-device checks.

### 6.3 Ride Summary / T81

Three truthful states: durable success, pending finalization, failed/recovery.

Full celebration is allowed **only after durable success**. Pending/failed state must never visually impersonate completed durable success.

### 6.4 Activity / History / T82

Real map/chart areas are functional, not decorative placeholders. Loading, empty, offline and error are first-class states.

### 6.5 Profile / remaining pilot surfaces / T83

Priority: rider identity → real ride statistics → city/club identity → achievements → game progression. Do not turn Profile into an RPG character sheet.

### 6.6 Explore

Map first. Discovery cards/sheets support it. Pixel overlays must not reduce utility. Filters use warm selected-state treatment, not generic green.

## 7. Navigation visual contract

Navigation chrome is modern product chrome:

- deep navy shell where dark chrome is used;
- warm amber/orange active emphasis;
- cream/muted inactive treatment;
- no neon-green active state;
- no pixel font for routine nav labels;
- central Ride action may be visually distinguished with warm orange/amber when current product/navigation mapping supports it.

This visual rule does not by itself invent or remove routes. Functional navigation changes require explicit current-plan implementation.

## 8. Semantic-token architecture

Required dependency direction:

```text
raw palette
  -> semantic roles
    -> approved components
      -> screens
```

Forbidden:

```text
raw palette
  -> screen
```

Semantic roles include `action.primary`, `navigation.active`, `selection.active`, `progress.primary`, `status.success`, `ride.gpsLocked`, `ride.stopAction`.

Screens state meaning. Components own appearance.

## 9. Component API protection

Approved components must not expose arbitrary visual escape hatches where semantic variants are sufficient.

Preferred:

```tsx
<PrimaryButton label="Rozpocznij jazdę" />
<ProductCard variant="raised" />
<SportChip selected />
```

Avoid arbitrary `backgroundColor`, `textColor`, `borderColor`, `shadowColor` and `selectedColor` props on routine product primitives.

## 10. Code ownership boundaries

Target structure:

```text
mobile/src/design-contract/
mobile/src/theme/
mobile/src/components/product/
mobile/src/components/brand/
mobile/src/components/ride/
mobile/src/dev/VisualDesignGalleryScreen.tsx
```

Product components are modern routine UI and must not casually import PixelText, ornate frames, hard arcade shadows or raw palette. Brand components may carry rider art/achievements/special identity. Ride components are performance-first.

## 11. Static protection / lint

Protection must detect at least:

- raw inline hex/rgb in screens and routine product components;
- direct raw-palette imports from screens;
- pixel fonts in routine product UI;
- hard pixel shadows in routine components;
- thick routine borders;
- arbitrary button/card colour props;
- generic green selection/action states;
- direct legacy-asset use in new visual slices when an approved registry exists.

## 12. Design Gallery

A development-only Design Gallery becomes the canonical component inspection surface, rendering deterministic examples of buttons, cards, chips, typography, status banners, offline/pending/error states, HUD metrics, GPS states, pause/stop, achievements and place identity.

Gallery changes are visual-regression inputs.

## 13. Deterministic visual fixtures

Use fixed data, never live APIs/random time/random achievements/network.

Required fixture families:

- Home: default, first-use, loading, offline, stats-error;
- Active Ride: normal, navigation, GPS-degraded, paused, offline;
- Summary: durable-success, pending, failed;
- Explore: default, filtered, empty, offline;
- Profile: default, loading, no-achievements.

## 14. Golden master policy

The accepted generated concept board is art-direction reference, not a pixel oracle.

Golden masters are created from real app rendering after implementation acceptance.

Reference matrix starts with 360×800, 393×873 primary, 412×915, font scale 1.0 and 1.2 for priority screens, plus Active Ride day/night.

Visual regression outputs expected/actual/diff. Baseline updates are never automatic.

## 15. Visual regression gate

A protected UI PR must provide deterministic before/after evidence.

The mature `Mobile Visual Contract` check covers frozen-contract tests, visual-authority validator, asset-governance validator, UI lint, semantic import rules, Design Gallery regression, applicable screen golden regression and baseline-manifest integrity.

## 16. Baseline manifest and checksums

Approved baselines bind visual-freeze version, fixture ID, viewport, font scale, digest and approval state. Protected contract files may use checksum detection so a PR claiming no contract change cannot silently edit them.

## 17. Assets

Assets follow `MOBILE_ASSET_BIBLE_V1.md`.

Hard rules: legacy generated pack is unapproved; no bulk generation; canonical rider before derivatives; Home hero calibrates environment art; routine functional icons use coherent modern vector/owned sources; official crests are never AI-generated; every locality works via Place Badge; approved art requires provenance + immutable digest.

## 18. Real-device gate

T84 must verify exact pilot build for sunlight readability, one-hand reach, touch targets, font rendering, map/metric legibility, truthful offline/GPS/sync states and Summary pending-vs-durable distinction.

## 19. Change levels

- **L0 tuning:** clipping, safe area, responsive spacing, accessibility sizing. No design approval if intent is unchanged.
- **L1 component refinement:** small shadow/radius/icon/spacing refinement. Requires visual review.
- **L2 contract change:** colour-role, pixel intensity, screen hierarchy, navigation visual model, celebration truth semantics or routine typography role. Requires explicit approval and freeze revision.

## 20. PR declaration

Every protected UI PR declares:

```text
Visual freeze version: 1.2.0
Visual contract modified: NO / YES
Golden baseline modified: NO / YES
Approved exception(s): none / list
```

## 21. Approved exceptions

Exceptions must be explicit, narrow and searchable, with reason, affected path/component, approval reference and expiry/removal condition when temporary.

## 22. T79 rollout contract

T79 implementation order:

1. protection foundation: machine-readable contract, semantic roles, lint/gates, Gallery plumbing;
2. product primitives;
3. app chrome;
4. Home implementation;
5. approve real Home golden baselines.

T80–T83 reuse the established system and do not invent a new visual language.

## 23. Definition of visual done

A slice is done only when it matches Frozen UI v1.2, uses semantic roles, does not reintroduce generic green selection/action, routine UI does not regress to arcade chrome, pixel fonts stay decorative, required edge states exist, deterministic tests pass, visual evidence is reviewed, functional behaviour stays intact, ride/summary truth rules stay intact, and physical Android QA is completed where required.

## 24. One-sentence rule

> **Implement the approved 4VELO visual language; do not reinterpret it. If code, a legacy document or an old asset conflicts with Frozen UI v1.2, the current takeover-era architecture wins.**
