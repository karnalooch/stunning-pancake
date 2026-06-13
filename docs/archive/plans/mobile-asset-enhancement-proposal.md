# Mobile Asset Enhancement Proposal

> **Status:** ⛔ Superseded (2026-06-13) by [ADR 014](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) and the active design SSOT [docs/design/DESIGN_SYSTEM_MOBILE.md](../../design/DESIGN_SYSTEM_MOBILE.md). The improved asset pipeline (palette-quant, nearest-neighbor scaling, sprite packing, lossless compression, reproducible manifest, reference-locked frames) and the current palette/theme direction replace this proposal. Note: this doc references the legacy octopath/solar palette and Tamagui, both removed — kept only for historical context.
>
> **Project:** SPORT Mobile (Expo/React Native · Unistyles · Octopath HD-2D + Metal Slug Pixel-Arcade)
> **Date:** 2026-05-04
> **Author:** Kilo Code (Architect Mode)
> **Status (original):** Proposal — awaiting review

---

## 1. Current State Inventory

### 1.1 Existing Visual Assets

| Asset | Location | Format | Size | Notes |
|-------|----------|--------|------|-------|
| App Icon | [`mobile/assets/icon.png`](mobile/assets/icon.png) | PNG | ~610 KB | Standard Expo icon |
| Splash Icon | [`mobile/assets/splash-icon.png`](mobile/assets/splash-icon.png) | PNG | ~811 KB | Expo splash screen |
| Adaptive Icon | [`mobile/assets/adaptive-icon.png`](mobile/assets/adaptive-icon.png) | PNG | ~1.26 MB | Android adaptive |
| Favicon | [`mobile/assets/favicon.png`](mobile/assets/favicon.png) | PNG | ~623 KB | Web only |
| Runner Sprite | [`mobile/assets/generated/runner_sprite.png`](mobile/assets/generated/runner_sprite.png) | PNG | ~923 KB | Single static frame |
| Cyclist Sprite | [`mobile/assets/generated/cyclist_sprite.png`](mobile/assets/generated/cyclist_sprite.png) | PNG | ~798 KB | Single static frame |
| Ghost Sprite | [`mobile/assets/generated/ghost_sprite.png`](mobile/assets/generated/ghost_sprite.png) | PNG | ~703 KB | Single static frame |
| Reward Trophy | [`mobile/assets/generated/reward_trophy.png`](mobile/assets/generated/reward_trophy.png) | PNG | ~845 KB | Single static frame |
| Logo Dark | [`assets/branding/logo_full_dark.svg`](assets/branding/logo_full_dark.svg) | SVG | ~596 B | Full logo, dark BG |
| Logo Light | [`assets/branding/logo_full_light.svg`](assets/branding/logo_full_light.svg) | SVG | ~713 B | Full logo, light BG |
| Logo Icon | [`assets/branding/logo_icon.svg`](assets/branding/logo_icon.svg) | SVG | ~516 B | Shield icon only |
| Logo Minimal | [`assets/branding/logo_minimal.svg`](assets/branding/logo_minimal.svg) | SVG | ~260 B | Minimal mark |

**Key Finding:** Only 4 sprite PNGs exist, all are single-frame static images. No sprite sheets, no animated frames, no sound files, no Lottie/Rive animations, no particle assets.

### 1.2 Current Typography

| Font | Source | Usage |
|------|--------|-------|
| **Press Start 2P** | [`@expo-google-fonts/press-start-2p`](node_modules/@expo-google-fonts/press-start-2p) | All UI text via [`PixelText`](mobile/src/components/PixelText.tsx) component |
| System Monospace | Platform default (Courier/monospace) | Fallback in [`PixelStats`](mobile/src/components/PixelStats.tsx) Skia canvas |

**Key Finding:** Single font family. No secondary display font for leaderboards, no variable font for body text, no pixel font variants for different UI contexts.

### 1.3 Current Animation / Effects Infrastructure

| Technology | Version | Current Usage |
|------------|---------|---------------|
| `react-native-reanimated` | 4.2.1 | ✅ Spring animations (buttons), floating idle (PopUpDialog), bounce/scale (AthleteSprite), scanning line (SplashScreen), scrolling digits (GameHUD), progress bars |
| `react-native-svg` | 15.15.3 | ✅ Retro arcade grid background on SplashScreen, shield logo SVG |
| `@shopify/react-native-skia` | 2.4.18 | ✅ PixelStats bar chart (Canvas rendering) |
| `expo-haptics` | 55.0.14 | ✅ Light/Medium impact on ArcadeButton, tab navigation |
| `lucide-react-native` | 1.11.0 | ✅ Icon library (Shield, Zap, MapPin, ArrowRight, Check, Wifi) |

**Key Finding:** Reanimated is already deeply integrated. No `expo-av`/audio, no Lottie/Rive, no particle system, no Skia shader effects.

### 1.4 Current Haptic Feedback Map

| Interaction | Haptic Style | Location |
|-------------|-------------|----------|
| Button press-in | `Light` | [`ArcadeButton.tsx:152`](mobile/src/components/ArcadeButton.tsx:152) |
| Button press (activate) | `Medium` | [`ArcadeButton.tsx:162`](mobile/src/components/ArcadeButton.tsx:162) |
| Tab switch | `Light` | [`GameTabBar.tsx:48`](mobile/src/navigation/GameTabBar.tsx:48) |

**Key Finding:** Only 3 haptic triggers exist. No success/failure/achievement haptic patterns.

### 1.5 Existing Color Palette (Token System)

The project uses a design token system at [`shared/tokens/colors.json`](shared/tokens/colors.json) with auto-generated output at [`shared/tokens/generated/restyle-colors.ts`](shared/tokens/generated/restyle-colors.ts). The palette is organized into **primitive** (20 raw values), **semantic** (6 functional aliases), and **theme-specific** (octopath/solar, 27 tokens each).

**Primitive Palette (raw colors):**

```
goldAmber       #D4A373 — Octopath gold, primary accent
goldLight       #EDD9B0 — Bright gold highlight
forestGreen     #7BA05B — Success/growth, soft forest green
parchment       #2D2418 — Dark warm brown (elevated surface)
deepBrown       #1A1410 — Deeper shadow brown
panel           #3D3020 — Surface brown for cards/panels
deepSea         #0B1D33 — Deep sea blue, main dark BG
industrial      #4A4A4A — Metal Slug grey
metalGray       #2B303A — Industrial UI gray
pixelBlack      #000000 — Pure black for pixel outlines
cream           #F5E6CC — Warm parchment cream (primary text)
sepia           #C8B098 — Bronze/sepia (secondary text)
woodBorder      #5C4020 — Dark wood outline
silver          #A0A0A0 — Silver podium/neutral
warning         #E8A840 — Amber warning
error           #CC4444 — Soft red error
solarCream      #FFF8E7 — Solar mode background
solarBrown      #2D2418 — Solar mode text
hologramCyan    #00D1FF — Holographic card border (niche use only)
parchmentLight  #E2D4B7 — Light parchment paper (card BG)
```

**Octopath Theme (dark mode — default):**

```
background:      #0B1D33 (deepSea)          — main screen BG
backgroundStrong:#2D2418 (parchment)        — elevated surfaces
surface:         #2B303A (metalGray)         — cards/panels
text:            #F5E6CC (cream)             — primary text
textMuted:       #C8B098 (sepia)             — secondary text
textInverse:     #000000 (pixelBlack)        — text on gold buttons
border:          #D4A373 (goldAmber)         — primary border/CTA
borderMuted:     #5C4020 (woodBorder)        — subtle borders
outline:         #000000 (pixelBlack)        — 1px pixel outlines
buttonGoldBg:    #D4A373                     — primary CTA
buttonGoldText:  #000000                     — on-gold text
buttonGreenBg:   #7BA05B (forestGreen)       — success
buttonRedBg:     #CC4444 (error)             — danger
cardDarkBg:      #0B1D33                     — dark card
cardMetalBg:     #2B303A                     — metal card
cardParchmentBg: #E2D4B7 (parchmentLight)    — parchment card
cardHologramBg:  #0B1D33                     — hologram card BG
cardHologramBorder:#00D1FF                   — hologram border (subtle)
tabBarBg:        #0B1D33                     — tab bar
tabActiveText:   #D4A373 (goldAmber)         — active tab
tabInactiveText: #C8B098 (sepia)             — inactive tab
```

**Key Insight:** The palette is built around **warm earth tones** (gold, brown, cream) grounded by **deep sea blue** and **pixel black**. The cyan `hologramCyan` exists only as a niche card variant — it is NOT a primary accent. The dominant warm color is `goldAmber` (#D4A373), not cool neon.

### 1.6 Screens & Their Current Visual Character

| Screen | Visual Identity | Assets Used | Animation Level |
|--------|----------------|-------------|-----------------|
| **SplashScreen** | Retro arcade grid + scanning line + pulsing HD-2D shield logo | SVG grid, shield logo SVG, AthleteSprite (runner) | ⭐⭐⭐ High — logo pulse, scan line, text blink |
| **Auth UI** | Deep sea BG, retro inputs, gold buttons | None (text-only) | ⭐ Low — button press only |
| **OnboardingScreen** | Parchment cards, RPG HUD progress bar, sliding transitions | Lucide icons (Shield, Zap, MapPin), QR code | ⭐⭐ Medium — progress bar, slide-in transitions |
| **TrackingScreen** | MapLibre dark/light map, HUD overlay, pop-up dialog | Runner/Ghost sprites, MapLibre tiles | ⭐⭐⭐ High — HUD animations, scrolling digits, dialog spring |
| **ActivitiesScreen** | Metal card list, grade badges, sprite placeholders | AthleteSprite (runner/ghost) | ⭐ Low — static list |
| **LeaderboardScreen** | Podium (gold/silver/bronze), ranking list, trophy icon | AthleteSprites, reward_trophy PNG | ⭐⭐ Medium — sprite animations |
| **RewardsScreen** | Item shop cards, XP balance, trophy icon | AthleteSprites, reward_trophy PNG | ⭐ Low — static list |
| **ProfileScreen** | Character sheet, QR code, wearable links | QR code | ⭐ Low — static form |

---

## 2. Asset Gap Analysis

### 2.1 What's Completely Missing

| Category | Gap |
|----------|-----|
| **Sound Effects** | No audio files — no 8-bit UI clicks, no achievement jingles, no Metal Slug-style SFX, no `expo-av` installed |
| **Lottie/Rive Animations** | No animated vector assets for loading, celebrations, onboarding |
| **Particle/Confetti Effects** | No chunky pixel celebration effects for achievements, milestones, level-ups |
| **Background Ambient Effects** | No candlelit warm ambient glow, no parchment grain overlay, no CRT scanlines on main screens (only scan line on Splash) |
| **Sprite Sheets** | All sprites are single-frame PNGs — no walking/running/idle animation frames |
| **Warm Glow Effects** | No warm amber candlelight glows, no gold emboss highlights on premium cards |
| **Texture/Noise Overlays** | No parchment grain, no CRT vignette on gameplay screens, no warm vignette |
| **Secondary Font** | Only one pixel font — no display font for headlines/leaderboards |
| **Tab Bar Icons** | `NAV_ICONS` object is entirely `undefined` for all 5 tabs |
| **Grade Badge Icons** | `GRADE_ICONS` for S/A ranks are `undefined` — fallback to text |

### 2.2 What's Under-Utilized

| Resource | Current Use | Potential |
|----------|-------------|-----------|
| `react-native-skia` | Only PixelStats bar chart | Shader effects, chunky particle systems, CRT filters, warm glow effects |
| `react-native-svg` | Only SplashScreen grid + logo | Animated pixel-art SVG icons, morphing shapes, progress rings |
| `expo-haptics` | Only Light/Medium | Success/Warning/Error/Selection patterns, custom haptic sequences |
| `react-native-reanimated` | Mostly spring/timing | Complex choreographed sequences, shared layout transitions |

---

## 3. Proposed Asset Additions — By Category

### 3.1 🎵 Sound Effects (8-Bit Arcade SFX)

> **Priority: P0 — Essential for immersion**
> **Aesthetic:** Metal Slug-era chunky 8-bit arcade sounds — bold, punchy, immediate. Think "coin insert," "explosion burst," "level-up jingle." No ambient pads, no synth drones.

| Asset | Description | Format | Lib Required | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|-------------|---------------|------------|-------------------|
| **UI Click** | 8-bit arcade button click (short <100ms, square wave) | `.mp3` / `.wav` | `expo-av` (~150KB gzipped) | ~5KB per sound | Low | All buttons, tabs |
| **Mission Start** | Rising 8-bit arpeggio ("GO!" jingle, Metal Slug mission start vibe) | `.mp3` | `expo-av` | ~30KB | Low | TrackingScreen start |
| **Mission Complete** | 8-bit victory fanfare (ascending chord stab + metallic clink) | `.mp3` | `expo-av` | ~50KB | Low | TrackingScreen stop |
| **Achievement Unlock** | Classic "item get" chime (ascending 3-note blip) | `.mp3` | `expo-av` | ~40KB | Low | PopUpDialog, rewards |
| **Level Up** | Ascending 8-bit scale with "sparkle" finish (short burst) | `.mp3` | `expo-av` | ~50KB | Low | AvatarTrainer milestones |
| **Error/Buzz** | Low square-wave buzz (incorrect action, Metal Slug "miss") | `.mp3` | `expo-av` | ~15KB | Low | Validation errors |
| **Tab Switch** | Soft 8-bit tick/blip | `.mp3` | `expo-av` | ~5KB | Low | GameTabBar |
| **Coin Pickup** | Short metallic "clink" (Metal Slug coin/item pickup) | `.mp3` | `expo-av` | ~5KB | Low | RewardsScreen, XP gain |
| **Explosion Burst** | Chunky 8-bit explosion (achievement/milestone celebration) | `.mp3` | `expo-av` | ~30KB | Low | Level-up, mission fireworks |

**Implementation Notes:**
- Add `expo-av` to `package.json` dependencies
- Create a `SoundService.ts` singleton (preload, play, volume control, mute toggle)
- Add mute toggle to ProfileScreen / settings
- Bundle ~9-10 small audio files (total <250KB gzipped)
- Source: Generate with [jsfxr](https://sfxr.me/) (8-bit sound generator) or use [Kenney.nl](https://kenney.nl/assets) free retro packs — target the "arcade/chiptune" category specifically

---

### 3.2 ✨ Chunky Pixel Particle Effects

> **Priority: P1 — High impact for gamification moments**
> **Aesthetic:** Blocky, deliberate 8-bit pixel particles — not smooth gradient confetti. Think Metal Slug explosion debris, not fireworks in After Effects.

| Asset | Description | Format | Lib Required | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|-------------|---------------|------------|-------------------|
| **Achievement Burst** | Chunky gold/amber pixel squares + dark brown sparks bursting outward | Reanimated + Skia | None (already have both) | ~5KB code | Medium | PopUpDialog, RewardsScreen |
| **XP Gain Orbs** | Floating "+XP" text with pixel orb trail (small gold squares rising) | Reanimated views | None | ~3KB code | Low | TrackingScreen, ActivitiesScreen |
| **Level Up Burst** | Concentric pixel rings + chunky star particles from center | Reanimated + Skia | None | ~5KB code | Medium | AvatarTrainer, ProfileScreen |
| **Parchment Dust Motes** | Slow-falling warm amber pixel dots (dust motes in candlelight, Octopath vibe) | Skia Canvas | None | ~3KB code | Low | All dark-theme idle screens |
| **Mission Complete Explosion** | Full-screen chunky pixel "explosion" (Metal Slug boss-defeat style) | Skia Canvas | None | ~8KB code | High | TrackingScreen on session end |
| **Button Press Sparks** | Small pixel sparks on ArcadeButton press (direction: outward from press point) | Reanimated | None | ~2KB code | Low | ArcadeButton (enhance existing) |

**Implementation Notes:**
- Use `react-native-reanimated` worklets for 60 FPS particle physics on UI thread
- For many particles (>40), use `@shopify/react-native-skia` canvas with discrete (integer) positioning for blocky pixel look — avoid sub-pixel rendering
- Build a reusable `<PixelBurst>` component with configurable: `{ count, colors, spread, duration, origin, blockSize }`
- `blockSize` parameter controls pixel chunkiness (default 4-6px blocks, never smooth)
- Colors sourced exclusively from theme tokens (goldAmber, goldLight, forestGreen, cream, sepia)
- Particle shapes: squares only, no circles or smooth curves

**Example Particle Config:**
```typescript
// Proposed component API
<PixelBurst
  origin={{ x: screenWidth/2, y: screenHeight/2 }}
  count={24}
  colors={['#D4A373', '#EDD9B0', '#2D2418']}     // goldAmber, goldLight, parchment
  blockSize={5}                                     // chunky 5px blocks
  duration={1200}
  spread={180}
  trigger={showAchievement}
/>
```

---

### 3.3 🎬 Lottie / Rive Animations

> **Priority: P2 — Nice to have, high polish impact**

| Asset | Description | Format | Lib Required | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|-------------|---------------|------------|-------------------|
| **Loading Spinner** | Pixel-art treasure chest opening/closing loop (or sword-in-stone glow pulse) | `.json` (Lottie) | `lottie-react-native` (~200KB) | ~30KB per anim | Medium | All loading states |
| **Achievement Badge** | Gold badge materializing with warm amber shine + scale reveal | `.json` (Lottie) | `lottie-react-native` | ~50KB | Medium | PopUpDialog achievements |
| **Onboarding Flow** | Character walking through pixel-art Octopath landscape (candlelit tavern → forest trail → mountain peak) | `.json` (Lottie) | `lottie-react-native` | ~80KB | Medium | OnboardingScreen |
| **Empty State** | Ghost sprite floating in a beam of warm candlelight, occasional pixel dust motes | `.json` (Lottie) | `lottie-react-native` | ~30KB | Medium | ActivitiesScreen (no missions), LeaderboardScreen |

**Implementation Notes:**
- Create Lottie animations with [LottieFiles](https://lottiefiles.com) or After Effects + Bodymovin
- Keep animations small (<100KB each) — mobile-optimized
- Alternatively use `@rive-app/react-native` for state-machine-driven animations (Rive is ~500KB but more powerful)
- **Recommendation:** Start with code-based animations (Reanimated), add Lottie only if the asset team can produce them. Code-based animations have zero bundle impact.
- If Lottie is pursued, animations must respect the pixel-art aesthetic: no smooth gradients, use discrete color bands, 1px outlines

---

### 3.4 🕯️ Background Ambient Effects

> **Priority: P1 — High impact for atmosphere**
> **Aesthetic:** Octopath Traveler dominates idle/ambient states (candlelit warmth, parchment, subtle vignette). Metal Slug CRT scanlines dominate action/arcade screens.

| Asset | Description | Format | Lib Required | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|-------------|---------------|------------|-------------------|
| **Candlelit Warm Glow** | Subtle warm amber radial gradient pulsing gently from screen center (candle flicker simulation) | Reanimated + Skia | None | ~3KB code | Low | All dark-theme idle screens |
| **CRT Scanlines** | Subtle horizontal line overlay at 2-3px spacing, 5-8% opacity | SVG pattern or Skia | None | ~2KB code | Low | All screens (ambient layer) |
| **CRT Vignette** | Dark edges fading to center (CRT monitor feel, stronger than photo vignette) | Reanimated View | None | ~1KB code | Low | All screens |
| **Parchment Grain Overlay** | Subtle noise texture with warm brown tint — paper fiber feel (Octopath idle) | Skia shader or PNG tile | None | ~10KB | Low | GameCard (parchment variant), OnboardingScreen |
| **Retro Arcade Grid** | Perspective grid fading to horizon (already in SplashScreen — extract as reusable component) | Skia Canvas | None (reuse existing) | ~4KB code | Medium | TrackingScreen (behind map), Auth screen |
| **Dust Motes** | Slow-falling warm amber pixel dots in candlelight beams (Octopath atmospheric) | Skia Canvas | None | ~3KB code | Medium | All dark-theme screens (optional toggle) |

**Implementation Notes:**
- Candlelit glow, scanlines, and vignette are pure code — zero bundle size impact
- Add an `<AmbientLayer>` component that conditionally renders based on theme and screen context
- **Octopath ambient** (candle glow + dust motes + parchment grain) for idle states: ActivitiesScreen, LeaderboardScreen, RewardsScreen, ProfileScreen
- **Metal Slug ambient** (CRT scanlines + vignette + arcade grid) for action states: TrackingScreen, SplashScreen, HUD overlays
- Candle flicker: animate the radial gradient opacity with a subtle sine wave + random jitter at low frequency (2-3 Hz)
- CRT scanlines: SVG `<Rect>` pattern at 2-3px spacing with 5-8% opacity, always on top
- These effects are GPU-accelerated via Reanimated worklets — negligible performance cost

---

### 3.5 📳 Haptic Feedback Patterns

> **Priority: P0 — Essential, already have `expo-haptics` installed**

| Pattern | Haptic Style | Trigger | Complexity |
|---------|-------------|---------|------------|
| **Success** | `NotificationFeedbackType.Success` | Achievement unlock, mission complete, purchase | Low |
| **Warning** | `NotificationFeedbackType.Warning` | Low battery, approaching privacy zone, validation error | Low |
| **Error** | `NotificationFeedbackType.Error` | Auth failure, sync failure, rejected action | Low |
| **Selection** | `ImpactFeedbackStyle.Light` × 2 rapid | Tab switch (enhanced from current single Light) | Low |
| **Level Up** | `NotificationFeedbackType.Success` + `ImpactFeedbackStyle.Heavy` (sequence) | Level-up milestone | Medium |
| **Heartbeat** | `ImpactFeedbackStyle.Light` at 60-80 BPM (optional) | During active tracking with HR monitor | Medium |
| **Explosion** | `ImpactFeedbackStyle.Heavy` + `NotificationFeedbackType.Success` (rapid sequence) | Mission complete, milestone achieved | Medium |

**Implementation Notes:**
- Create `HapticService.ts` with named patterns: `HapticService.success()`, `HapticService.levelUp()`, etc.
- Map to existing `expo-haptics` API — zero additional dependencies
- Bundle impact: ~1KB code only

---

### 3.6 🔤 Font Additions

> **Priority: P1 — High visual impact**

| Font | Use Case | Source | Bundle Impact | Complexity |
|------|----------|--------|---------------|------------|
| **VT323** | Body/paragraph text (more readable than Press Start 2P for long text) | `@expo-google-fonts/vt323` | ~50KB | Low |
| **Monofett** | Large display numbers (leaderboard scores, XP amounts) | `@expo-google-fonts/monofett` | ~40KB | Low |
| **Pixelify Sans** | Secondary UI labels (modern pixel font with variable weight) | `@expo-google-fonts/pixelify-sans` | ~60KB | Low |

**Implementation Notes:**
- All via `@expo-google-fonts/*` — consistent with existing `Press Start 2P` loading
- `VT323` would replace the current "monospace" fallback used in [`PopUpDialog`](mobile/src/components/PopUpDialog.tsx:154) and [`PixelStats`](mobile/src/components/PixelStats.tsx:50-54)
- `Monofett` for big numbers in [`GameHUD`](mobile/src/components/GameHUD.tsx) distance display and [`LeaderboardScreen`](mobile/src/screens/LeaderboardScreen.tsx) podium scores
- Extend `PixelText` with a `fontFamily` prop: `'pixel' | 'body' | 'display'`

---

### 3.7 🎮 Icon / Mascot Sprite Sheets

> **Priority: P0 — Essential for tab bar, grade badges, and character expression**
> **Aesthetic:** Pixel-art icons with 1px black outlines, flat pixel colors, no anti-aliasing, no gradients.

| Asset | Description | Format | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|---------------|------------|-------------------|
| **Tab Bar Icons** | 5 pixel-art icons: Home (hearth/torch), History (scroll), Ranking (podium), Rewards (coin pouch), Profile (shield crest) | SVG or PNG (24×24) | ~10KB total | Low | GameTabBar |
| **Grade Badges** | S/A/B/C/D rank pixel badges — S-rank gold with ornate border, descending through silver/bronze/grey/red | SVG or PNG (32×32) | ~15KB total | Low | ActivitiesScreen |
| **Avatar Expressions** | 4 states per sprite: idle (neutral), happy (sparkle eyes), tired (sweat drop), victory (arms up) | Sprite sheet PNG (4 frames × 64×64) | ~100KB | Medium | PopUpDialog, AvatarTrainer |
| **Power-Up Icons** | Speed boost (winged boot), shield, double XP (crossed swords), GPS lock (compass rose) | SVG or PNG (24×24) | ~10KB total | Low | TrackingScreen HUD, RewardsScreen |
| **Currency Icons** | XP orb (gold cube), Gold coin (pixel circle with star), Energy bolt (jagged lightning) | SVG or PNG (16×16) | ~5KB total | Low | RewardsScreen, GameHUD |

**Implementation Notes:**
- Tab bar icons are **critical** — currently [`NAV_ICONS`](mobile/src/navigation/GameTabBar.tsx:7-13) is entirely `undefined`. The tab bar renders with no icons.
- Grade badges replace the text-only fallback in [`ActivitiesScreen`](mobile/src/screens/ActivitiesScreen.tsx:112-118)
- Avatar expressions: modify [`AthleteSprite`](mobile/src/components/AthleteSprite.tsx) to accept a `state` that maps to sprite sheet frames
- All icons must follow the HD-2D pixel-art rules: 1px black outlines, flat pixel colors, zero anti-aliasing, no rounded corners
- Icon colors should use existing tokens: goldAmber for active, sepia for inactive, woodBorder for outlines

---

### 3.8 🔥 Warm Glow / Emboss / Shader Effects

> **Priority: P1 — High visual impact for card-based UI**
> **Aesthetic:** Warm amber candlelight glows (Octopath), not cold neon. Gold emboss (pressed metal), not holo-foil. CRT bloom, not shader rainbows.

| Asset | Description | Format | Lib Required | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|-------------|---------------|------------|-------------------|
| **Warm Amber Border Glow** | Animated warm gold glow on elevated cards — candlelight flicker on borders | Reanimated shadow/opacity | None | ~3KB code | Medium | GameCard (dark/metal variants) |
| **Gold Emboss Shimmer** | Diagonal warm gold light sweep across premium cards (like sunlight on embossed leather) | Reanimated + LinearGradient | `expo-linear-gradient` (~10KB) | ~2KB code | Low | LeaderboardScreen podium, RewardsScreen XP card |
| **Tracking Pulse** | Pulsing warm amber radial glow around active tracking HUD indicator | Reanimated | None | ~2KB code | Low | TrackingScreen (when tracking active) |
| **Parchment Emboss** | Subtle raised-gold effect on parchment card variant — warm inner shadow | Reanimated | None | ~2KB code | Low | GameCard (parchment variant), OnboardingScreen cards |
| **Button Press Glow** | Brief warm flash (goldAmber at 40% opacity) on ArcadeButton press | Reanimated | None | ~1KB code | Low | ArcadeButton (enhance existing) |
| **CRT Bloom** | Subtle screen glow (warm amber tint, not cyan) emanating from edges — arcade monitor feel | Reanimated radial gradient | None | ~3KB code | Medium | SplashScreen, TrackingScreen HUD |

**Implementation Notes:**
- `expo-linear-gradient` is the only new dependency (~10KB) — needed for gold emboss shimmer sweep
- All glow effects use warm tones: `goldAmber` (#D4A373), `goldLight` (#EDD9B0), `warning` (#E8A840)
- No cyan/magenta/neon whatsoever — `hologramCyan` (#00D1FF) stays confined to the hologram card variant only
- Amber border glow: animate `borderColor` opacity + subtle `shadowColor` on [`GameCard`](mobile/src/components/GameCard.tsx)
- These effects should respect the octopath/solar theme switch — e.g., emboss could be warm gold in octopath mode, wood-brown in solar mode

---

### 3.9 🏞️ Environment Textures & Overlays

> **Priority: P2 — Nice to have, atmospheric**

| Asset | Description | Format | Bundle Impact | Complexity | Benefiting Screens |
|-------|-------------|--------|---------------|------------|-------------------|
| **Parchment Grain Overlay** | Subtle paper fiber texture with warm brown tint — Octopath idle atmosphere | PNG tile (128×128) | ~20KB | Low | GameCard (parchment variant), OnboardingScreen, all idle screens |
| **Retro Arcade Grid** | Perspective grid fading to horizon (extract from SplashScreen as shared component) | SVG (reuse existing) | 0 (already exists) | Low | Auth screen, TrackingScreen, OnboardingScreen |
| **CRT Vignette Texture** | Dark edges with subtle warm center — old CRT monitor feel | Reanimated View | ~1KB code | Low | All action screens |
| **Metal Plate Texture** | Brushed dark metal surface for metal card variant — industrial, not glossy | PNG tile (128×128) | ~15KB | Low | GameCard (metal variant), ActivitiesScreen |
| **Wood Grain Texture** | Dark wood grain for border/frame elements | PNG tile (128×128) | ~15KB | Low | GameCard frames, LeaderboardScreen podium |

**Implementation Notes:**
- Reuse the existing arcade grid from [`SplashScreen.tsx:78-86`](mobile/src/components/SplashScreen.tsx:78) as a shared `<RetroGrid>` component
- Parchment/metal/wood textures: tileable PNGs applied as `ImageBackground` or Skia `ImageShader`
- Parchment grain: warm paper fiber, subtle at 5-8% opacity — almost invisible but adds organic warmth
- These textures should be toggleable — allow users to disable for performance/battery

---

### 3.10 🎯 Animated Sprite Characters (Enhancement)

> **Priority: P2 — Polish, but current static sprites work adequately**

| Enhancement | Description | Format | Bundle Impact | Complexity |
|-------------|-------------|--------|---------------|------------|
| **Multi-frame sprite sheets** | 4-8 frame animation strips for run/idle/victory | PNG sprite sheet (e.g., 512×64 for 8 frames) | ~200KB additional | Medium |
| **Sprite animation controller** | Reanimated-based frame sequencer with pixel-perfect frame stepping | Code | ~3KB code | Medium |
| **Reactive expressions** | Sprite expression changes based on stats (tired when pace drops, happy on PR) | Code | ~2KB code | Low |

**Implementation Notes:**
- Each existing sprite (~800KB) is already large for a static frame. Sprite sheets should be optimized:
  - Reduce each frame to 64×64 (currently ~130×130 rendered)
  - 8-frame sheet at 64×64 = 512×64 PNG = ~50-80KB per character
  - This would actually **reduce** total sprite bundle size while adding animation
- Build a `<SpriteAnimator>` component that cycles frames using Reanimated shared values
- Frame stepping should use discrete integer indexing (no interpolation between frames) to preserve pixel-art crispness

---

## 4. Dependency Summary

### New Dependencies Required

| Package | Purpose | Est. Bundle Impact | Priority |
|---------|---------|-------------------|----------|
| `expo-av` | Audio playback for 8-bit sound effects | ~150KB gzipped | P0 |
| `@expo-google-fonts/vt323` | Readable body pixel font | ~50KB | P1 |
| `@expo-google-fonts/monofett` | Display numbers font | ~40KB | P1 |
| `expo-linear-gradient` | Gold emboss shimmer effect | ~10KB | P1 |

### Optional Dependencies (Evaluate Later)

| Package | Purpose | Est. Bundle Impact | Priority |
|---------|---------|-------------------|----------|
| `lottie-react-native` | Lottie animations | ~200KB | P2 |
| `@rive-app/react-native` | Rive state-machine animations | ~500KB | P2 (alternative to Lottie) |

**Total new dependency bundle impact (P0+P1):** ~250KB gzipped — acceptable for a fitness app.

---

## 5. Implementation Roadmap

### Phase 1: Quick Wins (P0 — Essential)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 1 | **Tab bar icons** — Create 5 pixel-art SVG icons, wire into [`GameTabBar`](mobile/src/navigation/GameTabBar.tsx) `NAV_ICONS` | Small | Design asset creation |
| 2 | **Haptic patterns** — Create `HapticService.ts`, map to all interactions | Tiny | None |
| 3 | **Sound service** — Install `expo-av`, create `SoundService.ts`, generate 9-10 8-bit arcade sounds (Metal Slug style) | Small | `expo-av` |
| 4 | **Grade badges** — Create S/A/B/C/D pixel badge SVGs for [`ActivitiesScreen`](mobile/src/screens/ActivitiesScreen.tsx) | Tiny | Design asset creation |
| 5 | **Wire sounds + haptics** — Integrate into ArcadeButton, GameTabBar, milestone triggers | Small | Tasks 2, 3 |

### Phase 2: Atmosphere (P1 — High Impact)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 6 | **Candlelit warm glow** — Build `<CandleGlow>` ambient component for all dark-theme idle screens | Small | None |
| 7 | **CRT scanlines overlay** — Build `<Scanlines>` component, add as ambient layer on action screens | Tiny | None |
| 8 | **CRT vignette** — Build `<CRTVignette>` component with warm amber center | Tiny | None |
| 9 | **Secondary fonts** — Add VT323 + Monofett, extend [`PixelText`](mobile/src/components/PixelText.tsx) with `fontFamily` prop | Tiny | `@expo-google-fonts/vt323`, `@expo-google-fonts/monofett` |
| 10 | **Warm amber border glow** — Add candlelight flicker glow to GameCard dark/metal variants | Small | None |
| 11 | **Gold emboss shimmer** — Add diagonal warm gold sweep to premium cards (leaderboard podium, XP balance card) | Small | `expo-linear-gradient` |

### Phase 3: Gamification (P1-P2 — Polish)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 12 | **Pixel burst component** — Build `<PixelBurst>`, wire to achievements and milestones | Medium | None |
| 13 | **XP gain orbs** — Floating "+XP" with pixel orb trail on activity completion | Small | Task 12 |
| 14 | **Level-up burst** — Concentric pixel rings + chunky star particles on level-up | Medium | Task 12 |
| 15 | **Avatar expressions** — Add expression states to [`AthleteSprite`](mobile/src/components/AthleteSprite.tsx) | Medium | Sprite sheet assets |
| 16 | **Tracking pulse** — Warm amber pulsing indicator during active tracking | Small | None |
| 17 | **Mission complete explosion** — Full chunky pixel celebration on session end (Metal Slug style) | Medium | Task 12 |

### Phase 4: Premium Polish (P2 — Nice to Have)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 18 | **Multi-frame sprite sheets** — Replace static PNGs with animated sprite strips | Medium | Design asset creation |
| 19 | **Parchment emboss effect** — Gold emboss on parchment card variant | Medium | None |
| 20 | **Retro arcade grid component** — Extract from SplashScreen, reuse across screens | Tiny | None |
| 21 | **Parchment/metal/wood textures** — Tileable PNGs for card backgrounds | Small | Design asset creation |
| 22 | **Lottie/Rive animations** — Loading, onboarding, achievement sequences (pixel-art style) | Medium-High | `lottie-react-native` or `@rive-app/react-native` |
| 23 | **Dust motes ambient** — Slow-falling warm pixel dots on idle screens (Octopath atmosphere) | Medium | None |

---

## 6. Architecture Recommendations

### 6.1 Proposed Service Structure

```
mobile/src/services/
├── SoundService.ts          # NEW — 8-bit audio preload, play, mute, volume
├── HapticService.ts          # NEW — named haptic pattern methods
├── ThemeService.ts           # existing — theme switching
├── BrandingService.ts        # existing — tenant branding
└── ...

mobile/src/components/
├── ambient/
│   ├── CandleGlow.tsx        # NEW — warm amber radial pulse (Octopath idle)
│   ├── Scanlines.tsx         # NEW — CRT scanline overlay
│   ├── CRTVignette.tsx       # NEW — warm-center CRT vignette
│   ├── DustMotes.tsx         # NEW — slow pixel dust motes (Octopath)
│   └── RetroGrid.tsx         # NEW — extracted from SplashScreen arcade grid
├── effects/
│   ├── PixelBurst.tsx        # NEW — configurable chunky pixel particle system
│   ├── GoldEmboss.tsx        # NEW — warm gold diagonal sweep
│   ├── TrackingPulse.tsx     # NEW — pulsing amber radial indicator
│   └── ParchmentEmboss.tsx   # NEW — raised gold on parchment variant
├── sprites/
│   ├── SpriteAnimator.tsx    # NEW — multi-frame animation controller
│   └── AvatarExpressions.ts  # NEW — expression state mapping
├── ArcadeButton.tsx          # existing — add 8-bit sound on press
├── GameCard.tsx              # existing — add warm amber glow to dark/metal variants
├── ...
└── ...
```

### 6.2 Theme Token Extensions (Proposed)

Add to [`shared/tokens/colors.json`](shared/tokens/colors.json) `primitive` section:

```json
{
  "primitive": {
    "...existing...": "...",
    "candleGlow": { "value": "#D4A37333", "description": "Warm amber candlelight glow (20% opacity)" },
    "goldEmboss": { "value": "#EDD9B066", "description": "Gold emboss highlight (40% opacity)" },
    "crtBloom": { "value": "#E8A84022", "description": "Warm CRT monitor bloom (13% opacity)" },
    "dustMote": { "value": "#C8B09888", "description": "Dust mote particle color (sepia, 53% opacity)" }
  }
}
```

These tokens are warm-tone only. No cyan, magenta, or neon values.

---

## 7. Bundle Size Impact Summary

| Phase | New Dependencies | Asset Files | Code | **Total Est.** |
|-------|-----------------|-------------|------|----------------|
| Phase 1 (P0) | ~150KB (expo-av) | ~50KB (sounds + icons) | ~5KB | **~205KB** |
| Phase 2 (P1) | ~100KB (fonts + linear-gradient) | ~0KB | ~15KB | **~115KB** |
| Phase 3 (P1-P2) | 0 | ~100KB (sprites) | ~20KB | **~120KB** |
| Phase 4 (P2) | ~200-500KB (optional) | ~50KB (textures) | ~20KB | **~270-570KB** |
| **Total (P0-P2)** | **~250KB** | **~150KB** | **~40KB** | **~440KB** |
| **Total (all phases)** | **~450-750KB** | **~200KB** | **~60KB** | **~710-1010KB** |

The core enhancements (Phase 1-2, ~320KB) add approximately 3-5% to a typical Expo managed app bundle. This is well within acceptable limits for the visual payoff.

---

## 8. Key Design Principles

1. **Code over assets** — Prefer Reanimated/Skia code-based effects over imported asset files. Zero bundle cost, infinite flexibility.
2. **Theme-reactive** — All effects must respect `octopath` (dark) vs `solar` (light) theme via Unistyles.
3. **Performance-first** — Use Reanimated worklets (UI thread) for animations; avoid JS thread bottlenecks.
4. **HD-2D pixel-art aesthetic** — 1px black outlines, zero border-radius, hard shadows (no blur), flat pixel colors, no anti-aliasing, integer pixel positioning.
5. **Octopath dominates idle, Metal Slug dominates action** — Warm candlelight and parchment for ambient states; CRT scanlines, chunky explosions, and 8-bit SFX for achievement/action moments.
6. **Warm over cold** — Gold (#D4A373), amber (#E8A840), cream (#F5E6CC), brown (#2D2418) as dominant tones. Cyan (#00D1FF) is confined to hologram card variant only — never a primary glow color.
7. **Toggle-able** — Ambient effects (candle glow, scanlines, dust motes) should have an on/off toggle in Profile/Settings.
8. **Accessibility** — Respect reduced motion OS setting; provide mute toggle for 8-bit sound; haptics respect system settings.

---

## 9. Open Questions for Review

1. **Sound design direction:** Should SFX lean more toward Metal Slug arcade (explosive, punchy, metallic) or Octopath fantasy (warm chimes, harp-like jingles)? Current proposal uses Metal Slug for action, Octopath-style chimes for achievements.
2. **Sprite sheet creation:** Do we have a pixel artist, or should we use procedural generation / AI-assisted tools for sprite sheets?
3. **Lottie vs Rive vs pure code:** For animated illustrations, should we invest in a Lottie/Rive pipeline, or stay with Reanimated code-based animations?
4. **Ambient effects default:** Should candle glow/scanlines/dust motes be on by default, or opt-in?
5. **Font licensing:** Are `VT323`, `Monofett`, and `Pixelify Sans` (all Google Fonts / OFL) acceptable, or do we need custom/commissioned pixel fonts?
6. **CRT scanlines intensity:** Should scanlines be subtle (5% opacity, barely visible) or pronounced (15%, strong arcade feel)?

---

*End of proposal.*
