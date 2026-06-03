/**
 * Stitch Theme — STITCH Solar White + Forest Green palette
 *
 * This is the PRIMARY visual theme for the SPORT mobile app.
 * Supersedes octopath (dark) and solar (light) themes.
 * 
 * All color tokens are sourced from docs/archive/designmobile.md §2 Color Palette.
 * Typography: Space Grotesk (primary) + VT323 (HUD metrics only).
 */

import type { StitchTheme } from './unistyles';

export const stitchTheme: StitchTheme = {
    colors: {
        // ── Core Palette ──────────────────────────────────────────
        background: '#f8faf0',
        surface: '#f8faf0',
        onBackground: '#191d17',
        onSurface: '#191d17',

        // ── Primary (Forest Green) ─────────────────────────────────
        primary: '#3b6a24',
        primaryContainer: '#76a95b',
        primaryFixed: '#bbf29b',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#191d17',
        onPrimaryFixed: '#072100',

        // ── Secondary ─────────────────────────────────────────────
        secondary: '#5e604d',
        secondaryContainer: '#e1e1c9',
        secondaryFixed: '#e4e4cc',
        onSecondary: '#ffffff',
        onSecondaryContainer: '#636451',

        // ── Tertiary (Red/Warning) ─────────────────────────────────
        tertiary: '#a13d3e',
        tertiaryContainer: '#ee7876',
        tertiaryFixed: '#ffdad8',
        onTertiary: '#ffffff',
        onTertiaryContainer: '#661117',

        // ── Error ─────────────────────────────────────────────────
        error: '#ba1a1a',
        errorContainer: '#ffdad6',
        onError: '#ffffff',
        onErrorContainer: '#93000a',

        // ── Surface Containers (Elevation) ─────────────────────────
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f3f5eb',
        surfaceContainer: '#edefe5',
        surfaceContainerHigh: '#e7e9df',
        surfaceContainerHighest: '#e1e3da',

        // ── Outline & Borders ──────────────────────────────────────
        outline: '#72796b',
        outlineVariant: '#c2c9b9',

        // ── Special ────────────────────────────────────────────────
        parchment: '#F5F5DC',
        goldAmber: '#FFB800',
        hudBackground: '#0d1b0f',
        hudSurface: '#162818',
        hudText: '#e0f0d8',
        hudMetric: '#bbf29b',
        hudAccent: '#76a95b',
        hudWarning: '#ee7876',
        hudError: '#ba1a1a',
    },
};
