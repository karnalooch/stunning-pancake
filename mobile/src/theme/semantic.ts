import type { GrandPrixTheme } from './unistyles';

type RawColors = GrandPrixTheme['colors'];

export interface SemanticColors {
  canvas: { background: string };
  surface: {
    default: string;
    raised: string;
    interactive: string;
    selected: string;
  };
  text: {
    primary: string;
    secondary: string;
    onAction: string;
    onDestructive: string;
  };
  border: {
    subtle: string;
    strong: string;
    selected: string;
  };
  action: {
    primary: string;
    primaryPressed: string;
    secondary: string;
    destructive: string;
    disabled: string;
  };
  navigation: {
    shell: string;
    active: string;
    inactive: string;
  };
  selection: {
    active: string;
    background: string;
    border: string;
    content: string;
  };
  progress: { primary: string };
  status: {
    success: string;
    warning: string;
    error: string;
    offline: string;
  };
  ride: {
    gpsLocked: string;
    stopAction: string;
  };
}

/**
 * Frozen UI v1.2 semantic colour roles.
 *
 * New product UI consumes these roles rather than choosing raw palette entries.
 * The compatibility palette remains available while legacy screens migrate.
 */
export function getSemanticColors(colors: RawColors): SemanticColors {
  return {
    canvas: {
      background: colors.background,
    },
    surface: {
      default: colors.surfaceContainerLowest,
      raised: colors.surfaceContainerLow,
      interactive: colors.surfaceContainer,
      selected: colors.surfaceContainerHigh,
    },
    text: {
      primary: colors.onBackground,
      secondary: colors.secondary,
      onAction: colors.onCta,
      onDestructive: colors.onError,
    },
    border: {
      subtle: colors.outlineVariant,
      strong: colors.outline,
      selected: colors.goldAmber,
    },
    action: {
      primary: colors.cta,
      primaryPressed: colors.ctaDark,
      secondary: colors.surfaceContainerLowest,
      destructive: colors.error,
      disabled: colors.disabledSurface,
    },
    navigation: {
      shell: colors.gpDeepSea,
      active: colors.goldAmber,
      inactive: colors.gpGoldLight,
    },
    selection: {
      active: colors.goldAmber,
      background: colors.surfaceContainerHigh,
      border: colors.goldAmber,
      content: colors.onBackground,
    },
    progress: {
      primary: colors.goldAmber,
    },
    status: {
      success: colors.primary,
      warning: colors.goldAmber,
      error: colors.error,
      offline: colors.tertiary,
    },
    ride: {
      gpsLocked: colors.primary,
      stopAction: colors.error,
    },
  };
}
