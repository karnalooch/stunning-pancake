/**
 * Grand Prix Theme — single runtime visual contract for mobile.
 *
 * This file is the authoritative theme object used by Unistyles.
 */

import type { GrandPrixTheme } from './unistyles';

export const grandPrixTheme: GrandPrixTheme = {
    colors: {
        // ── Core Palette (chrome tints from Grand Prix anchors) ───
        background: '#FBF3E2',
        surface: '#F5E6CC',
        onBackground: '#0B1D33',
        onSurface: '#0B1D33',

        // ── Primary (Forest Green) ─────────────────────────────────
        primary: '#3b6a24',
        primaryContainer: '#76a95b',
        primaryFixed: '#bbf29b',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#0B1D33',
        onPrimaryFixed: '#072100',

        // ── Secondary (readable on parchment, WCAG AA) ─────────────
        secondary: '#5A4A38',
        secondaryContainer: '#EAD6B8',
        secondaryFixed: '#e4e4cc',
        onSecondary: '#ffffff',
        onSecondaryContainer: '#5A4A38',

        // ── Tertiary / rival (deep teal — not error red) ───────────
        tertiary: '#1F4E5F',
        tertiaryContainer: '#7BA8B8',
        tertiaryFixed: '#D4E8EE',
        onTertiary: '#ffffff',
        onTertiaryContainer: '#0B1D33',

        // ── Error ─────────────────────────────────────────────────
        error: '#ba1a1a',
        errorContainer: '#ffdad6',
        onError: '#ffffff',
        onErrorContainer: '#93000a',

        // ── Surface Containers (Elevation) ─────────────────────────
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#FBF3E2',
        surfaceContainer: '#F5E6CC',
        surfaceContainerHigh: '#EAD6B8',
        surfaceContainerHighest: '#E0CFA8',

        // ── Outline & Borders (WCAG AA on parchment) ───────────────
        outline: '#6B5844',
        outlineVariant: '#C2B59A',

        // ── Special (aligned to Grand Prix anchors §4) ─────────────
        parchment: '#F5E6CC',
        goldAmber: '#D4A373',
        hudBackground: '#0d1b0f',
        hudSurface: '#162818',
        hudText: '#e0f0d8',
        hudMetric: '#bbf29b',
        hudAccent: '#76a95b',
        hudWarning: '#ee7876',
        hudError: '#ba1a1a',

        // ── HUD chrome (sun-readable bike computer, ADR 014 §3) ────
        hudPanel: '#F5E6CC',
        hudPanelNight: '#0B1D33',
        hudOutline: '#0B1D33',
        hudShadow: 'rgba(11, 29, 51, 0.45)',

        // ── Scene / scrim (ADR 014) ───────────────────────────────
        scrimStrong: 'rgba(11, 29, 51, 0.55)',
        scrimSoft: 'rgba(11, 29, 51, 0.28)',
        sceneOverlay: 'rgba(251, 243, 226, 0.72)',
        sceneSky: '#B8D4E8',
        sceneHill: '#7BA05B',
        sceneRoad: '#C8B098',

        // ── Grand Prix palette anchors (scene role — saturated) ────
        gpDeepSea: '#0B1D33',
        gpGoldLight: '#EDD9B0',
        gpForestGreen: '#7BA05B',
        gpSepia: '#C8B098',

        // ── Engagement night chrome (DS §3 / §8) ───────────────────
        chromeNightBg: '#0B1D33',
        chromeNightSurface: '#14283C',
        chromeNightInk: '#EDD9B0',

        // ── HR / power zones (DS §3) ───────────────────────────────
        zone1: '#7BA05B',
        zone2: '#D4A373',
        zone3: '#E8A838',
        zone4: '#C45C26',
        zone5: '#BA1A1A',
        rival: '#1F4E5F',
    },
};

