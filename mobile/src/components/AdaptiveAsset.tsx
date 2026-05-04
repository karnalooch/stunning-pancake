import React from 'react';
import { observer } from '@legendapp/state/react';
import { ThemeService } from '../services/ThemeService';
import { UnistylesRuntime } from '../theme/unistyles';
import { colors as tokens } from '@tokens/generated/restyle-colors';

export const useAdaptiveTheme = () => {
  const themeMode = (UnistylesRuntime.themeName as 'octopath' | 'solar') ?? ThemeService.themeMode.get() ?? 'octopath';
  const t = themeMode === 'octopath' ? tokens.octopath : tokens.solar;

  return {
    themeMode,
    isSolar: themeMode === 'solar',
    primary: tokens.semantic.primary,
    accent: tokens.semantic.secondary,
    background: t.background,
    color: t.text,
    outlineColor: '#000000',
    borderWidth: 1,
  };
};

interface AdaptiveIconProps {
  icon: React.ElementType;
  size?: number;
  color?: string;
  strokeWidth?: number;
  [key: string]: any;
}

export const AdaptiveIcon = observer(({
  icon: Icon,
  size = 24,
  color,
  strokeWidth = 2,
  ...props
}: AdaptiveIconProps) => {
  const { themeMode, accent, primary, color: textColor } = useAdaptiveTheme();
  const finalColor = color || (themeMode === 'solar' ? accent : primary);

  return (
    <Icon
      size={size}
      color={finalColor}
      strokeWidth={themeMode === 'solar' ? 2.5 : strokeWidth}
      {...props}
    />
  );
});
