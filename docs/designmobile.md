# DESIGN SYSTEM — VELO QUEST (a.k.a. Quest Velos)

> **App**: Velo Quest — Cycling Performance Platform with HD-2D Retro Pixel-Art Aesthetics
> **Design Language**: Solar White + Forest Green, retro-gaming UI (Space Grotesk / VT323)
> **This Document**: Single Source of Truth (SSOT) for all visual design tokens, component patterns, layout conventions, and interaction behaviors derived from 15 STITCH screen mockups.
> **Audience**: Designers and developers maintaining visual consistency across the application.
> **Implementation**: Theme registered as `stitch` in [`mobile/src/theme/stitch.ts`](../mobile/src/theme/stitch.ts) — the **primary visual theme** of the mobile app (replaces octopath/solar). Registered via Unistyles in [`mobile/src/theme/ThemeProvider.tsx`](../mobile/src/theme/ThemeProvider.tsx).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing & Grid System](#4-spacing--grid-system)
5. [Border & Shadow System](#5-border--shadow-system)
6. [Interaction Patterns](#6-interaction-patterns)
7. [Iconography](#7-iconography)
8. [Layout Patterns](#8-layout-patterns)
9. [Recurring Component Patterns](#9-recurring-component-patterns)
10. [Screen-Specific Design Notes](#10-screen-specific-design-notes)
11. [Design Tokens Reference](#11-design-tokens-reference)

---

## 1. Design Philosophy

Velo Quest fuses **professional-grade cycling metrics** (Strava/Garmin-level data density) with **HD-2D retro pixel-art aesthetics** (inspired by modern pixel-art games like *Octopath Traveler II*). The visual language uses a light, warm "Solar White" base palette with Forest Green accents, hard pixel shadows, and thick uniform borders — creating a game-like interface that feels both playful and data-serious.

### Core Principles

| Principle | Description |
|:----------|:------------|
| **Readable Density** | Dense data layouts (bento grids, metric tiles) remain scannable through consistent spacing, clear hierarchy, and high-contrast typography. |
| **Retro Tactility** | Every interactive element — cards, buttons, nav items — has a hard shadow and thick border, giving the UI a physical, "pressable" feel. |
| **Game-First Atmosphere** | Parchment card backgrounds, pixelated borders, and retro-styled progress bars evoke a quest-log aesthetic without sacrificing usability. |
| **Consistent Token Usage** | Every color, spacing value, and font size derives from a named token. No magic numbers in components. |
| **Responsive by Default** | Mobile-first layout with `md:` breakpoint for desktop. Bottom navigation collapses to a sidebar drawer on wider screens. |

### Aesthetic Inspirations

| Source | What We Borrow |
|:-------|:---------------|
| **Octopath Traveler II** | HD-2D depth, warm parchment tones, pixel-perfect outlines, tilt-shift focus |
| **Classic RPG Menus** | Thick bordered cards, stat grids, progress bars with segmented fills |
| **Strava / Garmin Edge** | Data hierarchy, metric-first layouts, activity card patterns |
| **Retro Cycling Computers** | VT323 monospace font for ride metrics, dark HUD overlays |

---

## 2. Color Palette

The palette uses a **Solar White** base (`#f8faf0`) — a warm off-white that evokes parchment and retro paper textures. Forest Green (`#3b6a24`) serves as the primary accent, with tertiary reds for destructive actions and alerts. All colors are documented as design tokens below.

### 2.1 Core Palette

| Token | Hex Value | Usage |
|:------|:----------|:------|
| `background` | `#f8faf0` | Main page background (Solar White) |
| `surface` | `#f8faf0` | Default surface (same as background for flat hierarchy) |
| `on-background` | `#191d17` | Primary text on background/surface |
| `on-surface` | `#191d17` | Primary text on surface elements |
| `primary` | `#3b6a24` | Primary actions, CTA buttons, active nav indicators, accent borders |
| `primary-container` | `#76a95b` | Elevated surfaces using primary, active tab backgrounds |
| `primary-fixed` | `#bbf29b` | Subtle primary background (progress bar fills, highlights) |
| `on-primary` | `#ffffff` | Text/icons on primary backgrounds |
| `on-primary-container` | `#191d17` | Text/icons on primary-container surfaces |
| `secondary` | `#5e604d` | Secondary text, muted icons, supporting labels |
| `secondary-fixed` | `#e4e4cc` | Subtle secondary backgrounds, card header strips |
| `tertiary` | `#a13d3e` | Destructive actions, error states, warning accents |
| `tertiary-container` | `#ee7876` | Elevated error/warning surfaces |
| `on-tertiary` | `#ffffff` | Text/icons on tertiary backgrounds |
| `error` | `#ba1a1a` | Validation errors, critical alerts, low battery |
| `outline` | `#72796b` | Standard borders, separators (mid-emphasis) |
| `outline-variant` | `#c2c9b9` | Subtle borders, card edges (low-emphasis) |
| `parchment` | `#F5F5DC` | Card backgrounds — the signature "quest card" look |

### 2.2 Surface Container Variants

Used for elevation layering within card stacks and nested layouts:

| Token | Hex | When to Use |
|:------|:----|:------------|
| `surface-container-lowest` | `#f8faf0` | Base page background |
| `surface-container-low` | `#f2f4ea` | Slightly elevated regions (hero sections) |
| `surface-container` | `#edefe6` | Standard card elevation |
| `surface-container-high` | `#e7e9e0` | Elevated cards, dropdowns, tooltips |
| `surface-container-highest` | `#e1e3da` | Maximum elevation (modals, dialogs) |

### 2.3 Functional Color Assignments

| Function | Token | Hex | Application |
|:---------|:------|:----|:------------|
| **XP / Gold** | `primary` | `#3b6a24` | XP balance displays, currency indicators |
| **Success / GPS Good** | `primary-container` | `#76a95b` | Connected status, verification grade A/B, GPS accuracy good |
| **Warning / GPS Weak** | `tertiary` | `#a13d3e` | GPS accuracy weak, battery < 25% |
| **Error / GPS Lost** | `error` | `#ba1a1a` | GPS lost, battery < 10%, grade D, connection failed |
| **Stop / Abort** | `tertiary` | `#a13d3e` | STOP button on ride HUD, delete actions |
| **Pause** | `#d4a017` (gold-amber) | PAUSE button on ride HUD |
| **Resume / Go** | `primary` | `#3b6a24` | RESUME button, START RIDE CTA |
| **Locked / Disabled** | `outline-variant` | `#c2c9b9` | Locked trophies, disabled buttons, inactive state |

### 2.4 Active Ride HUD Overrides

The Active Ride HUD uses a **dark overlay** (not the Solar White palette) to maximize contrast and readability during outdoor use:

| Token | Hex | Usage |
|:------|:----|:------|
| `hud-background` | `#0d1b0f` | HUD overlay background (dark green-black) |
| `hud-surface` | `#162818` | HUD card backgrounds |
| `hud-text` | `#e0f0d8` | Primary HUD text (light green-white) |
| `hud-metric` | `#bbf29b` | Large central metric values (speed, distance) |
| `hud-accent` | `#76a95b` | HUD accent borders, HR zone indicators |
| `hud-warning` | `#ee7876` | Low battery flash, GPS weak on HUD |
| `hud-error` | `#ba1a1a` | Critical alerts on HUD |

### 2.5 Color Application Map (by Screen)

```
CITY HUB                     DASHBOARD                   EXPLORE MAP
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ bg: #f8faf0      │        │ bg: #f8faf0      │        │ bg: full-bleed   │
│ ┌──────────────┐ │        │ ┌──────────────┐ │        │ map (MapLibre)   │
│ │ #F5F5DC card │ │        │ │ #F5F5DC card │ │        │ ┌──────────────┐ │
│ │ border: 2px   │ │        │ │ primary CTA  │ │        │ │ #F5F5DC info │ │
│ │ #191d17       │ │        │ │ #3b6a24      │ │        │ │ card overlay │ │
│ │ shadow: 4px   │ │        │ └──────────────┘ │        │ └──────────────┘ │
│ └──────────────┘ │        │ ┌──────────────┐ │        │ Search: #f8faf0  │
│ VS progress bar  │        │ │ metric tiles │ │        │ overlay w/ border│
│ #bbf29b / #a13d │        │ │ 2-col grid   │ │        └──────────────────┘
└──────────────────┘        └──────────────────┘

ACTIVE RIDE HUD              PRO DASHBOARD               LEADERBOARD
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ bg: #0d1b0f      │        │ bg: #f8faf0      │        │ bg: #f8faf0      │
│ Speed: #bbf29b   │        │ ┌──────────────┐ │        │ ┌──────────────┐ │
│ (72px VT323)     │        │ │ header card  │ │        │ │ #F5F5DC rows │ │
│ Metrics: #e0f0d8 │        │ │ map route    │ │        │ │ city crests  │ │
│ STOP: #ba1a1a    │        │ │ stats bento  │ │        │ │ #3b6a24 rank │ │
│ PAUSE: #d4a017   │        │ │ achievements │ │        │ └──────────────┘ │
│ RESUME: #3b6a24  │        │ └──────────────┘ │        │ Sticky footer   │
└──────────────────┘        └──────────────────┘        │ user's rank     │
                                                         └──────────────────┘
```

---

## 3. Typography

### 3.1 Font Families

| Role | Font Family | Source | Usage |
|:-----|:------------|:-------|:------|
| **Primary** | `'Space Grotesk', sans-serif` | Google Fonts | All headings, body text, labels, buttons, navigation, metrics |
| **HUD Metrics** | `'VT323', monospace` | Google Fonts | **Only** in Active Ride HUD for cycling metrics (speed, distance, time, HR) |

> **Rule**: [`VT323`](https://fonts.google.com/specimen/VT323) is used **exclusively** on the Active Ride HUD screen. All other screens and all UI chrome (labels, buttons, cards) use [`Space Grotesk`](https://fonts.google.com/specimen/Space+Grotesk).

### 3.2 Type Scale

| Token | `font-size` | `line-height` | `letter-spacing` | `font-weight` | Usage |
|:------|:-----------|:-------------|:-----------------|:--------------|:------|
| `headline-xl` | `48px` | `1.1` | `-0.02em` | `700` | Hero titles, screen headers |
| `headline-lg` | `32px` | `1.2` | — | `700` | Section headers, card titles |
| `headline-md` | `24px` | `1.25` | — | `700` | Sub-section headers, prominent metrics |
| `metric-value` | `24px` | `1` | — | `700` | Large metric numbers in tiles |
| `body-lg` | `18px` | `1.5` | — | `500` | Body text, descriptions |
| `body-md` | `16px` | `1.5` | — | `400` | Standard body, list items |
| `body-sm` | `14px` | `1.4` | — | `400` | Secondary body, metadata |
| `label-lg` | `14px` | `1` | `0.05em` | `700` | Card labels, button text |
| `label-md` | `12px` | `1` | `0.05em` | `700` | Small labels, badges |
| `label-sm` | `12px` | `1` | `0.05em` | `700` | Fine-print labels, overline |
| `caption` | `10px` | `1.2` | `0.02em` | `500` | Timestamps, legal text, fine print |

### 3.3 Text Case Convention

| Element | Case | Example |
|:--------|:-----|:--------|
| **Labels** (metric tiles, card headers) | `UPPERCASE` | `DISTANCE`, `AVG SPEED`, `ELEVATION` |
| **Buttons** | `UPPERCASE` | `START RIDE`, `JOIN SQUAD`, `BUY NOW` |
| **Navigation items** | `UPPERCASE` | `RIDE`, `TRAIN`, `COMPETE`, `EXPLORE`, `PROFILE` |
| **Badges** | `UPPERCASE` | `RECRUITING`, `KOM`, `QOM`, `NEW PB!` |
| **Body text** | `Sentence case` | "Your city is #3 this week" |
| **Card titles / names** | `Title Case` or natural | "Morning Ride", "Warszawa", "Sprint Segment" |

### 3.4 Font Loading

```html
<!-- Google Fonts: Space Grotesk (all weights) + VT323 (monospace for HUD) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=VT323&display=swap" rel="stylesheet">
```

### 3.5 Typography in Practice

```
┌─────────────────────────────────────────────┐
│  headline-xl (48px, 700)                    │
│  CITY HUB                    [avatar] [⚙️]  │  ← TopAppBar
├─────────────────────────────────────────────┤
│  headline-lg (32px, 700)                    │
│  SIEDLCE                                    │  ← City name
│                                             │
│  label-lg (14px, 700, UPPERCASE)            │
│  CITY WARS                                  │  ← Section label
│                                             │
│  metric-value (24px, 700)                   │
│  12,841 KM                                  │  ← Large metric
│                                             │
│  body-md (16px, 400)                        │
│  Your city has ridden farther than 67% of   │
│  all cities this month.                     │  ← Body copy
│                                             │
│  label-sm (12px, 700, UPPERCASE)            │
│  ▲ 2,841 KM TO OVERTAKE LUBLIN (#2)        │  ← Fine label
└─────────────────────────────────────────────┘
```

---

## 4. Spacing & Grid System

### 4.1 Base Unit

All spacing derives from a **4px base unit** (pixel grid). Every margin, padding, and gap is a multiple of 4px.

| Token | Value | Multiplier | Usage |
|:------|:------|:-----------|:------|
| `pixel-unit` | `4px` | `1×` | Base atomic unit |
| `space-xs` | `4px` | `1×` | Icon-label gaps, tight internal padding |
| `space-sm` | `8px` | `2×` | Component spacing (gutter), card internal gaps |
| `space-md` | `12px` | `3×` | Card internal padding (tile-padding), list item gaps |
| `space-lg` | `16px` | `4×` | Standard page margin, section gaps |
| `space-xl` | `24px` | `6×` | Large section separators, hero padding |
| `space-2xl` | `32px` | `8×` | Page top/bottom padding, major section breaks |
| `space-3xl` | `48px` | `12×` | Hero section padding, extra-large gaps |

### 4.2 Semantic Spacing Tokens

| Token | Value | Meaning |
|:------|:------|:--------|
| `margin` | `16px` | Standard page/section outer margin (`space-lg`) |
| `gutter` | `8px` | Inter-component spacing, column gaps (`space-sm`) |
| `tile-padding` | `12px` | Internal padding of cards and tiles (`space-md`) |
| `container-gap` | `4px` | Dense grid gaps in bento/stat layouts (`space-xs`) |
| `section-gap` | `24px` | Gap between major content sections (`space-xl`) |

### 4.3 Grid Layout Conventions

#### Bento Grid (Stat Cards)
- **Columns**: 2 on mobile, 4 on desktop (`md:` breakpoint)
- **Gap**: `container-gap` (4px) for dense stat grids
- **Cell internal padding**: `tile-padding` (12px)

```css
/* Stat Grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;           /* container-gap */
}

@media (min-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-grid > * {
  padding: 12px;      /* tile-padding */
}
```

#### Activity List
- Single column, vertical stack
- Gap between items: `gutter` (8px)
- Each item: full-width card with `tile-padding` (12px) internal padding

#### Marketplace / Shop Grid
- **Columns**: 2 on mobile, 3-4 on desktop
- **Gap**: `gutter` (8px) between items

### 4.4 Page Layout Template

```
┌──────────────────────────────────────────────────────┐
│                    margin (16px)                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              TopAppBar / Header                 │  │
│  └────────────────────────────────────────────────┘  │
│                    section-gap (24px)                 │
│  ┌────────────────────────────────────────────────┐  │
│  │              Hero / Featured Section            │  │
│  └────────────────────────────────────────────────┘  │
│                    section-gap (24px)                 │
│  ┌──────────────────┬──────────────────────────────┐│
│  │   Sidebar        │    Main Content Area         ││
│  │   (desktop only) │                              ││
│  │   w-80 (320px)   │    gutter (8px) gaps         ││
│  │                  │    between components         ││
│  └──────────────────┴──────────────────────────────┘│
│                    margin (16px)                      │
└──────────────────────────────────────────────────────┘
```

#### Desktop Content Constraints
- Main content max-width: `max-w-5xl` (1024px) or `max-w-7xl` (1280px) depending on screen density
- Centered with `mx-auto`
- Padded with `px-margin` (16px)

---

## 5. Border & Shadow System

### 5.1 Border Tokens

| Token | Value | Usage |
|:------|:------|:------|
| `pixel-border` / `retro-border-thin` | `2px solid #191d17` | Standard card border, button border, input border |
| `pixel-border-thick` / `retro-border` | `4px solid #191d17` | Hero cards, featured sections, modal borders, prominent dividers |
| `border-subtle` | `1px solid #c2c9b9` | Separators, subtle card edges (outline-variant) |
| `border-accent` | `2px solid #3b6a24` | Active input focus, selected card, accent highlight |
| `border-error` | `2px solid #ba1a1a` | Invalid input, error state card |

### 5.2 Shadow Tokens

All shadows are **hard shadows** — zero blur radius — for the retro pixel-art aesthetic:

| Token | Value | Usage |
|:------|:------|:------|
| `retro-shadow` / `pixel-shadow` | `4px 4px 0px 0px rgba(25, 29, 23, 1)` | Default card shadow, button resting state |
| `retro-shadow-sm` | `2px 2px 0px 0px rgba(25, 29, 23, 1)` | Small elements: badges, chips, small icon buttons |
| `retro-shadow-lg` | `6px 6px 0px 0px rgba(25, 29, 23, 1)` | Hero cards, modals, featured content |
| `retro-shadow-interactive` | Same as `retro-shadow` but _removed on active/press_ | Button press state (see Interaction Patterns) |

### 5.3 Border Radius

| Token | Value | Usage |
|:------|:------|:------|
| `radius-default` / `radius-sm` | `0.25rem` (4px) | Default for most cards and buttons |
| `radius-lg` | `0.5rem` (8px) | Larger cards, modals |
| `radius-xl` | `0.75rem` (12px) | Hero sections, featured banners |
| `radius-full` | `9999px` | Avatars, pill badges, circular indicators |

> **Note**: Unlike the original STITCH specification (which mandated `border-radius: 0`), the Velo Quest mockups use subtle 4px rounding as the default for a slightly softer retro feel while maintaining pixel-grid alignment.

### 5.4 Combined Card Template

Every standard card in Velo Quest follows this pattern:

```css
.card {
  background: #F5F5DC;                          /* parchment */
  border: 2px solid #191d17;                    /* pixel-border */
  border-radius: 0.25rem;                       /* radius-default */
  box-shadow: 4px 4px 0px 0px rgba(25, 29, 23, 1); /* retro-shadow */
  padding: 12px;                                /* tile-padding */
}
```

---

## 6. Interaction Patterns

### 6.1 Button States

Buttons use a **mechanical press** metaphor — they physically depress into the shadow on activation.

| State | Visual Change | CSS |
|:------|:--------------|:----|
| **Resting** | Full retro-shadow visible | `box-shadow: 4px 4px 0px 0px rgba(25,29,23,1)` |
| **Hover** | Subtle lift: translateY(-2px) | `transform: translateY(-2px)` |
| **Active/Press** | Shadow disappears, button moves into shadow space | `transform: translate(2px, 2px); box-shadow: none;` |
| **Disabled** | Muted colors, no shadow, no pointer events | `opacity: 0.5; cursor: not-allowed; box-shadow: none;` |

```css
/* Retro button pattern */
.retro-button {
  background: #3b6a24;                /* primary */
  color: #ffffff;                     /* on-primary */
  border: 2px solid #191d17;          /* pixel-border */
  border-radius: 0.25rem;
  padding: 8px 16px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 4px 4px 0px 0px rgba(25, 29, 23, 1);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.retro-button:hover {
  transform: translateY(-2px);
}

.retro-button:active {
  transform: translate(2px, 2px);     /* pixel-shadow-interactive */
  box-shadow: none;
}

.retro-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
```

### 6.2 Button Variants

| Variant | Background | Text Color | Border | Usage |
|:--------|:-----------|:-----------|:-------|:------|
| **Primary** | `primary` (#3b6a24) | `on-primary` (#ffffff) | `pixel-border` | Main CTA: START RIDE, JOIN, BUY, SAVE |
| **Secondary** | `secondary-fixed` (#e4e4cc) | `on-background` (#191d17) | `pixel-border` | Supporting actions: SHARE, DOWNLOAD FIT |
| **Tertiary / Ghost** | transparent | `primary` (#3b6a24) | `border-accent` | Subtle actions: CANCEL, BACK, DISMISS |
| **Danger** | `tertiary` (#a13d3e) | `on-tertiary` (#ffffff) | `pixel-border` | Destructive: STOP, DELETE, LEAVE CLUB |
| **Success** | `primary-container` (#76a95b) | `on-primary-container` (#191d17) | `pixel-border` | Confirmation: RESUME, APPROVE |

### 6.3 Card Interactions

| State | Visual Change |
|:------|:--------------|
| **Resting** | Parchment bg, 2px border, 4px shadow |
| **Hover** | `translateY(-2px)` lift + shadow remains |
| **Active/Press** | `translate(2px, 2px)`, shadow reduces to `retro-shadow-sm` (2px) |
| **Selected** | `border-accent` (primary-colored border), `primary-fixed` bg tint |

### 6.4 Navigation Item States

#### BottomNavBar Items
| State | Visual |
|:------|:-------|
| **Inactive** | Icon + label in `secondary` (#5e604d), no background |
| **Active** | Icon + label in `primary` (#3b6a24), `primary-container` (#76a95b) background, raised with `retro-shadow-sm`, border |

#### NavigationDrawer Items
| State | Visual |
|:------|:-------|
| **Inactive** | Text in `secondary`, transparent background |
| **Hover** | `surface-container-high` background |
| **Active** | Text in `primary`, `primary-fixed` (#bbf29b) background, 2px left border accent |

### 6.5 Input Field States

| State | Border | Shadow |
|:------|:-------|:-------|
| **Resting** | `pixel-border` (2px #191d17) | none |
| **Focus** | `border-accent` (2px #3b6a24) | none (border color change is sufficient) |
| **Error** | `border-error` (2px #ba1a1a) | none |
| **Disabled** | `border-subtle` (1px #c2c9b9) | none, opacity 0.5 |

### 6.6 Connection Status Indicators

Used in Settings > Linked Devices:

| Status | Visual Pattern |
|:--------|:---------------|
| **Connected** | Green dot (`primary-container` #76a95b) with subtle pulse animation |
| **Searching / Syncing** | Spinning sync icon in `secondary` (#5e604d) |
| **Disconnected** | Gray dot (`outline-variant` #c2c9b9), no animation |
| **Error** | Red dot (`error` #ba1a1a) with rapid blink |

```css
@keyframes pulse-connected {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin-sync {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-connected {
  color: #76a95b;                    /* primary-container */
  animation: pulse-connected 2s ease-in-out infinite;
}

.status-syncing {
  color: #5e604d;                    /* secondary */
  animation: spin-sync 1.5s linear infinite;
}
```

---

## 7. Iconography

### 7.1 Icon Library

Velo Quest uses **Material Symbols Outlined** from Google Fonts, with variable font settings:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```

| Setting | Value | Meaning |
|:--------|:------|:--------|
| `FILL` | `0` | Outlined style (default for UI chrome) |
| `FILL` | `1` | Filled style (active nav items, selected states) |
| `wght` | `400` | Regular weight |
| `GRAD` | `0` | No grade (flat) |
| `opsz` | `24` | Optical size 24px |

### 7.2 Icon Catalog

| Screen / Context | Icon Name | `FILL` | Usage |
|:-----------------|:----------|:-------|:------|
| **Navigation** | | | |
| Home / Dashboard | `directions_bike` | `FILL 0/1` | Ride tab, main CTA |
| Training / History | `history` | `FILL 0/1` | Train tab |
| Competition | `trophy` | `FILL 0/1` | Compete tab |
| Explore / Map | `map` | `FILL 0/1` | Explore tab |
| Profile | `person` | `FILL 0/1` | Profile tab |
| **Actions** | | | |
| Start Ride | `play_arrow` | `FILL 1` | START RIDE button |
| Stop | `stop` | `FILL 1` | STOP button (HUD) |
| Pause | `pause` | `FILL 1` | PAUSE button (HUD) |
| Resume | `play_arrow` | `FILL 1` | RESUME button (HUD) |
| Share | `share` | `FILL 0` | Share ride |
| Download | `download` | `FILL 0` | Download FIT file |
| Settings | `settings` | `FILL 0` | Settings gear icon |
| Search | `search` | `FILL 0` | Search bar icon |
| Filter | `filter_list` | `FILL 0` | Filter toggle |
| **Metrics & Data** | | | |
| Distance | `straighten` | `FILL 0` | Distance metric icon |
| Speed | `speed` | `FILL 0` | Speed metric icon |
| Time / Duration | `schedule` | `FILL 0` | Time metric icon |
| Heart Rate | `favorite` | `FILL 0` | HR metric icon |
| Elevation | `trending_up` | `FILL 0` | Elevation gain icon |
| Power | `bolt` | `FILL 0` | Power/watts icon |
| Cadence | `sync` | `FILL 0` | Cadence/RPM icon |
| Calories | `local_fire_department` | `FILL 0` | Calories burned |
| **Competition** | | | |
| Trophy / Award | `trophy` | `FILL 0` | Achievements, KOM/QOM |
| Leaderboard | `leaderboard` | `FILL 0` | Rankings |
| Swords / Battle | `swords` | `FILL 0` | City Wars, club challenges |
| Star / Favorite | `star` | `FILL 0` | Starred segments, favorites |
| Route | `route` | `FILL 0` | Segments, routes |
| **Social** | | | |
| Club / Squad | `groups` | `FILL 0` | Clubs, squads |
| Person | `person` | `FILL 0` | Profile, rider |
| People | `people` | `FILL 0` | Members, riders |
| **Status** | | | |
| Connected | `bluetooth` | `FILL 0` | Device connected |
| GPS | `gps_fixed` | `FILL 0` | GPS status |
| Battery | `battery_horiz_075` | `FILL 0` | Battery level |
| Verified | `verified` | `FILL 0` | Anti-cheat grade |
| Warning | `warning` | `FILL 0` | Warning state |
| Error | `error` | `FILL 0` | Error state |
| **Marketplace** | | | |
| Gold / Coins | `monetization_on` | `FILL 0` | Currency display |
| XP | `stars` | `FILL 0` | XP points display |
| Shop | `storefront` | `FILL 0` | Marketplace |
| Cart / Buy | `shopping_cart` | `FILL 0` | Purchase action |
| **Profile** | | | |
| Edit | `edit` | `FILL 0` | Edit profile |
| Logout | `logout` | `FILL 0` | Logout / end session |
| Gear Garage | `build` | `FILL 0` | Bike garage |
| Personal Bests | `emoji_events` | `FILL 0` | Personal records |
| Trophy Room | `view_in_ar` | `FILL 0` | Trophy collection |

### 7.3 Icon Sizing

| Context | Size | Optical Size |
|:--------|:-----|:-------------|
| Navigation bar icons | `24px` | `opsz 24` |
| Button icons (leading) | `20px` | `opsz 20` |
| Metric tile icons | `18px` | `opsz 20` |
| Inline icons (labels) | `16px` | `opsz 20` |
| Large decorative icons | `48px` | `opsz 48` |

---

## 8. Layout Patterns

### 8.1 TopAppBar

Fixed header bar at the top of every main screen (except Active Ride HUD).

```
┌──────────────────────────────────────────────────────────────┐
│  [🍔]  VELO QUEST              [avatar]  [🔔]  [⚙️]          │
│  nav                                                            │
│  toggle                                                        │
├──────────────────────────────────────────────────────────────┤
│  border-bottom: 2px solid #191d17                              │
└──────────────────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Position** | `fixed` top, `z-index: 40` |
| **Height** | `h-16` (64px) |
| **Background** | `surface` (#f8faf0) |
| **Border** | `border-b-2 border-solid` with `#191d17` |
| **Left cluster** | Nav toggle (hamburger on mobile, hidden on desktop) + app title in `headline-lg` |
| **Right cluster** | Avatar (32px circle), notification bell, settings gear |
| **Padding** | `px-margin` (16px) horizontal |

### 8.2 BottomNavBar

Fixed bottom navigation bar, visible only on mobile (`md:hidden`).

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  🚴 RIDE │ 📊 TRAIN │ 🏆 COMP. │ 🗺️ EXPL. │ 👤 PROF. │
│  inactive│  active  │ inactive │ inactive │ inactive │
│          │ [raised] │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

| Property | Value |
|:---------|:------|
| **Position** | `fixed` bottom, `z-index: 40` |
| **Height** | `h-16` (64px) |
| **Background** | `surface` (#f8faf0) |
| **Border** | `border-t-2 border-solid` with `#191d17` |
| **Items** | 5 destinations: RIDE, TRAIN, COMPETE, EXPLORE, PROFILE |
| **Item layout** | Icon above label, centered, flex-1 |
| **Active item** | `primary-container` (#76a95b) bg, `retro-shadow-sm`, primary-colored text and icon with `FILL 1` |
| **Inactive item** | Transparent bg, `secondary` (#5e604d) text and icon with `FILL 0` |
| **Visibility** | Hidden on `md:` breakpoint and above |

### 8.3 NavigationDrawer

Left sidebar visible on desktop (`hidden md:flex`). Replaces BottomNavBar on wider screens.

```
┌──────────────────────────┐
│  [avatar 64px]           │  ← User profile header
│  Rider Name              │
│  Level 12 · 4,200 XP    │
│  [══════════░] XP bar    │
├──────────────────────────┤
│  🚴 RIDE            ›    │  ← Nav link (active if on Ride)
│  📊 TRAINING LOG    ›    │
│  🏆 COMPETE         ›    │
│  🗺️ EXPLORE         ›    │
├──────────────────────────┤
│  📡 SENSORS         ›    │  ← Utility links
│  ⚡ POWER ZONES     ›    │
│  🔧 GEAR GARAGE     ›    │
│  🏆 ACHIEVEMENTS    ›    │
├──────────────────────────┤
│                          │
│  [LOGOUT]                │  ← Bottom action
└──────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Position** | `fixed` left, full height |
| **Width** | `w-80` (320px) |
| **Background** | `surface-container-low` (#f2f4ea) |
| **Border** | `border-r-2 border-solid` with `#191d17` |
| **Visibility** | Hidden on mobile, `md:flex md:flex-col` |
| **Profile header** | 64px avatar, rider name, level + XP, thin progress bar |
| **Nav links** | Icon + label, full width, 12px padding |
| **Active link** | `primary-fixed` (#bbf29b) bg, `primary` text, 2px left border accent |
| **Hover link** | `surface-container-high` bg |
| **Logout** | Pinned to bottom, tertiary/accent color |
| **Scroll** | `overflow-y-auto` for long link lists |

### 8.4 Main Content Area

```css
.main-content {
  /* Mobile: full width, padded */
  padding-left: 16px;   /* margin */
  padding-right: 16px;  /* margin */
  padding-top: 80px;    /* TopAppBar offset (64px + 16px) */
  padding-bottom: 80px; /* BottomNavBar offset (64px + 16px) */
  max-width: 1024px;    /* max-w-5xl */
  margin-left: auto;
  margin-right: auto;
}

/* Desktop: offset for NavigationDrawer */
@media (min-width: 768px) {
  .main-content {
    padding-left: calc(320px + 16px);  /* w-80 + margin */
    padding-bottom: 16px;              /* No bottom bar */
    max-width: calc(320px + 1024px);
  }
}
```

### 8.5 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|:-----------|:------|:---------------|
| Default (mobile) | `< 768px` | BottomNavBar visible, NavDrawer hidden, single-column, stat grids 2-col |
| `md:` | `≥ 768px` | NavDrawer visible (flex), BottomNavBar hidden, multi-column, stat grids 4-col |

### 8.6 Screen-Specific Layout Templates

#### Dashboard Layout
```
┌────────────────────────────────────┐
│         TopAppBar                   │
├────────────────────────────────────┤
│  [Active Ride Hero Section]        │  ← If currently recording
│  [START RIDE button (if idle)]     │
├────────────────────────────────────┤
│  [Metric Tile] [Metric Tile]       │  ← 2-col stat grid
│  [Metric Tile] [Metric Tile]       │
├────────────────────────────────────┤
│  [Weekly Load Bar Chart]           │
├────────────────────────────────────┤
│  [Recent Activity Card]            │
├────────────────────────────────────┤
│         BottomNavBar                │
└────────────────────────────────────┘
```

#### Explore Map Layout
```
┌────────────────────────────────────┐
│                                    │
│    ┌──────────────────────┐        │
│    │  Search Bar (overlay) │        │
│    └──────────────────────┘        │
│  [Layer] [Toggle] Buttons         │
│                                    │
│    ┌──────────────────────┐        │
│    │  POI Info Card        │        │  ← Contextual, slides up
│    │  (checkpoints,        │        │
│    │   vouchers)           │        │
│    └──────────────────────┘        │
│                                    │
│         Full-Bleed Map             │
│                                    │
└────────────────────────────────────┘
```

---

## 9. Recurring Component Patterns

### 9.1 MetricTile

A compact data card displaying a single metric with label and value.

```
┌──────────────────┐
│ DISTANCE         │  ← label-sm, UPPERCASE, secondary color
│                  │
│ 42.3      KM     │  ← metric-value (24px, 700), unit in body-sm
└──────────────────┘
```

| Property | Value |
|:---------|:------|
| **Background** | `parchment` (#F5F5DC) |
| **Border** | `pixel-border` (2px solid #191d17) |
| **Shadow** | `retro-shadow` (4px 4px 0px #191d17) |
| **Border radius** | `radius-default` (0.25rem) |
| **Padding** | `tile-padding` (12px) |
| **Label** | `label-sm`, UPPERCASE, `secondary` color, top-left |
| **Value** | `metric-value` (24px, 700), `on-background` color, large |
| **Unit** | `body-sm`, `secondary` color, inline after value |
| **Optional icon** | Leading icon 18px in `secondary` color, left of label |

### 9.2 ActivityCard

A list item representing a single recorded activity.

```
┌──────────────────────────────────────────────┐
│  🚴  MAY 12, 2026                            │
│      Morning Ride                       42.3 │
│      ─────────────────────────────────  KM   │
│      02:14:32 · 18.9 km/h · ▲ 234m          │
│                                    [GRADE A] │
└──────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Background** | `parchment` (#F5F5DC) |
| **Border** | `pixel-border` (2px solid #191d17) |
| **Shadow** | `retro-shadow` |
| **Padding** | `tile-padding` (12px) |
| **Layout** | Flex row: icon → info block → distance/metric → grade badge |
| **Sport icon** | 24px Material Symbol (`directions_bike` / `directions_run` / `directions_walk`) |
| **Date** | `label-sm`, UPPERCASE, `secondary` |
| **Title** | `body-lg` (18px, 500), `on-background` |
| **Sub-metrics** | `body-sm`, `secondary`: Time · Avg Speed · Elevation |
| **Distance** | `metric-value` (24px, 700), right-aligned |
| **Grade badge** | Colored chip: S=gold, A/B=primary-container, C=tertiary, D=error |

### 9.3 SegmentCard

A quest-style card for a route segment (Sprint, Climb, or Rolling type).

```
┌──────────────────────────────────────────────┐
│  [SPRINT]                                    │
│  Downtown Sprint                   0.8 KM    │
│  ─────────────────────────────────────────── │
│  Grade: 2.1%  ·  ⚡ Best: 1:42               │
│  👑 KOM: RiderX (1:38)                       │
│                                    [★ STAR]  │
└──────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Background** | `parchment` (#F5F5DC) |
| **Border** | `pixel-border` |
| **Shadow** | `retro-shadow` |
| **Type badge** | `label-sm`, UPPERCASE: SPRINT (blue tint), CLIMB (tertiary tint), ROLLING (secondary tint) |
| **Segment name** | `body-lg` (18px, 500), `on-background` |
| **Distance** | `metric-value` (24px, 700), right-aligned |
| **Stats row** | `body-sm`: Grade % · Best time · Elevation |
| **KOM/QOM row** | `body-sm` with crown icon 👑, holder name and time |
| **Star action** | Right-aligned star icon toggle (outlined/filled) |
| **Create Quest card** | Dotted border, "+" icon, "CREATE QUEST" label — invites user action |

### 9.4 ProgressBar

A segmented fill bar used for XP, city battles, weekly goals, and challenge progress.

```
┌──────────────────────────────────────────────────┐
│  [███████████████████████░░░░░░░░░░░░░]  67%     │
│  └── #bbf29b (primary-fixed) ──┘                 │
│  ◄── 4px solid #191d17 border ──►                │
└──────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Height** | `h-4` (16px) |
| **Border** | `pixel-border` (2px solid #191d17) |
| **Border radius** | `radius-default` (0.25rem) |
| **Background (empty)** | `surface-container` (#edefe6) |
| **Fill color** | `primary-fixed` (#bbf29b) — standard progress |
| **Fill color (warning)** | `tertiary` (#a13d3e) — time-critical, low battery |
| **Fill color (accent)** | `primary` (#3b6a24) — completed, achieved |
| **Label** | `label-sm`, UPPERCASE, above or beside bar |
| **Percentage** | `metric-value` or `label-lg`, right-aligned beside bar |

#### City Wars VS Progress Bar

Special variant for City Hub: two-colored bar showing two cities competing:

```
┌──────────────────────────────────────────────────┐
│  SIEDLCE  [████████████░░░░░░░░]  LUBLIN         │
│           ◄── green ──►◄── red ──►               │
│           12,841 KM       9,200 KM               │
└──────────────────────────────────────────────────┘
```

- Left fill: `primary-fixed` (#bbf29b) for user's city
- Right fill: `tertiary` (#a13d3e) for opponent city
- Thick `pixel-border-thick` (4px) for emphasis

### 9.5 Parchment Card

The signature card style of Velo Quest. Nearly all card components use this base pattern.

```css
.parchment-card {
  background: #F5F5DC;                                    /* parchment */
  border: 2px solid #191d17;                              /* pixel-border */
  border-radius: 0.25rem;                                 /* radius-default */
  box-shadow: 4px 4px 0px 0px rgba(25, 29, 23, 1);       /* retro-shadow */
  padding: 12px;                                          /* tile-padding */
  font-family: 'Space Grotesk', sans-serif;
  transition: transform 0.15s ease;
}

.parchment-card:hover {
  transform: translateY(-2px);                            /* hover lift */
}
```

### 9.6 Stat Grid (Bento Layout)

A dense grid of [`MetricTile`](#91-metrictile) components. Used on Dashboard, Pro Dashboard, and Profile.

```
┌──────────────┬──────────────┐
│ POWER        │ HEART RATE   │
│ 245       W  │ 142      BPM │
├──────────────┼──────────────┤
│ CADENCE      │ DISTANCE     │
│ 88       RPM │ 42.3     KM  │
└──────────────┴──────────────┘
```

| Property | Value |
|:---------|:------|
| **Layout** | CSS Grid: 2 columns (mobile), 4 columns (desktop) |
| **Gap** | `container-gap` (4px) |
| **Cell** | [`MetricTile`](#91-metrictile) with compact padding |
| **Full-width variant** | Single tile spans all columns for hero stat |

### 9.7 Club Card

Used in Clubs Directory for squad listings.

```
┌──────────────────────────────────────────────┐
│  [CLUB LOGO]  VELO SQUAD SIEDLCE             │
│  48x48 px     ─────────────────────────────── │
│               👥 42 members · ⚡ Active       │
│               ⭐ 12,400 XP this week          │
│               ┌─────────────────────────────┐ │
│               │ Activity: ████████░░ 80%    │ │
│               └─────────────────────────────┘ │
│                         [RECRUITING] badge    │
│                      [REQUEST TO JOIN] button │
└──────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Background** | `parchment` (#F5F5DC) |
| **Border** | `pixel-border` |
| **Shadow** | `retro-shadow` |
| **Logo** | 48×48px placeholder or club avatar, square |
| **Club name** | `headline-md` (24px, 700) |
| **Member count** | `body-sm` with `groups` icon |
| **XP / activity** | `body-sm`, `secondary` |
| **Activity bar** | `ProgressBar` variant (h-2, thin) |
| **Recruiting badge** | Rotated ribbon top-right, `tertiary` bg, white text, `label-sm` UPPERCASE |
| **Join button** | `Primary` variant: "JOIN INSTANTLY" or `Secondary`: "REQUEST TO JOIN" |

### 9.8 XP Progress Bar (Profile)

```
┌──────────────────────────────────────────────────┐
│  LEVEL 12                         4,200 / 5,000  │
│  [████████████████████░░░░░░░░░░]     84%        │
│  ◄── primary-fixed fill ──►                      │
└──────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Height** | `h-6` (24px) — taller than standard progress bar |
| **Level label** | `label-lg`, `primary` color, left |
| **XP numbers** | `body-sm`, `secondary`, right |
| **Fill** | `primary-fixed` (#bbf29b) |
| **Border** | `pixel-border` (2px) |

### 9.9 Trophy Card (Profile Trophy Room)

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  🏆      │  │  🏆      │  │  🔒      │  │  🔒      │
│ CENTURY  │  │  KOM     │  │          │  │          │
│ RIDE     │  │ HUNTER   │  │ ???      │  │ ???      │
│          │  │          │  │          │  │          │
│ Unlocked │  │ Unlocked │  │ Locked   │  │ Locked   │
│ (color)  │  │ (color)  │  │ (gray)   │  │ (gray)   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

| Property | Value |
|:---------|:------|
| **Unlocked state** | Full color, `parchment` bg, `pixel-border`, trophy icon |
| **Locked state** | Grayscale (`outline-variant` tint), "???" label, lock icon |
| **Trophy name** | `label-sm` below icon |
| **Hover (unlocked)** | Tooltip with trophy description and unlock date |
| **Layout** | 3-4 column grid, `gutter` (8px) gap |

### 9.10 Search Bar

Used on Explore Map, Global Leaderboard, Clubs Directory.

```
┌────────────────────────────────────────────────┐
│  🔍  Search cities...                          │
└────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Background** | `surface` (#f8faf0) or slightly elevated |
| **Border** | `pixel-border` (2px solid #191d17) |
| **Border radius** | `radius-default` (0.25rem) |
| **Height** | `h-12` (48px) |
| **Leading icon** | `search` (20px), `secondary` color, 12px left padding |
| **Placeholder** | `body-md`, `secondary` color |
| **Focus** | Border changes to `border-accent` (2px #3b6a24) |

### 9.11 Filter Chips / Pills

```
[ ALL ]  [ LOCAL ]  [ TOP RANKED ]  [ RECRUITING ]
  active    inactive    inactive       inactive
```

| State | Background | Text Color | Border |
|:------|:-----------|:-----------|:-------|
| **Active** | `primary` (#3b6a24) | `on-primary` (#ffffff) | `pixel-border` |
| **Inactive** | `surface` (#f8faf0) | `secondary` (#5e604d) | `pixel-border` |
| **Hover** | `primary-container` (#76a95b) | `on-primary-container` (#191d17) | `pixel-border` |

### 9.12 Performance Chart Cards

Used on Performance Trends and Pro Dashboard screens.

```
┌──────────────────────────────────────────────────┐
│  FITNESS (CTL)                    42.3  ▼ or ▲   │
│  ┌──────────────────────────────────────────────┐│
│  │    ╱╲    ╱╲                                ││
│  │   ╱  ╲╱╱  ╲    ╱╲                          ││
│  │  ╱        ╲╲╱╱  ╲                         ││
│  │ ╱              ╲                            ││
│  │─────────────────────────────────────────────││
│  │ Jan  Feb  Mar  Apr  May  Jun                ││
│  └──────────────────────────────────────────────┘│
│  [6 MONTH LOAD]                                  │
└──────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Card** | Standard [`Parchment Card`](#95-parchment-card) |
| **Header** | `label-lg`, UPPERCASE, metric name + current value + trend arrow |
| **Chart area** | Bar chart or line chart, 8-bit retro aesthetic |
| **Bar colors** | `primary-fixed` (#bbf29b) for positive, `tertiary` (#a13d3e) for negative |
| **Axis labels** | `caption` (10px), `secondary` color |
| **Time range** | `label-sm`, bottom of chart |

### 9.13 Achievement Carousel

Horizontal scrollable row of achievement cards (Pro Dashboard).

```
┌──────────────────────────────────────────────────────┐
│  ACHIEVEMENTS                                    [→] │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 🏆      │ │ ⭐      │ │ 🔥      │ │ 🚀      │   │
│  │ Century │ │ 1000 KM │ │ 7-Day   │ │ Speed   │   │
│  │ Ride    │ │ Club    │ │ Streak  │ │ Demon   │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└──────────────────────────────────────────────────────┘
```

| Property | Value |
|:---------|:------|
| **Layout** | Horizontal scroll with snap points |
| **Card size** | ~100×120px mini card |
| **Card style** | Mini [`Parchment Card`](#95-parchment-card) with `retro-shadow-sm` |
| **Scroll arrow** | Right side "→" button to advance carousel |

---

## 10. Screen-Specific Design Notes (STITCH — Updated 2026-05-06)

> All screens below have verified HTML mockups in [`docs/mockups/`](docs/mockups/).
> Design decisions extracted from production-ready HTML with full Tailwind token palette.

### 10.1 City Hub (Siedlce)
**Mockup**: `docs/mockups/10-city-hub.html`

The "home screen" for city-level competition. Pixel-art competitive dashboard:

- **City Wars Banner**: Full-width hero card with city image overlaid with gradient overlay (`bg-gradient-to-t from-on-background/80`). VS progress bar comparing user's city against the next-higher-ranked city. Uses two-tone fill: `primary` (#3b6a24) green-left, `tertiary` (#a13d3e) red-right. Shows city names, VP (Velos Points) totals, and overtake delta.
- **Local Leaderboard**: Top 3 riders in `Siedlce` shown as compact list. Active user's row highlighted with `primary-container` background, `retro-shadow-sm` and `translate-y-[-2px]` lift effect. Rank column uses `metric-value` for numbers.
- **Nearby Quests**: 2-column grid (1 on mobile) of segment cards within `parchment-bg` section. Each card has `hover:translate-y-[-2px]` + `hover:shadow-[4px_4px_0px_0px]` transition. Includes "KOM LOST" / "KING" status badges.
- **City of the Week**: Hero banner with `aspect-[1.83]` ratio, city crest image, gradient overlay, and "CITY OF THE WEEK" badge with star icon.
- **BottomNavBar**: 4 items — City Hub (active, lifted), Global, Segments, Clubs. Active item: `bg-primary-container`, `shadow-[2px_2px_0px_0px]`, `translate-y-[-2px]`. Mobile only.
- **TopAppBar**: Sticky, `border-b-4`, `shadow-[0px_4px_0px_0px]`. Shows avatar + "QUEST VELOS" + LVL badge.

### 10.2 Explore Map
**Mockup**: `docs/mockups/05-explore-map.html`

Full-bleed interactive map (MapLibre-ready) with overlaid UI:

- **Map Area**: `flex-1 relative bg-surface-variant overflow-hidden`. Full-screen map image with `radial-gradient` heatmap overlay simulating personal heatmap (`from-tertiary-container/40 via-transparent`).
- **Search Bar Overlay**: Floating top, solid `parchment-bg` (#F5F5DC) with `pixel-border pixel-shadow`. Material Symbols search icon + text input styled as `retro-input` with `placeholder-on-surface-variant`.
- **Layer Toggle Buttons**: Vertical stack of `parchment-bg` icon buttons: layers toggle and heatmap toggle. Each `w-12 h-12` with `pixel-shadow-interactive:active` press effect.
- **Contextual Info Card**: Bottom-right (desktop) / bottom (mobile). `parchment-bg` card showing "SELECTED REGION" label, district name (`headline-lg`), grid of checkpoint/voucher counts, and "START QUEST" action button (`primary-container` bg).
- **POI Markers**: Absolute-positioned decorative markers on map — `w-8 h-8 rounded-full pixel-border` with activity/flag icons. Colors: `tertiary` / `primary` backgrounds.
- **NavigationDrawer (Desktop)**: Left sidebar `w-80` with semi-transparent backdrop. Sections: SENSORS, POWER ZONES, GEAR GARAGE, ACHIEVEMENTS, LOGOUT. Active item has `border-l-4 border-secondary-fixed`.
- **BottomNavBar (Mobile)**: 4 tabs — DASHBOARD, MAP (active with green glow `drop-shadow-[0_0_5px_#72ff70]`), QUESTS, PROFILE.

### 10.3 Active Ride HUD
**Mockup**: `docs/mockups/02-active-ride-hud.html` (Solar White cards)
**Mockup v2**: `docs/mockups/09-active-ride-hud-vt323.html` (VT323 dark theme, Polish labels)

Two variants serve different use cases:

**Variant A — Solar White Cards (default):**
- **Background**: Full-bleed map image with cyclist sprite overlay (pixel-art, `w-24 h-24 rounded-full pixel-border`).
- **Overlay Cards**: `parchment-bg` (#F5F5DC) cards over the map, `pixel-border pixel-shadow` styling.
- **Main Speed**: Central card, `headline-xl` 48px for speed value, metric label UPPERCASE above.
- **Secondary Metrics Row**: 3-column flex (`flex-1`): Distance, HR (with red `favorite` icon), Time. Each a parchment card.
- **Single Action Button**: "PAUSE RIDE" — `bg-[#FFB800]` (gold-amber), full-width, `headline-lg`, uppercase. Centered at bottom.
- **No chrome**: No TopAppBar, no BottomNavBar. Full-bleed HUD.

**Variant B — VT323 Dark Theme (Polish):**
- **Typography**: `font-family: 'VT323'` monospace for ALL metric values. Polish labels: "PRĘDKOŚĆ", "DYSTANS", "CZAS", "TĘTNO", "PRZEWYŻSZ.", "KIERUNEK".
- **Layout**: Speed as large central element (6xl, ~60px VT323). Distance/Avg Speed as "wings" flanking it. Time/Heart Rate/Elevation/Bearing in secondary row below.
- **Three Action Buttons** at bottom:
  - **STOP**: `bg-pixel-red` (#e74c3c) with square stop icon
  - **PAUSE/RESUME**: `bg-pixel-yellow` (#f1c40f) with dual-bar pause icon
  - **RESUME (small)**: `bg-pixel-green` (#2ecc71) with triangle play icon
- **Compass Rose**: 4-direction pixel-art compass showing "N" bearing indicator.

### 10.4 Ride Summary (Ride Complete)
**Mockup**: `docs/mockups/01-ride-summary.html`

Post-ride celebration screen — the "quest complete" moment:

- **Header**: Centered "RIDE COMPLETE" in `headline-xl`, subtitle "Quest objectives achieved." in `body-lg text-outline`.
- **Achievement Badge**: Large `w-64 h-64` pixel-art badge image ("Century Finisher" gold shield with gear). Decorative pulsing circle behind it (`animate-pulse`, `primary-container` at 20% opacity).
- **Rank Tile**: Large "S" rank letter in gold `#FFB800` at 72px with `drop-shadow-[2px_2px_0px_#191d17]`. Label "Legendary" below.
- **Stats Bento**: 1+2+1 grid layout (rank tile spans 1 col, stats grid spans 2 cols). Stats: Distance (54.2 km), Time (2h 15m), Elevation Gain (850m with segmented progress bar).
- **Elevation Progress Bar**: Horizontal segmented blocks — 3 filled `bg-tertiary`, 2 empty `bg-surface-variant`. Pixel-border on each segment.
- **Primary Action**: "BACK TO HUB" — `bg-[#FFB800]` (gold), full-width, `headline-lg`, with `hub` icon.
- **BottomNavBar**: 4 tabs — DEPO, MAP, QUESTS (active), CLUBS. Active tab: `bg-primary-container`, `border-2 border-on-background`, `shadow-[2px_2px_0px_0px]`.
- **TopAppBar**: "CYCLO-QUEST" branding with pixel-art avatar and settings gear button.

### 10.5 Ride Paused
**Mockup**: `docs/mockups/11-ride-paused.html`

Transient pause state — dark overlay modal over blurred map:

- **Background**: Map image with `backdrop-blur-md brightness-50` dark overlay (`bg-blur bg-on-background/40`).
- **Visible Background Metrics**: Two parchment cards floating top, opacity-80, non-interactive. Show "AVG SPEED" (29.1 km/h) and "CLIMB" (1200m).
- **Central Modal**: `bg-surface border-4 rounded-xl p-6 max-w-sm`. Contains:
  - Pause icon in `secondary-container` circle (64×64, `rounded-full pixel-border`).
  - "SESSION PAUSED" headline (`headline-lg`, uppercase, centered).
  - **RESUME button**: `bg-primary-container`, full-width, `headline-lg`, with `play_arrow` icon.
  - **STOP RIDE button**: `bg-error text-on-error`, full-width, with `stop` icon.
- **Arcade button press**: `arcade-button:active` translates (4px, 4px), shadow disappears.
- **No navigation chrome** — minimal transient state.

### 10.6 Profile & Stats (Athlete Profile)
**Mockup**: `docs/mockups/03-profile.html`

Comprehensive athlete profile screen — RPG character sheet:

- **Hero Banner**: `parchment-bg pixel-border pixel-shadow` with avatar (40×40 desktop), rider name "RIDER_01", subtitle "ROAD WARRIOR", LVL badge, XP progress bar (95% fill, `bg-primary`). Decorative giant `pedal_bike` icon at 10% opacity in corner.
- **All-Time Stats Bento**: `headline-lg` section header with `bar_chart` icon. 2×2 grid (4 cols on sm): Distance (12,450 km), Elevation (185k), Rides (412), Max Power (1,120W). Each tile `parchment-bg pixel-border` with absolute-positioned UPPERCASE label top-left and `metric-value` bottom-right.
- **Action Buttons**: 2-column grid of large `secondary-container` cards: "PERSONAL BESTS" (timer icon) and "GEAR GARAGE" (`pedal_bike` icon, `bg-primary text-on-primary`). Each `p-6 pixel-border pixel-shadow` with `group-hover:scale-110` icon animation.
- **Trophy Room**: Side column (desktop), 3×3 grid of achievement tiles. Unlocked: `parchment-bg` with image/icon, hover shows label. Locked: `bg-surface-dim opacity-50 grayscale` with lock icon.
- **NavigationDrawer (Desktop)**: `w-80` with blurred backdrop. Avatar + stats header. Menu: DASHBOARD, MAP, QUESTS, PROFILE (active with `bg-primary-container border-l-4`), LOGOUT.
- **BottomNavBar (Mobile)**: 4 tabs — DASHBOARD, MAP, QUESTS, PROFILE (active with green glow).

### 10.7 Performance Trends
**Mockup**: `docs/mockups/04-performance-trends.html`

Training analytics with retro chart aesthetic:

- **Header**: "PERFORMANCE TRENDS" (`headline-xl`) + "Track your evolution, warrior." subtitle.
- **Fitness/Fatigue/Form Cards**: 3-column grid of `parchment-bg` cards:
  - **Fitness (CTL)**: 82, +3 this week, `primary` heart icon.
  - **Fatigue (ATL)**: 95, "High Load", `tertiary` warning icon.
  - **Form (TSB)**: -13, "Optimal Training", `secondary` speed icon.
- **6-Month Load Chart**: `pixel-border pixel-shadow` card with grid-pattern background (`linear-gradient` 16px grid). Simulated bar chart using div bars (`primary-container` bg, `pixel-border` on each bar). X-axis labels JAN-JUN in `label-sm`.
- **VO2 Max Card**: Image background card with dark overlay (`bg-on-background/60`). "VO2 MAX" label, value 58.2 in `headline-xl primary-fixed` with `drop-shadow`.
- **FTP Card**: `secondary-container` bg with diagonal stripe pattern. "CURRENT FTP" label, value "285W" in `headline-xl`.
- **SideNav (Desktop)**: SENSORS, POWER ZONES (active), GEAR GARAGE, ACHIEVEMENTS, LOGOUT.
- **BottomNavBar (Mobile)**: DASHBOARD, MAP, POWER ZONES (active, green glow), PROFILE.

### 10.8 Activity Detail (Ride Deep-Dive)
**Mockup**: `docs/mockups/15-activity-detail.html`

Post-ride analysis — "Mountain Pass Ride" example:

- **Header Info Card**: `bg-surface-container retro-border retro-shadow` with subtle map background at 10% opacity. Calendar icon + date/time ("Oct 24, 2023 • 08:30 AM"), ride title (`headline-lg`), green dot + "Completed" status.
- **Summary Stats Bento**: 2×2 grid (4 cols desktop) of `parchment-bg` cards: Distance (42.5 km), Time (1:45:22), Elevation (+850m with `arrow_upward` icon), Avg Speed (24.2 km/h). Metric values right-aligned, UPPERCASE labels top.
- **Interactive Map Route**: Section with "Route" header. `h-[250px] md:h-[350px]` map area (`bg-primary-container pixel-map-container`). Overlaid start/end markers: green dot + flag icon at route ends.
- **Achievement Carousel**: Horizontal scroll with snap. Cards: "Segment KOM — Pine Climb" (gold trophy, rotated), "New PR — Valley Sprint" (green star). Each `bg-surface-container retro-border min-w-[200px]`.
- **Performance Charts**: `parchment-bg` card with legend (Elev/HR). Simulated chart area with dashed Y-axis grid lines, chart image with `mix-blend-multiply` overlay.
- **Action Buttons**: Two-column flex — "SHARE RIDE" (`bg-primary`, share icon), "DOWNLOAD FIT FILE" (`bg-surface-variant`, download icon). Both `retro-border retro-shadow retro-button-active`.
- **TopAppBar**: Back arrow + "VELO QUEST" title + overflow menu. `border-b-4 shadow-[4px_4px_0px_0px]`. No BottomNavBar (task-focused sub-page).

### 10.9 Training Log (Activity History)
**Mockup**: `docs/mockups/13-training-log.html`

Scrollable quest log of past rides:

- **Weekly Summary Bento**: `parchment-bg` card with background image at 20% opacity. 2-col grid: Distance (124.5 km) and Time (5:23 hr) in `metric-value primary`. Progress bar below (`bg-primary w-[75%]`).
- **Activity Cards**: Vertical stack of `parchment-bg` cards with `hard-shadow active-shadow` press effect. Each card: date (UPPERCASE `label-sm`), ride title (`headline-lg` 24px bold), activity icon (`directions_bike` or `local_fire_department`), Distance + Time metrics in 2-col grid.
- **TopAppBar**: VELO QUEST branding, desktop nav with Dashboard/Map/Quests/Profile links, settings gear button.
- **BottomNavBar**: 4 tabs — Dashboard, Map, TRAINING LOG (active, `bg-primary-container border-x-2`), Profile. Fixed bottom, `shadow-[0px_-4px_0px_0px]`.

### 10.10 Global Leaderboard
**Mockup**: `docs/mockups/06-global-leaderboard.html`

City-vs-city worldwide ranking:

- **Search**: Full-width search input with `material-symbols-outlined` search icon, `pixel-border` (4px), `shadow-[4px_4px_0px_0px]`, focus effect `translate-y-[2px] translate-x-[2px] shadow-[2px_2px_0px_0px]`.
- **Ranked City Rows**: `parchment-bg` cards with `pixel-border` (4px), `shadow-[4px_4px_0px_0px]`. Each row: rank number (1/2/3 in `headline-lg`), city crest (48×48 `pixel-border` image), city name + country, points total. Rank 1 has star badge `bg-tertiary-container` top-right.
- **User's City (Contextual)**: Berlin at rank 42 shown at 70% opacity.
- **Live Battle Map**: Image section with `grayscale opacity-50` map background, "Live Battle" badge overlay in `primary-container` with `pixel-border`.
- **Sticky Footer**: "Your City" bar fixed bottom, `border-t-4 shadow-[0px_-4px_0px_0px]`. Shows rank number (128) in `primary-container` circle, city name "Siedlce" (`headline-lg`), total points (142k) in `parchment-bg` badge.
- **BottomNavBar**: City Hub, Global (active, lifted, `bg-primary-container`), Segments, Clubs.

### 10.11 Local Segments
**Mockup**: `docs/mockups/07-segments.html`

Nearby segment discovery and KOM/QOM challenges:

- **TopAppBar**: Desktop tab navigation — City Hub, Global, Segments (active, `border-b-2 border-primary`), Clubs. Mobile: LVL badge button.
- **Header & Filters**: "Explore Segments" (`headline-xl`) + subtitle. Filter chips: "Nearby" (active, `bg-primary-container`), "Personal Bests", "Challenged". Each `border-2 border-on-background shadow-[2px_2px_0px_0px]` with hover lift.
- **Featured Map**: Hero map area `h-64 border-4 shadow-[4px_4px_0px_0px]`. Overlay card bottom-left: "Featured Quest — Mt. Sentinel Climb".
- **Segment Cards Grid**: 3-column bento grid (1 on mobile). Each card `parchment-bg border-2 shadow-[4px_4px_0px_0px] hover:translate-y-[-2px]`:
  - **Sprint**: "Riverside Dash" — 1.2 km, 0% grade. KOM: ShadowRider (01:42).
  - **Climb**: "Lookout Peak" — 4.5 km, 8.5% grade (`text-tertiary`). QOM: AeroQueen (14:28). Card has background image at 20% opacity.
  - **Rolling**: "Valley Loop" — 12.0 km, 2% grade. KOM unclaimed (`text-outline`).
  - **Create Quest**: Action card with dashed border, `add_location_alt` icon, "Map It" button.
- **BottomNavBar**: City Hub, Global, Segments (active, lifted), Clubs.

### 10.12 Marketplace (XP Shop)
**Mockup**: `docs/mockups/08-marketplace.html`

Gamified shop for spending XP and Gold on gear:

- **Hero Banner**: Full-width image card with dark overlay (`bg-black/40`), "MARKETPLACE" title (`headline-xl text-on-primary`), subtitle "Spend XP and Gold on epic gear".
- **Currency Status**: 2-column flex of `parchment-bg` cards: GOLD (1,250 with `monetization_on` icon) and XP (45,000 with `star` icon).
- **Avatar Gear Section**: "Avatar Gear" header with `checkroom` icon. 2-column grid (desktop):
  - **Aero Helmet Lvl 1**: Image card, +2 Spd, 500 Gold, "BUY" button (`primary-container`).
  - **Crimson Jersey**: "RARE" badge (`bg-tertiary`), +5 End, 10k XP.
- **Power-Ups Section**: "Power-Ups" header with `bolt` icon. 4-column grid of square cards: "Sprint Boost" (100g), "Draft Shield" (150g). Each `bg-surface-container pixel-border hard-shadow` with icon + label + price + BUY button.
- **NavigationDrawer (Desktop)**: SENSORS, POWER ZONES, GEAR GARAGE, ACHIEVEMENTS (active, `bg-primary-container border-l-4`), LOGOUT.
- **BottomNavBar (Mobile)**: DASHBOARD, MAP, QUESTS (active, green glow), PROFILE.

### 10.13 Clubs Directory
**Mockup**: `docs/mockups/14-clubs.html`

Squad/faction discovery and recruitment:

- **Hero Banner**: Full-width image with gradient overlay, "SQUAD DIRECTORY" title, descriptive subtitle.
- **Filter Bar**: `bg-surface-container-lowest pixel-border retro-shadow`. Horizontal scroll chips: "All Clubs" (active, `bg-primary text-on-primary`), "Local Factions", "Top Ranked", "Recruiting". Search input with icon.
- **Club Cards Grid**: 3-column (1 on mobile) `parchment-bg` cards with `retro-shadow`:
  - **Neon Riders** (Rank #1): Icon + name + location. Stats grid: Members (124), Weekly XP (8.4k, `text-primary`). Activity bar (4/5 blocks filled). "Request to Join" button (`primary-fixed`).
  - **Gravel Grinders** (Rank #12): Members (56), Weekly XP (3.2k). Moderate activity.
  - **Velociraptors** (Recruiting): "RECRUITING" ribbon badge (`bg-tertiary`, rotated 45°). Members (18/20, `text-tertiary`), Focus: SPRINTS. "Join Instantly" button (`bg-tertiary`).
- **Load More**: Centered button with `retro-shadow retro-button-active`.
- **TopAppBar (Desktop)**: Tab navigation — City Hub, Global, Segments, Clubs (active, `bg-primary-container retro-shadow-sm -translate-y-1`).
- **BottomNavBar (Mobile)**: City Hub, Global, Segments, Clubs (active, lifted).

### 10.14 Settings & Sensors
**Mockup**: `docs/mockups/12-settings.html`

System configuration and device management:

- **Hero Section**: Image background with gradient overlay, "SYSTEM CONFIG" title, subtitle.
- **Linked Devices Column**: `headline-lg` header with `bluetooth` icon. Device cards `parchment-bg pixel-border pixel-shadow`:
  - **Heart Rate**: TICKR FIT - 8A2B — Connected (green pulsing dot `animate-pulse`, `bg-primary`).
  - **Power Meter**: ASSIOMA DUO — Connected (green pulsing dot).
  - **Speed/Cadence**: Wahoo Blue SC — Searching... (`animate-spin sync` icon, `opacity-80 bg-surface-dim`).
  - "ADD NEW SENSOR" button (`bg-primary text-on-primary`, full-width).
- **User Settings Column**: "USER SETTINGS" header with `person` icon. `bg-surface-container pixel-border` card with bordered rows: Rider Weight (72 KG), Max Heart Rate (192 BPM). Each row: label + value in `parchment-bg` badge with `pixel-border`.
- **UI Customization Column**: "UI CUSTOMIZATION" header with `palette` icon. Theme toggle (Light/Dark buttons `pixel-border pixel-shadow`). Haptic Feedback toggle (custom blocky switch: `w-14 h-8 bg-primary rounded-full`).
- **NavigationDrawer (Desktop)**: SENSORS (active, `bg-primary-container border-l-4`), POWER ZONES, GEAR GARAGE, ACHIEVEMENTS, LOGOUT.
- **BottomNavBar (Mobile)**: DASHBOARD, MAP, QUESTS, PROFILE (active, green glow).

### 10.15 Navigation Shell Patterns (Cross-Screen)

Recurring navigation patterns observed across all STITCH mockups:

| Component | Mobile | Desktop |
|:----------|:-------|:--------|
| **TopAppBar** | Fixed top, `h-16`, `bg-primary-container/80 backdrop-blur-md`, `border-b border-primary/30`. Shows avatar + "VELO QUEST" + settings gear. Hidden during Active Ride HUD and Ride Paused. | Same but docked full-width, `border-b-4 border-on-background shadow-[0px_4px_0px_0px]`. Tab navigation inline. |
| **BottomNavBar** | Fixed bottom, `h-20`, 4-5 tab items. Active item: `bg-primary-container text-on-primary-container`, `border-2 border-on-background`, `shadow-[2px_2px_0px_0px]`, `translate-y-[-2px]`. Inactive: `text-on-surface-variant`, hover `bg-surface-container-high`. Container: `bg-surface-container-lowest/90 backdrop-blur-xl border-t border-secondary-fixed/50`. | **Hidden** — replaced by SideNav/NavigationDrawer. |
| **SideNav (Desktop)** | N/A | `w-80`, fixed left, `rounded-r-xl border-r border-primary shadow-2xl bg-surface-container-low/95 backdrop-blur-md`. Header with avatar + LVL + FTP. Menu items with `hover:bg-surface-container-highest`. Active item: `bg-primary-container text-primary border-l-4 border-secondary-fixed`. LOGOUT at bottom. |
| **Tab Label Style** | UPPERCASE `label-sm` with icon | Sentence case `body-lg` with icon |

**Default BottomNavBar Tab Sets by Screen Group:**

| Screen Group | Tabs |
|:-------------|:-----|
| Competition (City Hub, Global, Segments, Clubs) | City Hub, Global, Segments, Clubs |
| Personal (Dashboard, Map, Quests/Training, Profile) | Dashboard, Map, Quests, Profile |
| Task-Focused (Activity Detail, Ride Summary) | No BottomNavBar — back navigation only |
| Ride States (Active HUD, Paused) | No navigation chrome |

---

### Mockup Reference Index

| # | Screen | File |
|:--|:-------|:-----|
| 01 | Ride Summary (Ride Complete) | `docs/mockups/01-ride-summary.html` |
| 02 | Active Ride HUD (Solar White) | `docs/mockups/02-active-ride-hud.html` |
| 03 | Profile & Stats | `docs/mockups/03-profile.html` |
| 04 | Performance Trends | `docs/mockups/04-performance-trends.html` |
| 05 | Explore Map | `docs/mockups/05-explore-map.html` |
| 06 | Global Leaderboard | `docs/mockups/06-global-leaderboard.html` |
| 07 | Local Segments | `docs/mockups/07-segments.html` |
| 08 | Marketplace (XP Shop) | `docs/mockups/08-marketplace.html` |
| 09 | Active Ride HUD (VT323/Polish) | `docs/mockups/09-active-ride-hud-vt323.html` |
| 10 | City Hub (Siedlce) | `docs/mockups/10-city-hub.html` |
| 11 | Ride Paused | `docs/mockups/11-ride-paused.html` |
| 12 | Settings & Sensors | `docs/mockups/12-settings.html` |
| 13 | Training Log | `docs/mockups/13-training-log.html` |
| 14 | Clubs Directory | `docs/mockups/14-clubs.html` |
| 15 | Activity Detail | `docs/mockups/15-activity-detail.html` |
| 32 | `cyclist_victory` | Euforia, szeroko otwarte oczy, okrzyk radości | ✅ Istniejący — wygrana |
| 33 | `cyclist_focused` | Skupiony, zmarszczone brwi, wzrok przed siebie | 🔲 NOWY — tempo ride, segment |
| 34 | `cyclist_pain` | Grymas bólu, zaciśnięte zęby | 🔲 NOWY — climbing standing, Zone 5 |
| 35 | `cyclist_surprised` | Zaskoczony, uniesione brwi | 🔲 NOWY — niespodziewany achievement |
| 36 | `cyclist_calm` | Spokojny, zamknięte oczy, medytacja | 🔲 NOWY — cafe stop, stretching |

### 7.3 Bike Garage — Ekran Serwisu i Ekwipunku

**Plik**: [`mobile/src/screens/BikeGarageScreen.tsx`](mobile/src/screens/BikeGarageScreen.tsx) — **NOWY**

**Cel**: RPG-owy ekran zarządzania sprzętem. Kolarz widzi swój rower, jego stan i może go serwisować.

**Zawartość:**
- **Bike Display**: Centralnie animowany sprite roweru (typ wybrany przez użytkownika), obracający się powoli (3 klatki: bok, 3/4, przód)
- **Bike Name**: Użytkownik nazywa swój rower (np. "Czarna Błyskawica")
- **Condition Meter**: Pasek stanu roweru 0-100%. Spada z każdym przejechanym kilometrem. <20% = rower "skrzypi", niższa prędkość
- **Parts Status** (ikony części):
  - 🔗 **Chain** (łańcuch): zużycie 0-100%, wymiana co ~3000 km
  - 🛞 **Tires** (opony): zużycie, przebicie (losowy event)
  - 🛑 **Brakes** (hamulce): zużycie klocków
  - ⚙️ **Drivetrain** (napęd): kaseta + korba, zużycie
- **Service Button**: "SERVICE BIKE" — animacja sprite'a `bike_service` (8 klatek), resetuje stan części
- **Service History**: Lista przeglądów z datą i przebiegiem
- **Upgrades Shop**: Możliwość "zakupu" ulepszeń (lżejsza rama, aero koła) za XP — zwiększają statsy
- **Bike Stats**: Waga (kg), Aero (0-100), Comfort (0-100), Terrain (0-100) — wpływają na osiągi w symulacji

### 7.4 Race Day — Tryb Wyścigu

**Plik**: [`mobile/src/screens/RaceDayScreen.tsx`](mobile/src/screens/RaceDayScreen.tsx) — **NOWY (aspiracyjny, Faza 3+)**

**Cel**: Specjalny tryb na zawody/wydarzenia. Imersyjny interfejs wyścigu.

**Zawartość:**
- **Pre-Race**: Odliczanie 3...2...1...GO! z animacją startera (flaga)
- **Race HUD**: Pozycja w wyścigu (1/50), dystans do lidera, międzyczasy
- **Peloton Visualization**: Uproszczona wizualizacja peletonu — gdzie jesteś względem grupy
- **Attack Button**: "ATTACK" — próba ucieczki (zużywa energię, szansa na sukces)
- **Sprint Finish**: Na ostatnim kilometrze — tapowanie dla sprintu, animacja `riding_attack`
- **Post-Race**: Ceremonia, podium, konfetti

### 7.5 Travel Mode — Tryb Podróży

**Plik**: [`mobile/src/screens/TravelModeScreen.tsx`](mobile/src/screens/TravelModeScreen.tsx) — **NOWY (aspiracyjny, Faza 3+)**

**Cel**: Długodystansowe podróże rowerowe (bikepacking, touring).

**Zawartość:**
- **Journey Map**: Trasa podróży z punktami etapowymi (noclegi, postoje, punkty widokowe)
- **Daily Log**: Dziennik podróży — dystans dnia, zdjęcia, notatki
- **Packing List**: Lista ekwipunku (namiot, śpiwór, kuchenka, jedzenie)
- **Weather Forecast**: Prognoza na kolejne dni trasy
- **Journey Stats**: Łączny dystans, dni w trasie, przewyższenia, spalone kalorie

### 7.6 Mikro-Narracje i Game Vibe Elementy

Elementy budujące atmosferę, rozsiane po całej aplikacji:

| Element | Opis | Gdzie występuje |
|:--------|:-----|:----------------|
| **Bidon Counter** | Licznik wypitych bidonów podczas jazdy (ikonka bidonu napełniająca się) | Tracking HUD |
| **Café Stop Prompt** | Po 2h jazdy: "COFFEE BREAK?" — sugestia przerwy, sprite `cafe_stop` | Tracking HUD (auto trigger) |
| **Sunrise/Sunset Alert** | Powiadomienie o wschodzie/zachodzie słońca z animacją nieba | Dashboard, Tracking |
| **Tailwind Bonus** | "TAILWIND! +2 KM/H" — wiatr w plecy, ikonka wiatru | Tracking HUD |
| **Headwind Penalty** | "HEADWIND... -3 KM/H" — wiatr w twarz, kolarz pochylony | Tracking HUD |
| **Rain Starts** | Krople deszczu na HUD, kolarz zakłada kurtkę (sprite `rain_struggle`) | Tracking HUD |
| **Puncture!** | Losowy event przebicia opony, minigra "napraw dętkę" (3 tapy) | Tracking (rzadki) |
| **Wildlife Sighting** | "DEER CROSSING!" — jeleń/sarna przebiega przez ekran (sprite) | Tracking (rzadki, humorystyczny) |
| **Segment PR** | "NEW PR ON [NAZWA]!" — złoty shimmer, sprite `victory` | Segment completion |
| **Group Ride Found** | "3 RIDERS AHEAD — JOIN THEM?" — pobliskie grupki kolarzy | Tracking, City Hub |
| **Bike Wash** | Po jeździe w deszczu: "YOUR BIKE IS DIRTY. WASH IT?" — animacja mycia roweru | Ride Summary |

### 7.7 Ambiente Dźwiękowe (Game SFX)

Dźwięki pixel-art towarzyszące akcjom (generowane proceduralnie, format WAV 8-bit):

| Dźwięk | Opis | Wyzwalacz |
|:-------|:-----|:----------|
| `click_mechanical` | Mechaniczne kliknięcie przycisku | Każdy tap UI |
| `chain_hum` | Cichy szum łańcucha (loop) | Tracking — kadencja moduluje głośność |
| `wind_rush` | Szum wiatru (loop) | Tracking — prędkość moduluje głośność |
| `bell_ring` | Dzwonek rowerowy "dzyń!" | Osiągnięcie kamienia milowego |
| `hub_click` | Kliknięcie tylnej piasty przy jeździe bez pedałowania | Descending |
| `tire_gravel` | Szuranie opon po szutrze | Jazda terenowa |
| `tire_wet` | Syk mokrego asfaltu | Deszcz |
| `brake_squeal` | Pisk hamulców | Gwałtowne hamowanie |
| `gear_shift` | Kliknięcie zmiany biegu | Zmiana prędkości > 5 km/h |
| `bottle_sip` | Łyk z bidonu | Café stop, przerwa |
| `crowd_cheer` | Tłum wiwatuje (pixel-art "beep beep!") | Sprint finish, PB, victory |
| `crash_sound` | "BAM! KLANG!" | Crash event |
| `rain_ambient` | Delikatny deszcz (loop) | Deszczowa pogoda |
| `victory_jingle` | Krótka fanfara 4-nutowa | Achievement, challenge won |

### 7.8 Pełny Inwentarz Assetów (Asset Inventory)

```
assets/generated/
├── sprites/
│   ├── cyclist_idle.png            # 4 klatki, 64x64
│   ├── cyclist_riding_cruise.png   # 6 klatek, 64x64
│   ├── cyclist_riding_tempo.png    # 6 klatek, 64x64
│   ├── cyclist_riding_attack.png   # 4 klatki, 64x64
│   ├── cyclist_climbing_seated.png # 6 klatek, 64x64
│   ├── cyclist_climbing_stand.png  # 4 klatki, 64x64
│   ├── cyclist_descending.png      # 4 klatki, 64x64
│   ├── cyclist_drafting.png        # 6 klatek, 64x64
│   ├── cyclist_victory.png         # 8 klatek, 64x64
│   ├── cyclist_exhausted.png       # 4 klatki, 64x64
│   ├── cyclist_crash.png           # 6 klatek, 64x64
│   ├── cyclist_celebration.png     # 6 klatek, 64x64
│   ├── cyclist_wave.png            # 4 klatki, 64x64
│   ├── cyclist_rain_struggle.png   # 6 klatek, 64x64
│   ├── cyclist_night_ride.png      # 6 klatek, 64x64
│   ├── cyclist_cafe_stop.png       # 4 klatki, 64x64
│   ├── cyclist_bike_service.png    # 8 klatek, 64x64
│   ├── cyclist_packing.png         # 6 klatek, 64x64
│   ├── cyclist_studying_map.png    # 4 klatki, 64x64
│   ├── cyclist_stretching.png      # 6 klatek, 64x64
│   ├── cyclist_taking_photo.png    # 4 klatki, 64x64
│   ├── cyclist_group_ride.png      # 8 klatek, 128x64 (wielopostaciowy)
│   ├── cyclist_podium.png          # 6 klatek, 64x64
│   ├── ghost_sprite.png            # ✅ istniejący
│   ├── runner_sprite.png           # ✅ istniejący
│   ├── elite_sprite.png            # 🔲 do wygenerowania
│   └── cyclist_sheet.png           # ✅ istniejący (spritesheet)
│
├── bikes/
│   ├── bike_road_red.png
│   ├── bike_road_blue.png
│   ├── bike_road_black.png
│   ├── bike_road_white.png
│   ├── bike_gravel_green.png
│   ├── bike_gravel_tan.png
│   ├── bike_mtb_orange.png
│   ├── bike_mtb_gray.png
│   ├── bike_city_cream.png
│   ├── bike_city_mint.png
│   ├── bike_cargo_yellow.png
│   └── bike_cargo_brown.png
│
├── expressions/
│   ├── cyclist_happy.png           # ✅ istniejący
│   ├── cyclist_idle.png            # ✅ istniejący
│   ├── cyclist_tired.png           # ✅ istniejący
│   ├── cyclist_victory.png         # ✅ istniejący
│   ├── cyclist_focused.png         # 🔲 NOWY
│   ├── cyclist_pain.png            # 🔲 NOWY
│   ├── cyclist_surprised.png       # 🔲 NOWY
│   └── cyclist_calm.png            # 🔲 NOWY
│
├── environment/
│   ├── sky_day.png                 # Niebo dzienne (parallax layer 1)
│   ├── sky_sunset.png              # Zachód słońca
│   ├── sky_night.png               # Nocne niebo z gwiazdami
│   ├── mountains_far.png           # Góry dalekie (parallax layer 2)
│   ├── mountains_near.png          # Góry bliskie (parallax layer 3)
│   ├── trees_pine.png              # Las iglasty (parallax element)
│   ├── city_skyline.png            # Panorama miasta (City Hub tło)
│   ├── rain_drop.png               # Pojedyncza kropla deszczu 2x3px
│   ├── snow_flake.png              # Płatek śniegu 4x4px
│   ├── dust_cloud.png              # Chmura kurzu (particle)
│   └── wind_lines.png              # Linie wiatru (particle)
│
├── props/
│   ├── water_bottle.png            # Bidon
│   ├── coffee_cup.png              # Espresso (café stop)
│   ├── bike_tool.png               # Klucz do roweru (service)
│   ├── map_paper.png               # Papierowa mapa
│   ├── camera.png                  # Aparat/telefon (taking photo)
│   ├── trophy_gold.png             # Trofeum złote ✅ istniejący (reward_trophy)
│   ├── trophy_silver.png           # Trofeum srebrne 🔲
│   ├── trophy_bronze.png           # Trofeum brązowe 🔲
│   ├── flag_checkered.png          # Flaga w szachownicę (race finish)
│   ├── bell.png                    # Dzwonek rowerowy
│   └── bike_light.png              # Lampka rowerowa (night ride)
│
├── ui_elements/
│   ├── chain_icon.png              # Ikona łańcucha (Bike Garage)
│   ├── tire_icon.png               # Ikona opony
│   ├── brake_icon.png              # Ikona hamulca
│   ├── gear_icon.png               # Ikona napędu
│   ├── wind_icon.png               # Ikona wiatru (tailwind/headwind)
│   ├── bidon_gauge.png             # Wskaźnik nawodnienia
│   └── sunrise_icon.png            # Ikona wschodu słońca
│
└── textures/
    ├── metal_plate.png              # ✅ istniejący
    ├── wood_grain.png               # ✅ istniejący
    ├── parchment_grain.png          # ✅ istniejący
    ├── carbon_fiber.png             # 🔲 NOWY — włókno węglowe (karty premium)
    ├── asphalt.png                  # 🔲 NOWY — asfalt (tła list)
    └── gravel.png                   # 🔲 NOWY — szuter (tła terenowe)
```

### 7.9 System Animacji Sprite'ów

```typescript
// mobile/src/components/CyclistSprite.tsx — NOWY KOMPONENT

type CyclistState =
  | 'idle' | 'riding_cruise' | 'riding_tempo' | 'riding_attack'
  | 'climbing_seated' | 'climbing_standing' | 'descending'
  | 'drafting' | 'victory' | 'exhausted' | 'crash'
  | 'celebration' | 'wave' | 'rain_struggle' | 'night_ride'
  | 'cafe_stop' | 'bike_service' | 'packing'
  | 'studying_map' | 'stretching' | 'taking_photo'
  | 'group_ride' | 'podium';

type BikeType = 'road' | 'gravel' | 'mtb' | 'city' | 'cargo';

interface CyclistSpriteProps {
  state: CyclistState;
  bikeType?: BikeType;
  expression?: 'happy' | 'idle' | 'tired' | 'victory' | 'focused' | 'pain' | 'surprised' | 'calm';
  size?: number;        // default 64
  fps?: number;         // default 12 (klatki na sekundę)
  loop?: boolean;       // default true
}
```

**Kluczowe zasady animacji:**
- Każdy sprite renderowany przez **Skia** dla wydajności (60 FPS UI, 12 FPS dla sprite sheet)
- Frame switching co ~83ms (12 FPS) dla płynnej animacji pixel-art
- Automatyczny dobór sprite'a na podstawie prędkości / nachylenia / pogody (Tracking HUD)
- Warstwowanie: tło → rower → kolarz → ekspresja (osobne sprite'y komponowane)
- Wszystkie sprite'y mają **czarny obrys 1px** (zasada HD-2D) i **twardy cień 4px**

---

## 8. KONWENCJA NAZEWNICTWA (Garmin/Strava)

### 8.1 Mapowanie Starych Nazw → Nowe Nazwy

| Stara Nazwa (RPG) | Plik | Nowa Nazwa (Garmin/Strava) | Nowy Plik |
|:-------------------|:-----|:----------------------------|:----------|
| `TrackingScreen` | `TrackingScreen.tsx` | **Ride** / **Record** | `RideTrackingScreen.tsx` |
| `ActivitiesScreen` | `ActivitiesScreen.tsx` | **Training Log** | `TrainingLogScreen.tsx` |
| `LeaderboardScreen` | `LeaderboardScreen.tsx` | **City Leaderboard** | `CityLeaderboardScreen.tsx` |
| `RewardsScreen` | `RewardsScreen.tsx` | **Marketplace** | `MarketplaceScreen.tsx` |
| `ProfileScreen` | `ProfileScreen.tsx` | **Athlete Profile** | `AthleteProfileScreen.tsx` |
| `OnboardingScreen` | `OnboardingScreen.tsx` | **Setup** | `SetupScreen.tsx` |

### 8.2 Słownik Terminów

| Termin STITCH | Odpowiednik Garmin/Strava | Kontekst |
|:--------------|:---------------------------|:---------|
| **Ride** | Activity / Ride | Rozpoczęcie jazdy |
| **Record** | Start / Record | Przycisk nagrywania |
| **Training Log** | Training Log / Activities | Historia aktywności |
| **Activity** | Activity / Workout | Pojedyncza aktywność |
| **Performance** | Performance Stats | Statystyki wydajności |
| **Fitness** | Fitness / Training Status | Wskaźnik formy |
| **Training Load** | Training Load | Obciążenie treningowe |
| **Segments** | Segments | Odcinki tras |
| **KOM/QOM** | KOM/QOM (King/Queen of the Mountain) | Król/Królowa segmentu |
| **Squad** | Club / Group | Klub sportowy |
| **Challenge** | Challenge / Competition | Wyzwanie |
| **Leaderboard** | Leaderboard / Rankings | Ranking |
| **Heatmap** | Personal Heatmap | Mapa cieplna |
| **Explore** | Explore / Discover | Odkrywanie tras/miejsc |
| **Checkpoint** | POI / Waypoint | Punkt kontrolny |
| **Marketplace** | Shop / Rewards | Sklep z nagrodami |
| **Connected Devices** | Devices / Sensors | Wearables |
| **Privacy Zones** | Privacy Zones | Strefy prywatności |
| **Solar Mode** | — (unikalne dla SPORT) | Tryb wysokiego kontrastu |
| **City Hub** | — (unikalne dla SPORT) | Panel rywalizacji miasta |
| **City Wars** | — (unikalne dla SPORT) | Ranking między miastami |

### 8.3 Zasady Nazewnictwa

1. **Pierwszeństwo mają terminy z Garmin/Strava** — użytkownicy kolarstwa je znają
2. **Unikalne terminy SPORT** tylko dla funkcji bez odpowiednika (City Hub, City Wars, Solar Mode, Anti-Cheat Grade)
3. **Przyciski i akcje** — czasowniki: "Start Ride", "Save Activity", "Join Club", "Challenge Club"
4. **Zakładki** — rzeczowniki: "Ride", "Train", "Compete", "Explore", "Profile"
5. **Jednostki** — metryczne (km, m, km/h, °C), z opcją imperial w Settings

---

## 9. PLAN WDROŻENIA (Fazy)

### Faza 0: Fundament (istniejący)
- ✅ Tamagui + Skia + Legend-State
- ✅ 5 ekranów bazowych
- ✅ System motywów (Dark/Solar)
- ✅ Komponenty atomowe (ArcadeButton, GameCard, PixelText, etc.)
- ✅ TriggerEngine + AvatarTrainer

### Faza 1: STITCH Core (MVP Redesign)
- 🔲 Refaktor 5 istniejących ekranów do nowego nazewnictwa
- 🔲 **ActivityDetailScreen** — najważniejszy brakujący ekran
- 🔲 **CityHubScreen** — kluczowy dla pozycjonowania vs Aktywne Miasta
- 🔲 **GlobalLeaderboardScreen** — rywalizacja miast
- 🔲 **SettingsScreen** — odciążenie Profile
- 🔲 Nowy Bottom Tab Bar (5 zakładek)

### Faza 2: STITCH Social (Kluby + Społeczność)
- 🔲 **ClubsDirectoryScreen**
- 🔲 **ClubDetailScreen**
- 🔲 **ClubChallengesScreen**
- 🔲 **MyClubsScreen**
- 🔲 **MyChallengesScreen**

### Faza 3: STITCH Explore (Odkrywanie)
- 🔲 **PersonalHeatmapScreen**
- 🔲 **POIMapScreen**
- 🔲 **SegmentsScreen**
- 🔲 **EventsScreen**
- 🔲 Rozbudowa Marketplace

### Faza 4: STITCH Performance (Analityka)
- 🔲 **PerformanceScreen**
- 🔲 **TrainingCalendarScreen**
- 🔲 **MyStatsScreen**
- 🔲 **RideSummaryScreen** (pełne podsumowanie)

### Faza 5: STITCH Effects (Pixel-Art Game Feel)
- 🔲 Silnik cząsteczkowy (ParticleSystem)
- 🔲 Screen shake
- 🔲 CRT scanlines + Chromatic aberration
- 🔲 Dithering dissolve transitions
- 🔲 Paralaksa + Dynamic time-of-day
- 🔲 Weather overlay

### Faza 6: STITCH Premium (Aspiracyjne)
- 🔲 **RoutePlannerScreen**
- 🔲 **NotificationsInboxScreen**
- 🔲 Zaawansowane segmenty (Viterbi matching)
- 🔲 AI-powered insights (LLM Coach)

---

## 10. PODSUMOWANIE — CO NOWEGO WNIESIE STITCH

| Aspekt | Przed STITCH | Po STITCH |
|:-------|:-------------|:----------|
| **Liczba ekranów** | 5 | 18+ |
| **Nawigacja** | 5 zakładek, płaska | 5 zakładek + stack navigatory |
| **Nazewnictwo** | RPG-gaming (QUEST LOG, CHARACTER SHEET) | Branżowe Garmin/Strava + unikalne SPORT |
| **City Competition** | Brak dedykowanego ekranu | CityHub + GlobalLeaderboard + Events |
| **Kluby** | Backend tylko | Pełna obsługa UI (4 ekrany) |
| **Activity Detail** | Nie istnieje | Pełny ekran z mapą, splitami, wykresami |
| **Performance** | Brak | Fitness, Training Load, VO2 Max |
| **Eksploracja** | Tylko sklep | Heatmapa, POI, Segmenty, Trasy |
| **Ustawienia** | Rozsiane po profilu | Dedykowany ekran |
| **Efekty** | Podstawowe (spring, typewriter) | Pełny system pixel-art (cząsteczki, shake, CRT, paralaksa) |
| **Pozycjonowanie** | Generic fitness app | Platforma rywalizacji między miastami |

---

*Dokument stanowi kompletny plan redesignu aplikacji mobilnej SPORT pod kryptonimem STITCH.*  
*Wszystkie nazwy plików, ścieżki i komponenty są zgodne z istniejącą strukturą projektu.*  
*Kolorystyka pominięta zgodnie z założeniami — obowiązuje istniejący system tokenów w `mobile/src/theme/`.*
