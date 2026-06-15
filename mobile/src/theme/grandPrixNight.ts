import type { GrandPrixTheme } from './unistyles';
import { grandPrixTheme } from './grandPrix';

/** Night chrome — gpDeepSea family for engagement screens (not HUD). */
export const grandPrixNightTheme: GrandPrixTheme = {
  ...grandPrixTheme,
  colors: {
    ...grandPrixTheme.colors,
    background: grandPrixTheme.colors.chromeNightBg,
    surface: grandPrixTheme.colors.chromeNightSurface,
    onBackground: grandPrixTheme.colors.chromeNightInk,
    onSurface: grandPrixTheme.colors.chromeNightInk,
    surfaceContainerLow: grandPrixTheme.colors.chromeNightBg,
    surfaceContainer: grandPrixTheme.colors.chromeNightSurface,
    surfaceContainerHigh: '#1A3248',
    surfaceContainerHighest: '#223A52',
    parchment: '#1A3248',
    secondary: '#C8B098',
    outline: '#7BA8B8',
    primaryContainer: '#2A4A32',
    onPrimaryContainer: grandPrixTheme.colors.chromeNightInk,
  },
};

