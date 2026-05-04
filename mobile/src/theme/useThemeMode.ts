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
    /** Current theme mode ('octopath' | 'solar') */
    themeMode: ThemeMode;
    /** Set a specific theme mode */
    setThemeMode: (mode: ThemeMode) => void;
    /** Toggle between octopath ↔ solar */
    toggleThemeMode: () => void;
    /** True when dark theme (octopath) is active */
    isOctopath: boolean;
    /** True when light theme (solar) is active */
    isSolar: boolean;
}

/**
 * Reactive hook for reading/writing the current theme mode.
 *
 * Unlike the old `ThemeService.themeMode.get()` (which was a one-shot,
 * non-reactive read from @legendapp/state), this hook causes re-renders
 * when the theme changes and properly integrates with UnistylesRuntime.
 */
export function useThemeMode(): UseThemeModeReturn {
    return useThemeContext();
}
