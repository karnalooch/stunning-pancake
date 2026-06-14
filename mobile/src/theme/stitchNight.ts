import type { StitchTheme } from './unistyles';
import { stitchTheme } from './stitch';

/** Night chrome — gpDeepSea family for engagement screens (not HUD). */
export const stitchNightTheme: StitchTheme = {
  ...stitchTheme,
  colors: {
    ...stitchTheme.colors,
    background: stitchTheme.colors.chromeNightBg,
    surface: stitchTheme.colors.chromeNightSurface,
    onBackground: stitchTheme.colors.chromeNightInk,
    onSurface: stitchTheme.colors.chromeNightInk,
    surfaceContainerLow: stitchTheme.colors.chromeNightBg,
    surfaceContainer: stitchTheme.colors.chromeNightSurface,
    surfaceContainerHigh: '#1A3248',
    surfaceContainerHighest: '#223A52',
    parchment: '#1A3248',
    secondary: '#C8B098',
    outline: '#7BA8B8',
    primaryContainer: '#2A4A32',
    onPrimaryContainer: stitchTheme.colors.chromeNightInk,
  },
};
