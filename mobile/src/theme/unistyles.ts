/**
 * Unistyles Theme Definitions
 *
 * This module defines the AppTheme interface for type-safe theming
 * using react-native-unistyles. All color tokens are sourced from
 * @tokens/generated/restyle-colors, which is auto-generated from
 * shared/tokens/colors.json.
 *
 * Theme names (octopath, solar) are registered via TypeScript
 * declaration merging with UnistylesThemes.
 */

import type { colors as tokenColors } from '@tokens/generated/restyle-colors';

// ─── Color Token Types ────────────────────────────────────────────

/** Primitive color palette (20 raw values) */
export type PrimitiveColors = typeof tokenColors.primitive;

/** Semantic color aliases (6 functional colors) */
export type SemanticColors = typeof tokenColors.semantic;

/** Octopath (dark) theme-specific colors (27 tokens) */
export type OctopathColors = typeof tokenColors.octopath;

/** Solar (light) theme-specific colors (27 tokens) */
export type SolarColors = typeof tokenColors.solar;

// ─── AppTheme Interface ───────────────────────────────────────────

/**
 * The complete theme shape consumed by Unistyles.
 *
 * Each theme (octopath / solar) must satisfy this interface.
 * The `colors` object carries all token groups for full
 * type safety when using `useStyles()` or `useUnistyles()`.
 */
export interface AppTheme {
    colors: {
        /** 20 primitive color values */
        primitive: PrimitiveColors;
        /** 6 semantic (functional) colors */
        semantic: SemanticColors;
        /** 27 octopath (dark) theme colors */
        octopath: OctopathColors;
        /** 27 solar (light) theme colors */
        solar: SolarColors;
    };
    branding?: {
        primary: string;
        secondary: string;
        background?: string;
        surface?: string;
        text?: string;
        border?: string;
    };
}

// ─── Stitch Theme (flat, standalone palette) ──────────────────────

export interface StitchTheme {
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
    };
    branding?: {
        primary: string;
        secondary: string;
    };
}

// ─── Augment UnistylesThemes for global type safety ───────────────

declare module 'react-native-unistyles' {
    interface UnistylesThemes {
        octopath: AppTheme;
        solar: AppTheme;
        stitch: StitchTheme;
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
