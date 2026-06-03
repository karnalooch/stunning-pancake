# ADR 002: Unistyles v3 Initialization & Hook Migration

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
During the mobile application boot sequence, a critical crash was encountered: `[TypeError: 0, _reactNativeUnistyles.useStyles is not a function]` and `[Error: Unistyles: One of your stylesheets is trying to get the theme, but no theme has been selected yet.]`. 
This issue was caused by two compounding factors:
1. **ES Module Hoisting**: Module-level `StyleSheet.create(...)` calls in screen components were evaluated during the import phase, *before* `StyleSheet.configure()` could be executed inside the main component file.
2. **Unistyles v3 Breaking Changes**: The `react-native-unistyles` library was upgraded to v3, which completely removed the `useStyles` hook in favor of `useUnistyles` and changed how `StyleSheet.create` interacts with components.

## Decision
1. **Bootstrap Isolation**: We extracted `StyleSheet.configure()` into a dedicated setup file (`src/theme/unistylesSetup.ts`). This file is imported as a side-effect at the very top of `index.ts` (`import './src/theme/unistylesSetup';`), guaranteeing it runs before any component trees or module-level stylesheets are evaluated by the Metro bundler.
2. **API Migration**: We migrated all UI components and screens from the deprecated Unistyles v2 API to the v3 API. 
   - Replaced `useStyles(stylesheet)` with `useUnistyles()`.
   - Access the stylesheet directly instead of through the hook's return object.

## Consequences
- **Positive**: Complete elimination of startup styling crashes. The React Native bundle initializes deterministically.
- **Positive**: Alignment with the latest version of `react-native-unistyles` (v3+), supporting future features and React 19 / Fabric architecture compatibility.
- **Negative / Constraint**: Developers must remember *not* to place `StyleSheet.configure()` inside standard component lifecycles. It must strictly remain in the isolated setup file.

## Usage Pattern (v3)
```tsx
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const stylesheet = StyleSheet.create(theme => ({
    container: { backgroundColor: theme.colors.background }
}));

export const MyComponent = () => {
    // Only access theme/runtime if needed. Styles are attached directly to the stylesheet object.
    const { theme } = useUnistyles(); 
    return <View style={stylesheet.container} />;
};
```
