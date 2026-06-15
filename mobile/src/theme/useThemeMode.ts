/**
 * useThemeMode — Reactive Theme Mode Hook
 *
 * React hook for reading and switching the active theme mode.
 * Returns the current theme mode + toggle/set functions.
 *
 * Replaces the broken @legendapp/state one-shot reads that were previously
 * scattered across components (e.g. AdaptiveAsset.tsx line 12).
 *
 * Usage:
 *   const { themeMode, setThemeMode } = useThemeMode();
 */

import { useThemeContext, type ThemeMode } from './ThemeProvider';

export type { ThemeMode } from './ThemeProvider';

export interface UseThemeModeReturn {
    /** Current theme mode */
    themeMode: ThemeMode;
    /** Set a specific theme mode */
    setThemeMode: (mode: ThemeMode) => void;
}

/**
 * Reactive hook for reading/writing the current theme mode.
 * Causes re-renders when the theme changes and syncs with UnistylesRuntime.
 */
export function useThemeMode(): UseThemeModeReturn {
    const { themeMode, setThemeMode } = useThemeContext();
    return { themeMode, setThemeMode };
}
