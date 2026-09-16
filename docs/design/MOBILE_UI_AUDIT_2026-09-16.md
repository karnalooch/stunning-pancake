# 4VELO Mobile UI Audit — 2026-09-16

| | |
|---|---|
| **Status** | Proposed design-direction reset; audit only |
| **Scope** | `mobile/` runtime UI, navigation, theme, generated assets, historical visual-parity evidence |
| **Code changes** | None |
| **Decision needed** | Select the next visual direction before implementation |
| **Related SSOT** | `docs/design/DESIGN_SYSTEM_MOBILE.md`, ADR 014, `4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md` |

## 1. Executive summary

The mobile app does **not** need a visual rewrite from zero. The repository already contains a useful navigation contract, mature ride-domain components, a coherent Grand Prix palette, a large generated pixel-art asset pack, and reusable UI/game primitives.

The main problem is **visual weighting**: the pixel/arcade language is currently applied to ordinary product UI too aggressively. Pixel display fonts, heavy black borders, hard offset shadows, parchment cards and game-flavoured components are used for navigation labels, settings, statistics, controls and routine content. This makes a sports/cycling product read like a retro game UI.

The updated product direction should be:

> **Sports app first, pixel art second.**
>
> 4VELO should feel like a modern cycling product with a distinctive pixel-art identity — not like a retro game that happens to record rides.

Pixel art remains a first-class brand asset for illustrations, cyclist sprites, city identity, achievements, badges, celebratory moments, share cards, selected frames and micro-details. Functional text, numbers, charts, maps, settings and ride controls should use modern, high-legibility UI conventions.

The current design SSOT already contains the correct high-level principle — “bike-computer core, pixel-art skin” and “skin never reduces legibility or safety” — but several normative details now conflict with the desired product direction. In particular, it treats the Home screen as a “main menu of the game” and prescribes pixel fonts too broadly. Those rules should be revised after a visual direction is selected.

## 2. Current UI inventory

### 2.1 Primary navigation

The app has four visible primary tabs:

- **Ride** — pre-ride dashboard / start surface;
- **Compete** — city competition, leaderboard and quests;
- **Explore** — map and marketplace entry point;
- **Profile** — athlete identity, stats and achievements.

A hidden **Tracking** tab hosts the active ride HUD.

Root-stack surfaces include Settings, Training Log, GPS Diagnostics, Clubs, Segments, Explore Map, Marketplace, Activity Detail, Performance Trends, Global Leaderboard, Ride Paused and Ride Summary.

This information architecture is broadly useful and should be preserved during the visual redesign.

### 2.2 Screen inventory

`mobile/src/screens/` currently contains 19 screen modules:

1. `ActiveRideHUDScreen`
2. `ActivityDetailScreen`
3. `AthleteProfileScreen`
4. `CityHubScreen`
5. `ClubsDirectoryScreen`
6. `ExploreHubScreen`
7. `ExploreMapScreen`
8. `GlobalLeaderboardScreen`
9. `GpsDiagnosticsScreen`
10. `MarketplaceScreen`
11. `OnboardingScreen`
12. `PerformanceTrendsScreen`
13. `RideDashboardScreen`
14. `RidePausedScreen`
15. `RideSummaryScreen`
16. `SegmentsScreen`
17. `SettingsScreen`
18. `TrainingLogScreen`
19. `VisionGalleryScreen`

Auth and splash surfaces live outside `screens/`, so the full user-facing surface area is larger than this list.

### 2.3 Reusable UI already worth keeping

The codebase already has reusable building blocks rather than a collection of unrelated screens.

**Utility/product primitives:**

- `AppHeader`
- `EdgeStateBanner`
- `EmptyState`
- `SkeletonBlock`
- `RideMapView`
- `DataFieldGrid` / `DataFieldCell`
- `RideStatusBar`
- `RideActionBar`
- `RideNavigationHint`

**Brand / pixel-art primitives:**

- `RiderAvatar` / `AvatarFramed`
- `PixelIcon`, `ChromeIcon`, `CrestIcon`, `DepartmentIcon`
- `SceneBackground`, scene layers and ambient treatment
- `CyclistSprite`
- `AchievementGrid`
- `CityBanner`, `VersusBar`
- `LevelXpBar`, `StreakBadge`, `DailyQuestCard`
- `FinishCelebration`, `ParticleSystem`, `ShareResultCard`
- `OrnateFrame`, `LaurelHeader`, `TextureBackground`

**Legacy/overused retro primitives that need reduced scope:**

- `PixelText`
- `ArcadeButton`
- `RetroInput`
- `GameCard`
- `GameTabBar`

These components do not necessarily need deletion. Most should become specialist brand components rather than defaults for routine app UI.

## 3. What is currently working

### 3.1 Product architecture

The app already separates the active ride “focus” experience from engagement surfaces. The active ride uses MapLibre + data fields + status/action chrome rather than a scrolling game scene. This is the correct safety/performance architecture and should remain.

### 3.2 Active ride functionality

`ActiveRideHUDScreen` is substantially more mature than the historical June audit implies. It already composes:

- map layer;
- GPS/battery/clock status bar;
- navigation hint;
- GPS recovery state;
- configurable data grid;
- pause/resume and stop actions.

The stop action has hold-to-confirm behaviour, which is appropriate for accidental-touch prevention during riding.

The redesign here should therefore be a **presentation and interaction-hierarchy pass**, not a domain rewrite.

### 3.3 Palette identity

The active Grand Prix theme provides a viable brand base:

- warm off-white / parchment surfaces;
- forest green primary;
- orange CTA;
- deep navy ink/chrome;
- dedicated HUD, scene and zone roles.

The palette is distinctive enough to keep. The main change should be how often colours, outlines and surfaces are used — not a wholesale palette replacement.

### 3.4 Asset pack

The repository already contains strong pixel-art material:

- day / sunset / night skies;
- road, hills and town layers;
- cyclist expressions and sprite assets;
- city crests;
- department icons;
- achievement badges;
- currency and game icons;
- HUD action icons;
- finish and city banners;
- textures and ornate frames.

This is valuable brand capital. The redesign should expose these assets more deliberately while reducing pixel styling on ordinary text and controls.

### 3.5 Engagement moments

The strongest places for the existing pixel-art language are also the places where it already makes conceptual sense:

- Ride Summary / celebration;
- City Hub / City Wars;
- achievements and streaks;
- profile avatar and identity;
- onboarding illustrations;
- shareable result cards;
- marketplace / rewards.

These should remain more expressive than utility screens.

## 4. Primary problems

### 4.1 Typography is the largest systemic issue

The runtime font tokens currently treat `Silkscreen` as the general display face and `VT323` as the numeric/metric face. The display font is used widely across screen titles, card labels, statistics, settings rows, controls and navigation. The tab bar itself uses VT323 labels.

This creates a retro-game reading experience even where no pixel art is visible.

**Target:**

- ordinary body text: modern sans/system UI;
- controls and navigation: modern sans, medium/semibold;
- statistics and ride metrics: clean tabular numerals;
- pixel display font: limited to brand headings, badges, special event labels and decorative microcopy.

A useful design constraint is to keep pixel-font usage to roughly **10–15% of visible text**, rather than making it the default typography layer.

### 4.2 Heavy chrome is overused

The visual system frequently uses:

- 2–4 px dark borders;
- hard 2–4 px offset shadows;
- parchment surfaces;
- square/pixel corners;
- ornate frames;
- uppercase labels.

These treatments are effective when reserved for collectibles, special cards or celebration moments. Applied everywhere, they flatten hierarchy: Settings, a metric tile and a City Wars event all look equally “special”.

**Target:**

- normal cards: subtle 1 px outline or tonal separation, 12–16 px radius, little/no shadow;
- primary action: clear modern button with strong colour and large touch target;
- hard pixel border/shadow: badges, achievements, special challenge/event cards, avatar frames, selected celebratory surfaces.

### 4.3 The current SSOT overstates “game” framing

The existing SSOT correctly says “bike-computer core, pixel-art skin”, but later describes Home as the “main menu of the game” and maximises gaming intensity across multiple engagement surfaces.

That framing should be amended. Engagement can be playful without making the overall app resemble a game launcher.

### 4.4 Historical parity is no longer the target

The June emulator/parity evidence remains useful as diagnostic history, but the old mockups represent the older Grand Prix-heavy direction. Some screens passed that target precisely because they leaned hard into the arcade language.

Therefore:

- retain old screenshots as reference/evidence;
- do not use old SSIM parity as the acceptance gate for the new design;
- establish a new set of visual baselines after the new Home and Ride direction is approved.

### 4.5 Some screens need product/IA work, not just restyling

`ExploreHubScreen` is the clearest example: it currently functions mainly as two entry buttons (Map, Marketplace) plus explanatory text. A prettier skin will not solve the weak product purpose.

Explore should eventually surface useful discovery content directly, e.g. nearby POIs, route/event suggestions, map preview or city highlights.

## 5. Screen-by-screen disposition

| Surface | Keep | Change | Priority |
|---|---|---|---|
| **Ride Dashboard / Home** | information structure, start flow, sport selector, last ride, weekly load, streak/quest | typography, card system, density, hero hierarchy, CTA, chart polish | **P0** |
| **Active Ride HUD** | map architecture, status, data grid, GPS recovery, hold-to-stop | clean metric typography, spacing, button hierarchy, daylight contrast verification | **P0** |
| **Ride Summary** | celebration, rank, cyclist, particles, share card | modern stat typography and CTA hierarchy; keep pixel art as celebration layer | P1 |
| **Profile** | avatar, XP, achievements, stats, training/trends links | reduce RPG-sheet framing; modernise stats/actions | P1 |
| **Compete / City Hub** | City Wars, crests, VS, quests, leaderboard, expressive art | simplify routine rows/text; retain highest pixel intensity here | P1 |
| **Explore Hub** | routes to Map/Marketplace | redesign IA; add direct discovery value | P1/P2 |
| **Explore Map** | map-first utility | modern overlays/filters/cards, no decorative map obstruction | P1/P2 |
| **Onboarding** | scenes, crests, city/team identity | normal body/selection typography; simpler controls | P2 |
| **Settings** | current capabilities and section model | utility-first conventional settings UI; remove arcade typography/chrome | P2 |
| **GPS Diagnostics** | recovery functionality | utility-first hierarchy and readable diagnostics | P2 |
| **Training / Activity Detail / Trends / Leaderboard** | data and navigation | shared modern data/list/chart primitives | P2 |
| **Marketplace** | pixel-art rewards identity | preserve playfulness but adopt common modern product chrome | P2 |
| **Clubs / Segments** | domain entry points | bring into shared list/card system | P2 |

## 6. Proposed visual language v1

### 6.1 Typography roles

Introduce explicit semantic roles instead of `display` / `mono` as global defaults:

- `body` — regular UI copy;
- `bodyMedium` — controls / list rows;
- `title` — screen/section title;
- `metric` — tabular-number capable face/style;
- `metricLabel` — compact legible label;
- `displayPixel` — decorative branded headings only;
- `badgePixel` — tiny special labels/badges only.

Use system fonts initially if necessary; font-family selection can be changed independently once hierarchy is correct.

### 6.2 Surface roles

Define semantic surfaces rather than styling every container as a game card:

- `screen`;
- `surface`;
- `surfaceRaised`;
- `surfaceInteractive`;
- `surfaceSelected`;
- `surfaceSpecialPixel`;
- `hudSurface`.

### 6.3 Corners, outlines and shadows

Use two visual families:

**Modern product chrome**
- 12–16 px corner radius;
- 1 px or tonal outline;
- subtle elevation;
- generous spacing.

**Pixel-brand chrome**
- hard outline;
- hard offset shadow;
- square/pixel corners;
- only for special branded moments.

### 6.4 Pixel-art placement

Pixel art is explicitly encouraged in:

- scene illustrations;
- cyclist/avatars;
- city crests;
- achievements/badges;
- quest/event cards;
- result celebration;
- share cards;
- selected icons and decorative dividers;
- special frames.

Pixel art should not reduce legibility of:

- navigation;
- settings;
- map labels;
- charts;
- ride metrics;
- long body copy;
- inputs;
- routine list rows.

## 7. Three candidate directions

### Direction A — Performance Pixel

**Character:** modern performance/cycling product with pixel-art personality.

- warm clean surfaces;
- forest/navy information hierarchy;
- orange primary ride CTA;
- large clean statistics;
- modern charts;
- one pixel-art cyclist/scene element as the visual signature;
- achievements and challenges retain richer pixel treatment.

**Best for:** readability, credibility as a serious cycling app, scalable component system.

### Direction B — Grand Prix Modern

**Character:** preserve more of the current warm illustrated Grand Prix identity, but remove retro-game typography from routine UI.

- richer scene art than Direction A;
- parchment remains visible as a brand material;
- pixel frames only for special cards;
- modern typography for data/content;
- expressive City Wars / Summary / Profile moments.

**Best for:** maximum brand distinction without returning to an arcade UI.

### Direction C — City Ride

**Character:** city/map/social discovery first.

- map previews and local context high in the hierarchy;
- city/club identity and rivalry prominent;
- routes, POIs, quests and events feel connected;
- pixel art communicates city identity, badges and social progression;
- modern utility layer underneath.

**Best for:** making Compete + Explore feel like a unique 4VELO ecosystem rather than extra tabs.

## 8. Recommended direction to prototype

Prototype a **hybrid of A + B**:

- use **Performance Pixel** for information architecture, typography, metrics, controls and normal cards;
- use **Grand Prix Modern** for scenes, cyclist art, achievements, city identity, celebration and selected special frames.

Treat **City Ride** as a domain-specific influence for Compete and Explore rather than the global app shell.

This gives 4VELO a recognisable visual identity while keeping the product credible as an outdoor sports tool.

## 9. First Home / Ride prototype contract

The first visual prototype should prove the new system on `RideDashboardScreen` before broad implementation.

### Home content hierarchy

1. lightweight top bar: rider/avatar + current context + settings;
2. primary ride hero: selected sport + **Start Ride** as dominant action;
3. compact current goal / quest strip;
4. last ride summary;
5. weekly training/load chart;
6. optional progression/streak as secondary engagement, not primary chrome;
7. bottom navigation.

### Home visual rules

- normal typography for username, labels and stats;
- clean metric digits;
- pixel cyclist/scene can occupy a hero edge/background area;
- no thick black border around every card;
- one strong orange CTA;
- one or two pixel-special surfaces maximum above the fold.

### Active Ride visual rules

- no decorative scene behind live data;
- map stays the base;
- large high-contrast speed/distance/time;
- labels remain readable at a glance;
- bottom controls in thumb reach;
- stop remains protected by hold/confirm;
- day/night contrast tested on a real phone outdoors.

## 10. Implementation sequence after direction approval

### PR UI-0 — Design contract only

- revise `DESIGN_SYSTEM_MOBILE.md` and ADR 014 to the new “sports app first” rule;
- add semantic typography/surface/corner/shadow tokens;
- define which existing pixel components are specialist vs default;
- no screen redesign yet.

### PR UI-1 — Home foundation

- modernise `RideDashboardScreen`;
- introduce/reuse clean Card, Stat, SectionHeader and primary Button primitives;
- retain all existing ride-start behaviour;
- add new visual baseline.

### PR UI-2 — App shell

- modernise `GameTabBar` and `AppHeader`;
- retain pixel PNG icons if they remain crisp/clear;
- use conventional navigation typography.

### PR UI-3 — Active Ride polish

- preserve domain architecture;
- modernise DataField/HUD typography and spacing;
- refine action controls and outdoor readability;
- verify one-handed operation.

### PR UI-4 — Summary + Profile

- keep celebration/achievement art;
- move ordinary stats and actions to the modern component system.

### PR UI-5 — Compete

- preserve highest pixel-art intensity;
- simplify leaderboard/quest chrome and normal text.

### PR UI-6 — Explore product pass

- define useful direct discovery content;
- modernise Map overlays and Marketplace entry.

### PR UI-7 — Onboarding and utility surfaces

- Onboarding, Settings, GPS Diagnostics, Training, Activity Detail, Trends, secondary screens.

## 11. Acceptance criteria

The redesign is successful when:

- a first-time user reads 4VELO as a **cycling/sports app** before reading it as a game;
- pixel art is immediately recognisable as brand identity without dominating routine UI;
- ride data and actions are legible at a glance outdoors;
- the active ride remains map/data-first and one-hand operable;
- maps and charts remain crisp and functional;
- common controls look consistent across all four primary tabs;
- existing ride/auth/telemetry behaviour is unchanged by visual PRs;
- accessibility/reduced-motion behaviour is preserved;
- new visual snapshots replace the old Grand Prix parity target for redesigned screens.

## 12. Audit decision

**Do not rewrite the mobile app. Do not throw away the asset pack. Do not chase the old visual-parity target.**

Preserve the current information architecture, ride-domain implementation, palette and pixel-art assets. Replace the default visual grammar around them with a modern sports UI system, and reserve the strong Grand Prix/pixel treatment for the moments where it creates identity rather than friction.
