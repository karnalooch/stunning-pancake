/**
 * Unistyles Theme Definitions
 *
 * Primary theme: `grandPrix` (Grand Prix palette runtime contract).
 */

// ─── Grand Prix Theme (flat, standalone palette) ───────────────────

export interface GrandPrixTheme {
    colors: {
        background: string;
        surface: string;
        onBackground: string;
        onSurface: string;
        primary: string;
        primaryContainer: string;
        primaryFixed: string;
        onPrimary: string;
        onPrimaryContainer: string;
        onPrimaryFixed: string;
        secondary: string;
        secondaryContainer: string;
        secondaryFixed: string;
        onSecondary: string;
        onSecondaryContainer: string;
        tertiary: string;
        tertiaryContainer: string;
        tertiaryFixed: string;
        onTertiary: string;
        onTertiaryContainer: string;
        error: string;
        errorContainer: string;
        onError: string;
        onErrorContainer: string;
        surfaceContainerLowest: string;
        surfaceContainerLow: string;
        surfaceContainer: string;
        surfaceContainerHigh: string;
        surfaceContainerHighest: string;
        outline: string;
        outlineVariant: string;
        parchment: string;
        goldAmber: string;
        hudBackground: string;
        hudSurface: string;
        hudText: string;
        hudMetric: string;
        hudAccent: string;
        hudWarning: string;
        hudError: string;
        hudPanel: string;
        hudPanelNight: string;
        hudOutline: string;
        hudShadow: string;
        scrimStrong: string;
        scrimSoft: string;
        sceneOverlay: string;
        sceneSky: string;
        sceneHill: string;
        sceneRoad: string;
        gpDeepSea: string;
        gpGoldLight: string;
        gpForestGreen: string;
        gpSepia: string;
        chromeNightBg: string;
        chromeNightSurface: string;
        chromeNightInk: string;
        zone1: string;
        zone2: string;
        zone3: string;
        zone4: string;
        zone5: string;
        rival: string;
    };
    branding?: {
        primary: string;
        secondary: string;
    };
}

// ─── Augment UnistylesThemes for global type safety ───────────────

declare module 'react-native-unistyles' {
    interface UnistylesThemes {
        grandPrix: GrandPrixTheme;
        grandPrixNight: GrandPrixTheme;
    }
}

// ─── Re-exports from react-native-unistyles ───────────────────────

export {
    StyleSheet,
    UnistylesRuntime,
    StatusBar,
    NavigationBar,
    UnistyleDependency,
    mq,
    withUnistyles,
    useUnistyles,
    createUnistylesElement,
    Display,
    Hide,
    ScopedTheme,
    useServerUnistyles,
    hydrateServerUnistyles,
    getServerUnistyles,
    resetServerUnistyles,
} from 'react-native-unistyles';

export type {
    UnistylesThemes,
    UnistylesBreakpoints,
    UnistylesVariants,
    UnistylesValues,
    IOSContentSizeCategory,
    AndroidContentSizeCategory,
} from 'react-native-unistyles';
