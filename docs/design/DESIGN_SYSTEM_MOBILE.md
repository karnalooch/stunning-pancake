# Mobile Design System — 4VELO (Active SSOT)

| | |
|--|--|
| **Status** | ✅ Active (living spec) |
| **Owner role** | Mobile Lead / Design |
| **Last reviewed** | 2026-06-13 |
| **Audience** | Mobile engineers, designers, product |
| **lang** | en |
| **canonical_path** | docs/design/DESIGN_SYSTEM_MOBILE.md |
| **Decision record** | [ADR 014](../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) · [ADR 006 (Stitch)](../adr/006-design-system-stitch.md) |
| **Traceability** | [MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md](./MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |
| **Detailed reference** | [docs/archive/designmobile.md](../archive/designmobile.md) (component/token/mockup appendix) |

---

This is the living design SSOT for the 4VELO mobile app. It supersedes the archived snapshot [`docs/archive/designmobile.md`](../archive/designmobile.md) as the source of truth for **direction and systems**; the archived doc is retained as a detailed component/token/mockup reference appendix.

## 1. Direction: bike-computer core, pixel-art skin

The product core is a **bike computer / navigation tool** (cycling, running, nordic walking) with **editable data fields** (inspired by Garmin Edge, Wahoo ELEMNT, Hammerhead Karoo). On top of that we apply an **immersive pixel-art skin** (illustrated scenes, animated cyclist, particles, comic speech bubbles, energy/HUD bars) inspired by the "Cyklo-Siedlce Grand Prix" concept.

**Non-negotiable:** the skin never reduces legibility or safety of ride data. Pixel-art decorates frames, backgrounds and markers; data values stay large and high-contrast.

> This reconciles the older "flat Solar White cards" framing (ADR 006 / archive doc): those card/token rules still apply to **UI chrome**, now composed *over* a swappable scene/map base layer mediated by a scrim. See §5.

## 2. Focus zones vs engagement zones

Screens split into two zones so gaming vibe drives retention without harming the utility core.

| Zone | Screens | Motion / gaming intensity |
|------|---------|---------------------------|
| **Focus** | Active Ride / Navigation | Minimal — cyclist as map marker, occasional speech bubble, energy bar. Data > skin. **No scrolling 2.5D scene under live data.** |
| **Engagement** | Home/Dashboard, Ride Summary, City Hub/Compete, Profile/Bike Garage, Onboarding, Marketplace | Maximum — full scenes, animated cyclist, particles, narration, rewards. |

> The full-screen scrolling 2.5D ride scene (illustrated map + hero seen from behind, speech bubble, hearts) belongs to the **engagement** zone (Dashboard / onboarding / marketing — see [MOBILE_ASSET_NANO_BANANA_PROMPTS.md](./MOBILE_ASSET_NANO_BANANA_PROMPTS.md) §16b `active_ride_hud_mockup`). The **live** Active Ride screen stays focus-mode: MapLibre map + cyclist marker + minimal motion, for battery, safety and motion-sickness reasons. The mockup's data-field layout and sun-readability ARE adopted by the live HUD chrome (see §3).

Cross-screen engagement mechanics: **Level/XP**, **daily streak**, **daily quests** (wired to `TriggerEngine`), and a **shareable pixel-art result card** (Skia snapshot → social). Components: `mobile/src/components/game/` (`LevelXpBar`, `StreakBadge`, `DailyQuestCard`, `ShareResultCard`); logic: `mobile/src/game/` (`progression.ts`, `quests.ts`).

## 3. Data Field System (bike computer)

Garmin/Wahoo/Karoo pattern: the ride screen is a **configurable grid of data fields** plus a navigation map.

- **`DataFieldRegistry`** (`mobile/src/ride/dataFields.ts`) — catalogue of fields: `speed`, `avgSpeed`, `distance`, `time`, `hr`, `power`, `cadence`, `elevation`, `grade`, `heading/compass`, `ETA`, `lap`. Each: `{ id, labelKey, unit, selector, format }`.
- **`DataFieldGrid`** (`mobile/src/components/ride/DataFieldGrid.tsx`) — 1–10 fields, presets (2/4/6/8 + one large central value, e.g. speed). Edit: long-press → edit mode → **drag reorder / resize / swap metric** (`react-native-gesture-handler` + Reanimated). Layouts persisted per ride profile/sport in **MMKV**.
- **`DataFieldCell`** — pixel-art frame (parchment + pixel-border), large value (VT323/monospace), small UPPERCASE label, configurable alert color (e.g. HR zone).
- **Ride profiles** (Road / Training / Race) with separate layouts.
- **Persistence schema** — saved layouts carry a `schemaVersion`; migrations live in `mobile/src/ride/layouts.ts` (avoid crash after field changes).

### Sun-readability spec (normative)

The canonical HUD layout/legibility reference is the `active_ride_hud_mockup` ([MOBILE_ASSET_NANO_BANANA_PROMPTS.md](./MOBILE_ASSET_NANO_BANANA_PROMPTS.md) §16b, §20). Required for outdoor legibility:

- **Framed high-contrast panels:** each field on a light, slightly framed panel with hard 1–2px black outline + hard pixel shadow — legible over any map tile.
- **Number-first hierarchy:** large bold value, smaller unit, small UPPERCASE label. **Numbers in VT323; labels/headers in Press Start 2P.**
- **Status bar:** GPS state (solid green when locked), battery %, clock — black outlines, top of screen.
- **Action bar:** large tactile buttons (icon + label + black outline) — STOP (square, red), PAUSE/RESUME (two bars, yellow), RESUME (triangle, green). **STOP requires confirm (long-press / slide)** to prevent accidental stop while riding.
- **Auto day/night HUD palette** (light panels in sun, dark at night), targeting WCAG-AA contrast in both; **colorblind-safe** (zone/state by icon shape, not color alone).
- **PL data labels** map 1:1 to `DataFieldRegistry`: `PRĘDKOŚĆ`, `DYSTANS`, `CZAS`, `PRZEWYŻSZ.`, `ŚR. PRĘDK.`, `TĘTNO`, `KIERUNEK` (all via i18n).

> **Font fix (follow-up):** the app loads `'Press Start 2P'` in `mobile/App.tsx` but components reference `'PressStart2P'`, so the pixel font currently falls back to system. Register both VT323 and Press Start 2P and align the family names before relying on this spec.

## 4. Navigation Mode

- Base map: **MapLibre** (`mobile/src/components/RideMapView.tsx`) with a **custom retro/pixel-art style** (style JSON).
- Route line, **position marker rendered as `CyclistSprite`** (rotates by `heading`), turn-by-turn arrows/cues, auto-zoom by speed, compass.
- Routing via existing **BRouter/OSRM** (`infrastructure/`). Turn-by-turn depends on maneuver instructions from the routing engine; fallback for phase 1: route line + distance-to-turn only.
- Bottom ride actions: **STOP / PAUSE-RESUME / RESUME** (arcade buttons).

## 5. Scene / Scrim Layering & palette

Swappable base layer under a shared render stack:

```
base (SceneBackground parallax  OR  MapLibre retro)
  → AmbientLayer (time-of-day tint, optional CRT scanlines/vignette)
  → ParticleSystem (Skia drawAtlas: flame, sweat, dust, hearts)
  → CyclistSprite (sprite sheet animator / map marker)
  → Scrim (gradient under UI)
  → UI (DataFieldGrid, parchment cards, metrics)
  → SpeechBubble / narration overlay
```

- **Palette rule:** scenes/parallax may use a richer, more saturated palette than "Solar White"; **UI chrome keeps Stitch tokens** for legibility. The boundary is mediated by `scrim` tokens.
- **New theme tokens** (`mobile/src/theme/stitch.ts`): `scrimStrong`, `scrimSoft`, `sceneOverlay` + contrast rules (cards on scenes get stronger shadow/border).
- **Single token source:** color tokens must resolve to one SSOT (consolidate `stitch.ts` vs legacy octopath/solar in `unistyles.ts` vs `@4velo/tokens`); rest generated from it. (Decision tracked in ADR 014.) Add dedicated `hud*` tokens for sun-readable chrome (AA contrast in day/night). Express hard pixel shadow / outline as tokens, not hardcoded values.
- **Configurable hero:** the cyclist is one base sprite; **helmet color (palette-swap)** and **jersey city text (i18n decal)** are theming layers driven by the onboarding city — not baked per sprite (see [MOBILE_ASSET_NANO_BANANA_PROMPTS.md](./MOBILE_ASSET_NANO_BANANA_PROMPTS.md) §2). The `CyclistSprite` and map marker render the configured hero.
- **Map cohesion:** the retro MapLibre style uses the same palette tokens as scenes. Optional regional landmark per onboarding city in the scene (e.g. Park Sikorski for Siedlce).
- Scene registry: `mobile/src/theme/scenes.ts` maps `screenId → { layers, palette, ambient, particles }`.

Component folders: `components/scene/`, `components/sprites/`, `components/effects/`, `components/narration/`, `components/ride/`.

## 6. Audio (4 layers)

Audio is ~50% of game feel and is **safety-critical while riding** (eyes-free cues). Four layers, each with independent volume + mute:

1. **UI SFX (8-bit)** — button/tab/buy/error clicks (short WAVs, preloaded).
2. **Reward / dopamine** — victory jingle, crowd cheer, level-up, coin pickup.
3. **Data-driven ambient** — `wind_rush` (volume ∝ speed), `chain_hum` (∝ cadence), tire surface/weather loops; mixed with ducking under cues.
4. **Navigation (eyes-free)** — turn-by-turn **TTS (`expo-speech`)** + 8-bit alert before maneuver; HR-zone alerts, auto-pause, "cafe break?".

**Tech:** migrate `SoundService` off the deprecated `expo-av` → **`expo-audio`** (+ `expo-speech` for TTS), keeping procedural tone generation as fallback. Respect silent switch / system volume, global + per-layer mute, audio focus/ducking. A11y: full eyes-free support; audio remains when reduced-motion disables animation. Narration text via i18n (`zustand` store), not hardcoded. Files: `mobile/src/services/SoundService.ts`, new `VoiceCueService.ts`, `HapticService.ts`.

## 7. Engagement Zones — screen-by-screen

- **Home / Dashboard** = "main menu of the game": full scene, idle cyclist, Level/XP bar, streak, daily quest, ride-profile selector + START.
- **Ride Summary** = main dopamine moment: "quest complete", `PixelBurst`/confetti, victory cyclist, S/A/B rank, level-up, + **shareable result card** (top growth lever).
- **City Hub / Compete**: most game-like — City Wars, rival city cyclist, VS bar, "MOO!" cow.
- **Profile / Bike Garage**: RPG character sheet — avatar, trophies, levels, named bike, service, XP upgrades.
- **Onboarding / Marketplace**: per-step scenes; gear, power-ups, currencies.

## 8. Performance, accessibility, rollout

- **Feature flag** `immersiveTheme` (MMKV + Settings toggle) for staged rollout / rollback.
- **Frame budgets**: `useFrameBudgetMonitor` auto-degrades particles/parallax under FPS drops ([ADR 012](../adr/012-mobile-performance-budgets.md)); Skia integer positioning.
- **Battery / background**: auto-pause animations when backgrounded (`AppState`), battery-saver, or low battery; tie to GPS/battery wizard. During riding: data > skin.
- **Reduced motion**: respect system setting — disables parallax/particles, static backgrounds remain.
- **Memory/bundle**: lazy-load scenes per screen, `expo-image` caching, sheet size limits; target < ~1 MB extra bundle.
- **Pixel-icon scaling**: render icons with `resizeMode: 'contain'` at integer multiples to keep pixels crisp (no blur on high-DPR screens).
- **Analytics**: instrument quest-complete, share, streak, level-up, layout-edit into telemetry/Datadog.
- **Tests**: extend Maestro (`mobile/.maestro/`) with transition/scene smoke; optional visual snapshots.

## 9. Asset pipeline (improved)

Canonical per-asset prompts (Cyklo-Siedlce Grand Prix art direction) for **Nano Banana Pro** (`gemini-3-pro-image`) live in [MOBILE_ASSET_NANO_BANANA_PROMPTS.md](./MOBILE_ASSET_NANO_BANANA_PROMPTS.md), each with the reference sheet attached. UI tab icons are generated as **PNG** there, not hand-authored SVG.

Keep Gemini for raw PNG; add a deterministic post-process chain (see [ADR 014](../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) §7 and [scripts/asset_definitions.py](../../scripts/asset_definitions.py)):

1. palette-quant → limited palette, nearest-neighbor scale, trim/align.
2. sprite packing (free-tex-packer CLI) → atlases + frame JSON for `drawAtlas`.
3. lossless compression (`pngquant`/`oxipng`).
4. manifest with prompt-hash + seed for reproducibility ([assets/generated/ASSET_MANIFEST.json](../../assets/generated/ASSET_MANIFEST.json)).
5. reference-locked character frame generation (seed/img2img) for animation coherence; optional Aseprite touch-up.

New categories: `environment/` (parallax layers), `sprites/` (cyclist sheets), `particles/`, `map/` (retro tiles/markers), `marketing/` (`active_ride_hud_mockup` — store/onboarding hero + HUD layout reference, [§16b](./MOBILE_ASSET_NANO_BANANA_PROMPTS.md)). Bundle to `mobile/assets/generated/` + typed manifest `mobile/src/assets/manifest.ts` (static `require()` for Metro). The manifest stores prompt + seed + reference hash so any asset is deterministically regenerable.

## 10. Backlog (P2/P3) and edge states

- **UI integration roadmap (post-asset generation):** [GRAND_PRIX_UI_CONSISTENCY_AUDIT.md](./GRAND_PRIX_UI_CONSISTENCY_AUDIT.md) — wired vs unwired assets, token/font gaps, HUD/scene/particle follow-up, PR sequence (~10–14 days).
- **Edge states in pixel-art** (not system defaults): GPS-lost banner, no-data, offline — styled to match the skin.
- **Share card** in dedicated social formats (1080×1920 portrait / 1200×630 OG), deterministic render, brand mark.
- Seasons / Battle Pass (civic), Ghost-race (self vs ghost, `ghost_sheet.png`), animated result card (GIF/mp4), Climb mode (auto climb profile), post-ride bike-service ritual.
- Deliberately rejected (out of 90-day scope / regulation): move-to-earn / crypto, in-app entry fees, minigames detached from riding.
