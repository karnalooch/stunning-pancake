import React from 'react';
import { useTheme } from 'tamagui';
import { observer } from '@legendapp/state/react';
import { ThemeService } from '../services/ThemeService';

/**
 * Hook to get theme-aware colors for SVGs and other assets
 * that might not automatically follow Tamagui theme tokens
 */
export const useAdaptiveTheme = () => {
  const theme = useTheme();
  const themeMode = ThemeService.themeMode.get();

  return {
    themeMode,
    isSolar: themeMode === 'solar',
    // High contrast black for solar, Matrix Cyan or Gold for dark
    primary: theme.primary.get(),
    // High contrast Red for solar, Matrix Cyan for dark
    accent: theme.accent.get(),
    background: theme.background.get(),
    color: theme.color.get(),
    // Specific HD2D styling
    outlineColor: themeMode === 'solar' ? '#000000' : '#000000',
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

/**
 * A wrapper for icons (Lucide or custom SVG) that applies
 * theme-aware colors and styling automatically.
 */
export const AdaptiveIcon = observer(({ 
  icon: Icon, 
  size = 24, 
  color, 
  strokeWidth = 2,
  ...props 
}: AdaptiveIconProps) => {
  const { themeMode, accent, primary, color: textColor } = useAdaptiveTheme();
  
  // Logic for color if not explicitly provided
  // In solar mode we might prefer black or high-contrast red
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
