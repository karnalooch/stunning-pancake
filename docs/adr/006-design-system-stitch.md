# ADR 006: Hybrid Design System (Stitch Theme)

## Status
Accepted (2026-05-13)

## Context
The project aims for a unique "STITCH" aesthetic: a blend of high-end Solar White/Forest Green modern design with retro pixel-art elements (Arcade buttons, pixel borders).

## Decision
We utilize **React Native Unistyles** as our theme engine.
- **Design Tokens**: All colors and spacing are centralized in `src/theme/stitch.ts`.
- **Hybrid Components**: We build custom components like `ArcadeButton` and `PixelText` that consume the theme tokens but apply unique retro styling logic (e.g., hard shadows, pixel-perfect borders).
- **HUD Specifics**: A dedicated sub-palette (`hudBackground`, `hudMetric`) is defined for the active tracking screens to ensure high contrast and readability under direct sunlight.

## Consequences
- **Positive**: Unique brand identity that stands out from generic fitness apps.
- **Positive**: High performace styling engine with support for dynamic theme switching (future dark mode).
- **Constraint**: Custom retro components require more manual styling effort compared to using a standard library like NativePaper.
