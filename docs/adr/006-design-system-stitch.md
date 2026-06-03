# ADR 006: Hybrid Design System (Stitch Theme)

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |


## Status
Accepted (2026-05-13)

## Context
The project aims for a unique "STITCH" aesthetic: a blend of high-end Solar White/Forest Green modern design with retro pixel-art elements (Arcade buttons, pixel borders).

## Decision
We utilize **React Native Unistyles** as our theme engine.

### Design Principles
- **The "Stitch" Palette**: A base of Solar White (`#f8faf0`) with Forest Green (`#3b6a24`) as the primary action color. 
- **Typography**: 
    - **Space Grotesk**: Used for all UI elements, labels, and titles to provide a modern, high-performance look.
    - **VT323 (Pixel Font)**: Used strictly for real-time metrics on the HUD to reinforce the retro/arcade game aesthetic.
- **HUD Specifics**: A dedicated high-contrast sub-palette (`hudBackground`, `hudMetric`) is used during active tracking. Backgrounds shift to deep greens/blacks (`#0d1b0f`) to maximize readability in outdoor conditions.

### Pixel-Perfect Components
Components like `ArcadeButton` implement a "Pixel Border" logic:
- Double border approach: Inner border for the 3D effect, outer border for the arcade feel.
- Hard shadows: We avoid Gaussian blurs in favor of offset solid color blocks (`#191d17`) to maintain the "Stitch" character.

## Consequences
- **Positive**: Unique brand identity that stands out from generic fitness apps.
- **Positive**: High performace styling engine with support for dynamic theme switching.
- **Constraint**: The "Pixel" aesthetic requires careful testing on high-DPI screens to ensure lines don't look blurry (solved by using pixel-ratio-aware Unistyles scaling).
