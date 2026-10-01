/** Must remain the first entrypoint import: configure before any StyleSheet.create(). */
import { Appearance } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { grandPrixTheme } from './grandPrix';
import { grandPrixNightTheme } from './grandPrixNight';
import { getAppearanceStore } from './appearanceStore';
import { resolveColorMode, resolvePalette } from './packs/themePack';
import { toRuntimeTheme } from './runtimeTheme';

const store = getAppearanceStore();
const { preferences } = store.getSnapshot();
const pack = store.getPack(preferences.themeId);
const mode = resolveColorMode(preferences.mode, Appearance.getColorScheme());

// Runtime names are compatibility aliases only; pack identity is independent of them.
StyleSheet.configure({
  settings: { initialTheme: mode === 'dark' ? 'grandPrixNight' : 'grandPrix' },
  themes: {
    grandPrix: toRuntimeTheme(grandPrixTheme, resolvePalette(pack, 'light', preferences.highContrast)),
    grandPrixNight: toRuntimeTheme(grandPrixNightTheme, resolvePalette(pack, 'dark', preferences.highContrast)),
  },
});
