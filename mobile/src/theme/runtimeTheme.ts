import type { GrandPrixTheme } from './unistyles';
import type { ThemePalette } from './packs/themePack';

/** Temporary key adapter, not visual authority. Remove with the final legacy consumer in #418. */
export function toRuntimeTheme(base: GrandPrixTheme, p: ThemePalette): GrandPrixTheme {
  const colors = {
    ...base.colors,
    product: p,
    background: p.canvas, surface: p.surface, onBackground: p.text, onSurface: p.text,
    primary: p.success, primaryContainer: p.raised, primaryFixed: p.raised,
    onPrimary: p.surface, onPrimaryContainer: p.text, onPrimaryFixed: p.text,
    secondary: p.muted, secondaryContainer: p.raised, secondaryFixed: p.raised,
    onSecondary: p.surface, onSecondaryContainer: p.text,
    tertiary: p.muted, tertiaryContainer: p.raised, tertiaryFixed: p.raised,
    onTertiary: p.surface, onTertiaryContainer: p.text,
    error: p.error, errorContainer: p.raised, onError: p.onError, onErrorContainer: p.error,
    surfaceContainerLowest: p.surface, surfaceContainerLow: p.surface,
    surfaceContainer: p.raised, surfaceContainerHigh: p.raised, surfaceContainerHighest: p.raised,
    outline: p.border, outlineVariant: p.border, parchment: p.canvas, goldAmber: p.action,
    cta: p.action, ctaDark: p.actionPressed, onCta: p.onAction,
    selection: p.action, selectionBorder: p.action, onSelection: p.onAction,
    disabledSurface: p.raised, disabledDark: p.raised, onDisabled: p.muted,
    hudBackground: p.canvas, hudSurface: p.surface, hudText: p.text, hudMetric: p.text,
    hudAccent: p.action, hudWarning: p.warning, hudError: p.error,
    hudPanel: p.surface, hudPanelNight: p.surface, hudOutline: p.border,
    gpDeepSea: p.surface, gpGoldLight: p.muted, gpForestGreen: p.success, gpSepia: p.muted,
    chromeNightBg: p.canvas, chromeNightSurface: p.surface, chromeNightInk: p.text,
  };
  return { ...base, colors };
}
