import type { GrandPrixTheme } from './unistyles';
import type { ThemePalette } from './packs/themePack';

type RawColors = GrandPrixTheme['colors'] & { product?: ThemePalette };
export interface SemanticColors {
  canvas: { background: string };
  surface: { default: string; raised: string; interactive: string; selected: string };
  text: { primary: string; secondary: string; onAction: string; onDestructive: string };
  border: { subtle: string; strong: string; selected: string };
  action: { primary: string; primaryPressed: string; secondary: string; destructive: string; disabled: string };
  navigation: { shell: string; active: string; inactive: string };
  selection: { active: string; background: string; border: string; content: string };
  progress: { primary: string };
  status: { success: string; warning: string; error: string; offline: string };
  ride: { gpsLocked: string; stopAction: string };
}
/** Theme-pack roles are authoritative; old palettes remain a migration/test compatibility input. */
export function getSemanticColors(colors: RawColors): SemanticColors {
  const p = colors.product;
  if (p) return {
    canvas: { background: p.canvas },
    surface: { default: p.surface, raised: p.raised, interactive: p.surface, selected: p.raised },
    text: { primary: p.text, secondary: p.muted, onAction: p.onAction, onDestructive: p.onError },
    border: { subtle: p.border, strong: p.border, selected: p.action },
    action: { primary: p.action, primaryPressed: p.actionPressed, secondary: p.surface, destructive: p.error, disabled: p.raised },
    navigation: { shell: p.surface, active: p.action, inactive: p.muted },
    selection: { active: p.action, background: p.raised, border: p.action, content: p.text },
    progress: { primary: p.action },
    status: { success: p.success, warning: p.warning, error: p.error, offline: p.muted },
    ride: { gpsLocked: p.success, stopAction: p.error },
  };
  return {
    canvas: { background: colors.background },
    surface: { default: colors.surfaceContainerLowest, raised: colors.surfaceContainerLow,
      interactive: colors.surfaceContainer, selected: colors.surfaceContainerHigh },
    text: { primary: colors.onBackground, secondary: colors.secondary, onAction: colors.onCta, onDestructive: colors.onError },
    border: { subtle: colors.outlineVariant, strong: colors.outline, selected: colors.goldAmber },
    action: { primary: colors.cta, primaryPressed: colors.ctaDark, secondary: colors.surfaceContainerLowest,
      destructive: colors.error, disabled: colors.disabledSurface },
    navigation: { shell: colors.gpDeepSea, active: colors.goldAmber, inactive: colors.gpGoldLight },
    selection: { active: colors.goldAmber, background: colors.surfaceContainerHigh,
      border: colors.goldAmber, content: colors.onBackground },
    progress: { primary: colors.goldAmber },
    status: { success: colors.primary, warning: colors.goldAmber, error: colors.error, offline: colors.tertiary },
    ride: { gpsLocked: colors.primary, stopAction: colors.error },
  };
}
