# ADR 014: Mobile immersive pixel-art skin over a bike-computer / navigation core

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Product |
| **Last reviewed** | 2026-06-13 |
| **Audience** | Mobile engineers, designers, product |
| **lang** | en |
| **translation** | [Polski](../pl/adr/014-mobile-immersive-pixel-art-and-bike-computer.md) |
| **canonical_path** | docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md |
| **Index** | [docs/README.md](../README.md) |
| **Design SSOT** | [docs/design/DESIGN_SYSTEM_MOBILE.md](../design/DESIGN_SYSTEM_MOBILE.md) |

---

## Status

Accepted (2026-06-13). Extends [ADR 006 (Stitch design system)](006-design-system-stitch.md). Supersedes the archived proposal [`docs/archive/plans/mobile-asset-enhancement-proposal.md`](../archive/plans/mobile-asset-enhancement-proposal.md).

## Context

We want the mobile app to look and feel like an immersive, animated pixel-art game (reference: the "Cyklo-Siedlce Grand Prix" concept video — illustrated scenes, an animated cyclist, particles, comic speech bubbles, energy/HUD bars), in order to attract a younger audience and improve retention/virality.

At the same time the **primary job of the app is a bike computer / navigation tool** (cycling, running, nordic walking) where data must be glanceable and safe to read while riding. The two goals pull in opposite directions: rich illustrated backgrounds harm legibility of dense data.

The existing design SSOT ([`docs/archive/designmobile.md`](../archive/designmobile.md)) describes a flat "Solar White" card system, lacks any spec for an editable data-field bike computer, navigation mode, scene layering, or audio, and was filed as an archived snapshot. This created an outdated source of truth.

## Decision

**1. Core vs skin.** The product core is a **bike computer / navigation experience with editable data fields** (inspired by Garmin Edge, Wahoo ELEMNT, Hammerhead Karoo). On top of that we apply an **immersive pixel-art skin** (scenes, animated cyclist, particles, narration, audio). The skin must never reduce legibility or safety of ride data: pixel-art decorates frames/backgrounds/markers, while values stay large and high-contrast.

**2. Focus zones vs engagement zones.** Screens are split into two zones so gaming vibe drives retention without harming the utility core:
- **Focus zone (Active Ride / Navigation):** minimal motion — cyclist as map marker, occasional speech bubble, energy bar. Data > skin.
- **Engagement zone (max gaming vibe):** Home/Dashboard ("main menu of the game"), Ride Summary (+ shareable result card), City Hub/Compete, Profile/Bike Garage, Onboarding, Marketplace.

**3. Editable data fields.** A `DataFieldRegistry` + configurable `DataFieldGrid` (1–10 fields, presets, drag reorder/resize via gesture-handler, per-profile/sport layouts persisted in MMKV with a versioned schema).

**4. Layered render architecture.** A swappable base layer (`SceneBackground` parallax OR MapLibre retro style) under a shared stack: AmbientLayer → ParticleSystem (Skia `drawAtlas`) → CyclistSprite → Scrim → UI → SpeechBubble.

**5. Palette: scene vs chrome.** Scenes/parallax may use a richer, more saturated palette than "Solar White"; UI chrome (data fields, cards, metrics) keeps Stitch tokens for legibility. The boundary is mediated by `scrim` tokens added to the theme.

**6. Single token source.** Color tokens must resolve to one source of truth (consolidate `mobile/src/theme/stitch.ts` vs legacy octopath/solar in `unistyles.ts` vs `@4velo/tokens`); the rest is generated from it.

**7. Asset pipeline (improved).** Keep Gemini for raw PNG generation, but add a deterministic post-process chain: palette-quant, nearest-neighbor scaling, sprite packing to atlases (+ frame JSON), lossless compression (`pngquant`/`oxipng`), a manifest with prompt-hash + seed for reproducibility, and reference-locked character frame generation for animation coherence. DeepSeek limited to/replaced by hand-authored SVG icons.

**8. Engine choices.** Reanimated 4 + Skia stay as the core. Additions: MapLibre (already a dependency) with a custom retro/pixel-art style for the ride/navigation screen; Skia `drawAtlas` for batched particles/sprites; `react-native-gesture-handler` for data-field editing. Lottie/Rive are deliberately rejected for pixel-art (vector ≠ pixel sheet, unnecessary bundle).

**9. Audio (4 layers).** UI SFX, reward/dopamine, data-driven ambient (wind ∝ speed, chain ∝ cadence), and eyes-free navigation cues (turn-by-turn TTS via `expo-speech` + 8-bit alerts). Migrate `SoundService` off the deprecated `expo-av` to `expo-audio`. Per-layer mute, ducking, respect silent switch / system volume.

**10. Rollout & guardrails.** Ship behind an `immersiveTheme` feature flag (MMKV + Settings toggle). Respect reduced-motion. Auto-degrade via `useFrameBudgetMonitor` (see [ADR 012](012-mobile-performance-budgets.md)). Auto-pause animations when backgrounded / battery-saver / low battery. Instrument engagement events (quest-complete, share, streak, level-up, layout edit) into telemetry/Datadog.

## Consequences

- **Positive:** clear separation of utility (navigation) from engagement (gaming vibe) reduces the risk of an "all flash, unreadable" UI; shareable pixel-art result card becomes a growth lever.
- **Positive:** a swappable base layer keeps one render stack across scene screens and the map screen.
- **Positive:** improved asset pipeline yields crisp, reproducible, smaller pixel-art assets.
- **Constraint:** immersive effects add GPU/battery cost during active GPS tracking — mitigated by zone rules, frame budgets and background auto-pause.
- **Constraint:** turn-by-turn depends on routing engine output (BRouter/OSRM in `infrastructure/`) exposing maneuver instructions; if unavailable, phase 1 limits navigation to route line + distance-to-turn.
- **Risk:** token-source fragmentation must be resolved early or themes drift again (decision item 6).
- **Definition of done:** any change to this vision updates this ADR and the design SSOT in the same PR.

## Implementation

Execution roadmap and phase tracking live in the working plan (Cursor plan tracker) referenced by the team; the durable design specification is [docs/design/DESIGN_SYSTEM_MOBILE.md](../design/DESIGN_SYSTEM_MOBILE.md). Detailed component/token/mockup reference is retained in [docs/archive/designmobile.md](../archive/designmobile.md).

### Related ADRs

- [ADR 002 — Unistyles v3 initialization](002-unistyles-v3-initialization.md)
- [ADR 003 — State management (Legend-State)](003-state-management-legend-state.md)
- [ADR 006 — Hybrid design system (Stitch)](006-design-system-stitch.md)
- [ADR 012 — Mobile performance budgets](012-mobile-performance-budgets.md)
