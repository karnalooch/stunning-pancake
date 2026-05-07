/**
 * ThemeService — Legacy Theme Management
 *
 * @deprecated Prefer `useThemeMode()` from `@/theme/useThemeMode` for
 * reactive theme access within components. Prefer `<ThemeProvider>`
 * from `@/theme/ThemeProvider` for app-level initialization.
 *
 * This service is maintained for backward compatibility during the
 * Phase 1–2 migration from Tamagui to Unistyles. It now delegates
 * theme switching to UnistylesRuntime so that both the old observable
 * and the new Unistyles system stay in sync.
 *
 * Existing consumers:
 * - `AdaptiveAsset.tsx` uses `ThemeService.themeMode.get()` (one-shot read)
 * - Various screens import `toggleTheme` / `setTheme`
 *
 * These will be migrated to `useThemeMode()` in Phase 3.
 */

import { observable } from '@legendapp/state';
import { MMKV } from 'react-native-mmkv';
import { UnistylesRuntime } from 'react-native-unistyles';

const THEME_STORAGE_KEY = 'theme_mode';

// Lazy MMKV initialization to prevent JSI "Runtime not ready" crash
let _storage: MMKV | null = null;
function getStorage(): MMKV | null {
  if (_storage) return _storage;
  try {
    _storage = new MMKV();
    return _storage;
  } catch (e) {
    console.error('[ThemeService] MMKV init failed, falling back to defaults.', e);
    return null;
  }
}

export type ThemeMode = 'stitch';

// Initialize with stored value or default to 'octopath'
function getInitialTheme(): ThemeMode {
  const storage = getStorage();
  if (!storage) return 'octopath';
  return (storage.getString(THEME_STORAGE_KEY) as ThemeMode) || 'octopath';
}

/**
 * @deprecated Use `useThemeMode()` from `@/theme/useThemeMode` instead.
 * This service is kept for backward compatibility during the
 * Tamagui → Unistyles migration (Phase 1–2).
 *
 * The `themeMode` observable remains functional and is synced with
 * UnistylesRuntime so that both legacy and new code see the same theme.
 */
export const ThemeService = {
  themeMode: observable<ThemeMode>(getInitialTheme()),

  /**
   * @deprecated Use `toggleThemeMode()` from `useThemeMode()` instead.
   */
  toggleTheme: () => {
    const current = ThemeService.themeMode.get();
    const next = current === 'octopath' ? 'solar' : 'octopath';
    ThemeService.themeMode.set(next);
    // Sync with Unistyles runtime (new system)
    try { UnistylesRuntime.setTheme(next); } catch (_) { /* Unistyles may not be initialized yet */ }
    const storage = getStorage();
    if (storage) storage.set(THEME_STORAGE_KEY, next);
  },

  /**
   * @deprecated Use `setThemeMode(mode)` from `useThemeMode()` instead.
   */
  setTheme: (theme: ThemeMode) => {
    ThemeService.themeMode.set(theme);
    // Sync with Unistyles runtime (new system)
    try { UnistylesRuntime.setTheme(theme); } catch (_) { /* Unistyles may not be initialized yet */ }
    const storage = getStorage();
    if (storage) storage.set(THEME_STORAGE_KEY, theme);
  },
};
