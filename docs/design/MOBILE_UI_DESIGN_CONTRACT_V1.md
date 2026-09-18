# 4VELO Mobile UI Design Contract v1.2

| | |
|---|---|
| **Status** | **APPROVED / FROZEN for implementation** |
| **Decision date** | 2026-09-16; visual freeze refined 2026-09-18 |
| **Selected direction** | **Adventure Grand Prix — Grand Prix Modern refinement / Frozen UI v1.2** |
| **Applies to** | 4VELO mobile application |
| **Implementation order** | Auth/Onboarding → Home → Active Ride → Ride Summary → Profile/Compete/Explore |
| **Runtime changes in this document** | None |\n| **Visual authority** | [UI Visual Protection Architecture v1](./MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md) |

## 0. Visual authority

This contract is subordinate to `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md`. All pre-takeover mobile visual decisions, mockups, old generated assets and previous SSOT claims are historical/non-normative when they conflict with Frozen UI v1.2.

## 1. Product character

4VELO is a **modern cycling and outdoor-sports application with a premium Grand Prix identity**.

The product must not look like a generic fitness dashboard, but it also must not read like a retro video game. The target balance is:

> **serious sports product + prestigious race atmosphere + deliberate pixel-art identity**.

The visual signature is built from:

- deep navy/ink as the principal structural shell;
- warm cream/parchment as the principal light surface;
- burnt orange/copper as the primary action colour;
- warm amber/gold as progression, prestige and selected-state accent;
- semantic forest green only for genuine success/GPS/nature contexts;
- large pixel-art cycling scenes used as hero imagery;
- verified official crests or canonical 4VELO Place Badges, club marks and achievement badges;
- calm, highly legible statistics and controls;
- maps and charts that remain sharp and functional.

The phrase **Grand Prix Modern** means that the historical/racing atmosphere is retained, while typography, spacing, inputs, data presentation and interaction patterns follow modern mobile-product standards.

## 2. Non-negotiable hierarchy

When visual character conflicts with usability, the priority order is:

1. ride safety and glance readability;
2. interaction clarity;
3. accessibility;
4. information hierarchy;
5. 4VELO brand character;
6. decorative pixel-art detail.

Pixel art may add identity. It may never make essential information harder to read.

## 3. Colour contract — Frozen UI v1.2

The runtime theme must migrate toward semantic roles defined by the Visual Protection Architecture. Screens must not introduce ad-hoc colour literals.

### Frozen core

- **Deep navy / ink — `#0B1D33`**: shell, structure, dark panels and primary text.
- **Canvas cream — `#FBF3E2`** and **parchment — `#F5E6CC`**: principal light surfaces.
- **Primary action orange — `#DD6B33`** with pressed/dark `#9E4318`.
- **Warm amber/gold — `#D4A373`**: progress, prestige, selected/highlight accents.
- **Secondary brown — `#5A4A38`** and supporting teal/slate `#1F4E5F`.
- **Semantic positive green — `#3B6A24`**: genuine success/GPS/nature only.
- **Red — `#BA1A1A`**: error, destructive and live-recording semantics.

### Hard usage rules

- Green is not a generic action/selection/progression colour.
- Primary CTA is orange, not green.
- Active navigation, selected sport/filter, XP/progression and weekly-chart primary series must not use generic green.
- Central Ride emphasis, where used, is warm orange/amber.
- GPS locked and genuine success may use semantic green.
- Maps/charts remain functional; navigation routes may use conventional blue/teal where clarity benefits.
- Existing raw theme tokens are not permission to keep old semantic roles. New implementation consumes semantic roles.

## 4. Typography contract

Typography is where Grand Prix Modern differs most from the current arcade-heavy implementation.

### Required semantic roles

- `body` — ordinary copy, descriptions, settings, form helper text;
- `bodyMedium` — list rows, controls and compact labels;
- `title` — screen and section titles;
- `displayEditorial` — selected premium/Grand-Prix hero titles only;
- `metric` — large numeric values with clear tabular numerals;
- `metricLabel` — compact readable labels for sport data;
- `displayPixel` — rare decorative/brand label;
- `badgePixel` — very small special achievement/event labels.

### Rules

- Normal UI copy uses a modern sans/system face.
- Sport numbers use a clean numeric style with tabular figures.
- A premium editorial/serif face may be used for selected hero headings where it supports the Grand Prix atmosphere.
- Pixel fonts are **specialist decoration**, not the default UI font.
- Pixel font must not be used for long text, forms, Settings, map labels, routine navigation or dense statistics.
- Text must remain readable with platform font scaling enabled.

## 5. Pixel-art placement

### Encouraged

Pixel art is a first-class brand element in:

- full-width hero scenes;
- cyclist and rider illustrations;
- onboarding scenery;
- city landmarks and silhouettes;
- city crests and club identity;
- achievements and collectible badges;
- race/event banners;
- quest art;
- Ride Summary celebrations;
- social/share cards;
- selected dividers, corner ornaments and subtle micro-details.

### Restricted

Pixel art must not dominate:

- text inputs;
- Settings;
- authentication fields;
- long lists;
- chart axes/labels;
- maps;
- ride metrics;
- privacy/security UI;
- standard navigation controls.

The user should perceive **pixel art around the product**, not have to read the product through pixel art.

## 6. Surface and component contract

Two surface families are allowed.

### A. Modern product chrome — default

Used for routine product UI:

- cards;
- lists;
- forms;
- statistics;
- filters;
- tabs;
- settings;
- map overlays.

Characteristics:

- restrained border or tonal separation;
- moderate corner radius;
- minimal/subtle elevation;
- clear spacing;
- no hard offset shadow by default;
- modern readable typography.

### B. Grand Prix special chrome — exceptional

Used for:

- event cards;
- city/club identity;
- achievements;
- hero callouts;
- Ride Summary celebration;
- selected onboarding moments.

Characteristics may include:

- parchment texture;
- heraldic frame;
- harder outline;
- gold trim;
- pixel corners;
- decorative typography.

A normal screen should not make every container a special surface.

## 7. Buttons and touch targets

### Primary action

- visually dominant;
- minimum comfortable one-hand target;
- clear label plus optional simple icon;
- burnt orange as the default primary action treatment;
- no tiny pixel-font labels.

### Secondary action

- calmer tonal/outlined treatment;
- must not compete with the primary CTA.

### Destructive action

- explicit red/destructive semantics;
- confirmation where data/session loss is possible.

### Riding controls

- large thumb targets;
- actions must remain recognisable without reading long copy;
- STOP remains protected by hold/confirm;
- no decorative interaction that competes with safety-critical actions.

## 8. Navigation contract

Current information architecture remains valid unless a later product decision changes it.

Primary domains remain:

- Ride/Home;
- Compete;
- Explore;
- Profile.

The active ride/tracking surface remains outside ordinary browsing behaviour.

Bottom navigation should become modern product chrome. Pixel icons may remain if they are crisp and immediately recognisable, but typography and active-state treatment must be modern and quiet.

## 9. Auth and onboarding contract — first implementation slice

Auth/onboarding is the first implementation slice because it establishes the visual language without risking ride-domain behaviour.

### Flow

The target entry flow is:

1. **Welcome**
2. **Sign in**
3. **Sign up**
4. **Choose city**
5. **Choose club/team or skip**
6. **Ready / completion**

Existing authentication, session and onboarding-completion behaviour must be preserved unless a separate functional change is explicitly approved.

### 9.1 Welcome

Purpose: establish brand and explain that 4VELO is more than ride recording.

Required composition:

- large pixel-art cycling scene;
- 4VELO brand;
- one short message;
- primary CTA: create/start;
- secondary CTA: already have account / sign in;
- optional restrained social-auth entry.

Do not overload this screen with feature lists.

### 9.2 Sign in

Purpose: fastest possible return path.

Required:

- email/username;
- password;
- show/hide password;
- forgot-password entry if supported;
- primary Sign in CTA;
- account creation link;
- existing supported social providers only.

Form fields use clean modern inputs. Pixel styling belongs to the scene/header, not the input text.

### 9.3 Sign up

Required:

- username/display identity according to current backend contract;
- email;
- password;
- password confirmation if currently required/client-validated;
- Terms/Privacy acceptance according to current legal flow;
- primary Create account CTA;
- existing supported social providers only.

Do not invent new required backend fields as part of a visual redesign.

### 9.4 Choose city

City selection must be data-driven from existing public tenant/city data, not a permanently hard-coded list of four mock cities.

UI may show:

- search field;
- suggested/popular city cards;
- crest/landmark art;
- selected state;
- city name and optional member/context metadata when available.

The layout may visually feature Siedlce in fixtures/design previews, but production behaviour must support the full API result set.

### 9.5 Choose club/team or skip

The repository already has backend club concepts and club APIs, but mobile club integration must not be faked with static production data.

Rules:

- when a production mobile club list/join contract is available, show eligible clubs after city selection;
- provide search when useful;
- make membership selection explicit;
- always provide **Skip for now** unless product rules later make membership mandatory;
- if this screen is implemented before mobile club API wiring is ready, ship the skip path and fixture/demo presentation only behind the existing vision-fixture mechanism rather than pretending a successful production join.

Existing department/team onboarding behaviour must be reviewed during UI-02 so it is not silently removed if it still serves a separate product purpose.

### 9.6 Ready / completion

A short completion moment may use stronger Grand Prix styling:

- crest/badge;
- selected city/club summary;
- rider/cyclist art;
- one primary CTA to enter 4VELO.

Completion persistence and refresh behaviour must remain reliable offline/retry-safe as in the current bootstrap flow.

## 10. Home / Ride Dashboard contract

Home is the first major post-auth surface and should express the Grand Prix Modern identity strongly.

### Above the fold

1. lightweight rider/city context;
2. large pixel-art cycling hero scene;
3. greeting / selected sport;
4. dominant **Start Ride** CTA;
5. compact weekly status or progression context.

### Below the fold

- last ride;
- weekly load;
- current quest/challenge;
- upcoming event;
- club/community activity where useful.

### Rules

- pixel art may be visually large, especially in the hero;
- statistics remain modern and calm;
- do not wrap every metric in a heavy bordered tile;
- Start Ride must remain unmistakable;
- existing ride-start logic and activity-type selection remain unchanged unless separately approved.

## 11. Active Ride contract

Active Ride is the **focus zone**, not a Grand Prix poster.

Keep:

- map as the base layer;
- current status bar;
- data field model;
- navigation hint;
- GPS recovery;
- pause/resume;
- protected stop.

Required visual behaviour:

- very large, high-contrast primary metrics;
- clean numeric typography;
- minimal decoration;
- strong day-mode sunlight readability;
- night-mode compatibility;
- large controls in thumb reach;
- state communicated by icon/shape as well as colour;
- cyclist pixel marker allowed;
- subtle city/brand motifs allowed only if they do not obstruct map/data.

No full scenic pixel-art background behind live ride metrics.

## 12. Ride Summary contract

Ride Summary is intentionally more expressive than Active Ride.

Allowed:

- victory cyclist;
- pixel-art city/race scene;
- achievement reveal;
- badge/rank treatment;
- limited particles/celebration;
- shareable art card.

But:

- ride data remains clean and legible;
- primary actions have modern hierarchy;
- decorative art must not push essential result data below an unreasonable fold.

## 13. Profile, Compete and Explore

### Profile

Premium rider identity + achievements, but not an RPG character sheet. Use modern stat/list structures with pixel/avatar/badge identity layered on top.

### Compete

This remains the most expressive engagement domain. City Wars, crests, event banners and challenge badges may use stronger Grand Prix styling. Leaderboards and numeric comparisons remain highly readable.

### Explore

Map and discovery utility first. Pixel art supports place identity and event/POI cards; it must never make the map itself less functional.

## 14. Accessibility and outdoor use

All implementation slices must preserve:

- dynamic text/font scaling where practical;
- meaningful accessibility labels;
- non-colour-only state communication;
- reduced-motion behaviour;
- minimum useful touch targets;
- high contrast for ride-critical information;
- one-handed reach for ride-critical actions;
- safe-area handling;
- day/night HUD behaviour where relevant.

Active Ride acceptance requires real-device outdoor verification; emulator appearance is not sufficient.

## 15. Existing assets and components

### Preserve and reuse where appropriate

- `SceneBackground` and scene layers;
- `CyclistSprite`;
- `CrestIcon` and city art;
- achievements/badges;
- `RideMapView`;
- `DataFieldGrid`;
- `RideStatusBar`;
- `RideActionBar`;
- `EdgeStateBanner`;
- `EmptyState` / `SkeletonBlock`;
- existing generated Grand Prix asset pack.

### Reduce from default usage

- `PixelText`;
- `ArcadeButton`;
- `RetroInput`;
- `GameCard`;
- `GameTabBar`;
- `OrnateFrame` as a routine container.

These may remain specialist components; they are not the default visual language.

## 16. Implementation policy

### UI-01 — Design Contract

This document + audit only. No runtime changes.

### UI-02 — Auth + Onboarding

Target scope:

- Welcome;
- Sign in;
- Sign up;
- city selection;
- club/team or skip step with truthful data behaviour;
- completion screen;
- shared form/button/surface typography primitives required by those screens;
- preserve auth/session/onboarding semantics;
- targeted tests and screenshots.

### UI-03 — Home

- rebuild visual hierarchy of `RideDashboardScreen`;
- preserve ride-start behaviour;
- establish production Home visual baseline.

### UI-04 — Active Ride

- typography/spacing/contrast/control hierarchy only unless a functional defect is discovered;
- preserve telemetry/GPS/ride lifecycle behaviour;
- real-device sunlight QA required.

### UI-05 — Ride Summary

- modern data hierarchy + Grand Prix celebration layer;
- share flow preserved.

Then proceed to Profile → Compete → Explore → secondary utility/data screens.

## 17. PR discipline

- One implementation slice per PR.
- Do not mix security/network/auth-backend rewrites into a visual PR unless essential and explicitly documented.
- No broad navigation rewrites during visual migration.
- Existing tests stay green.
- Add visual/interaction tests for newly introduced shared primitives where practical.
- Each screen PR must include before/after screenshots or deterministic visual-fixture evidence.
- Keep rollback small: visual slices must be independently revertible.

## 18. Acceptance gate for UI-02

Auth/Onboarding is ready only when:

- Welcome, Sign in, Sign up and onboarding screens visibly belong to one Grand Prix Modern system;
- normal form copy is modern/readable, not pixel-font dominated;
- pixel art is prominent in scenes/identity rather than in form mechanics;
- production city selection is API/data driven;
- club/team presentation does not fake production membership behaviour;
- skip path works where club membership is optional;
- auth success/failure behaviour is unchanged or explicitly tested;
- onboarding completion persists correctly;
- PL and EN strings remain complete;
- TypeScript, ESLint and mobile unit tests are green;
- no inline colour literals are introduced in screens;
- screenshots are captured for the approved visual states.

## 19. Decision log

### 2026-09-16

**Selected:** Direction B — **Grand Prix Modern**.

The selected direction is specifically characterised by:

- dark green + cream + restrained gold;
- a **large pixel-art cycling scene** as a major visual signature;
- crests, badges and heraldic/racing details;
- a lightly prestigious Grand Prix atmosphere;
- calmer decoration in routine product areas;
- maximum clarity for statistics, maps and ride-critical controls.

Direction A (Performance Pixel) and Direction C (City Ride) remain useful references but are **not** the global visual direction. Performance-style clarity is a usability rule, not a competing aesthetic. City-local identity remains a domain motif within the Grand Prix Modern system.

This decision supersedes any wording in the UI audit that recommends an A+B hybrid.

## 20. Asset governance amendment — 2026-09-18

This amendment is normative for all mobile work after the approved visual refinement.

- The existing \`assets/generated/**\` artwork is **legacy/unapproved visual material**, not a visual reference for new UI. It may remain temporarily wired where removing it would create an unrelated functional change, but new screens must not treat it as the target style.
- New brand artwork must follow \`MOBILE_ASSET_BIBLE_V1.md\` and the production queue in \`MOBILE_ASSET_PRODUCTION_LIST_V1.md\`.
- Functional navigation/action icons should come from a consistent modern icon system or purpose-built vector set; they should not be bulk-generated as decorative pixel art.
- Official municipal crests, club logos and other official marks must never be recreated or approximated by image generation. They require verified provenance. If a verified crest is unavailable, the product uses the canonical 4VELO Place Badge fallback.
- No place requires a custom image asset in order to render correctly.
- The accepted visual direction is navy + cream/parchment + orange/amber product chrome; green remains semantic for success/GPS/nature rather than a generic selected/active accent.
- Asset approval is explicit. Presence in the repository, generation by an old pipeline, or wiring in \`visionAssets.ts\` does not imply approval.

The machine-readable companion policy is \`assets/ASSET_GOVERNANCE_V1.json\`. CI validates it and treats unreviewed changes to the legacy generated inventory as asset-governance drift.
