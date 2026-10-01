import React, {
  createContext, useCallback, useContext, useLayoutEffect, useMemo, useState,
  useSyncExternalStore, type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import { UnistylesRuntime } from './unistyles';
import { grandPrixTheme } from './grandPrix';
import { grandPrixNightTheme } from './grandPrixNight';
import { BrandingService } from '../services/BrandingService';
import { getAppearanceStore } from './appearanceStore';
import { AppearanceStore, type AppearanceSnapshot } from './packs/AppearanceStore';
import { resolveColorMode, resolvePalette, type ColorMode, type ThemePalette } from './packs/themePack';
import { toRuntimeTheme } from './runtimeTheme';

/** Compatibility names for legacy consumers; not user-visible theme IDs. */
export type ThemeMode = 'grandPrix' | 'grandPrixNight';
interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  store: AppearanceStore;
  snapshot: AppearanceSnapshot;
  colorMode: ColorMode;
  palette: ThemePalette;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
interface ThemeProviderProps {
  /** Isolated in-memory selection for tests/fixtures; never overwrites the user's preference. */
  initialTheme?: ThemeMode;
  store?: AppearanceStore;
}
export function ThemeProvider({ children, initialTheme, store: injectedStore }: PropsWithChildren<ThemeProviderProps>) {
  const [store] = useState(() => {
    if (injectedStore) return injectedStore;
    if (!initialTheme) return getAppearanceStore();
    const isolated = new AppearanceStore(null);
    isolated.setPreferences({ themeId: 'roadbook', mode: initialTheme === 'grandPrixNight' ? 'dark' : 'light', highContrast: false });
    return isolated;
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const system = useColorScheme();
  const { preferences } = snapshot;
  const colorMode = resolveColorMode(preferences.mode, system);
  const pack = store.getPack(preferences.themeId);
  const palette = resolvePalette(pack, colorMode, preferences.highContrast);
  const themeMode: ThemeMode = colorMode === 'dark' ? 'grandPrixNight' : 'grandPrix';

  useLayoutEffect(() => {
    UnistylesRuntime.updateTheme('grandPrix', () => toRuntimeTheme(grandPrixTheme, resolvePalette(pack, 'light', preferences.highContrast)));
    UnistylesRuntime.updateTheme('grandPrixNight', () => toRuntimeTheme(grandPrixNightTheme, resolvePalette(pack, 'dark', preferences.highContrast)));
    UnistylesRuntime.setTheme(themeMode);
    refreshBranding();
  }, [pack, preferences.highContrast, themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    store.setPreferences({ ...store.getSnapshot().preferences, mode: mode === 'grandPrixNight' ? 'dark' : 'light' });
  }, [store]);
  const value = useMemo(() => ({ themeMode, setThemeMode, store, snapshot, colorMode, palette }),
    [themeMode, setThemeMode, store, snapshot, colorMode, palette]);
  // Deliberately no theme-dependent key or conditional child tree: never restart a ride to recolour it.
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Theme hooks must be used within ThemeProvider.');
  return context;
}
export const useAppearance = useThemeContext;

/** Preserve branding metadata without mutating exported palettes or overriding validated action roles. */
export function refreshBranding(): void {
  const current = BrandingService.getCurrent();
  const branding = current && /^#[0-9a-fA-F]{6}$/.test(current.primary_color) &&
    /^#[0-9a-fA-F]{6}$/.test(current.secondary_color)
    ? { primary: current.primary_color, secondary: current.secondary_color } : undefined;
  for (const name of ['grandPrix', 'grandPrixNight'] as const) {
    UnistylesRuntime.updateTheme(name, (theme) => ({ ...theme, branding }));
  }
}
