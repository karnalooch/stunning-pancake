/**
 * useThemeMode — Reactive Theme Mode Hook
 *
 * Drop-in replacement for direct `ThemeService.themeMode.get()` calls.
 * Returns the current theme mode + toggle/set functions.
 *
 * Replaces the broken @legendapp/state one-shot reads that were previously
 * scattered across components (e.g. AdaptiveAsset.tsx line 12).
 *
 * Usage:
 *   const { themeMode, setThemeMode, toggleThemeMode, isOctopath, isSolar } = useThemeMode();
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
 *
 * Unlike the old `ThemeService.themeMode.get()` (which was a one-shot,
 * non-reactive read from @legendapp/state), this hook causes re-renders
 * when the theme changes and properly integrates with UnistylesRuntime.
 */
export function useThemeMode(): UseThemeModeReturn {
    const { themeMode, setThemeMode } = useThemeContext();
    return { themeMode, setThemeMode };
}
