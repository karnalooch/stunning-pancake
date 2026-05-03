import React from 'react';
import { View, ViewProps } from 'tamagui';

interface GameCardProps extends ViewProps {
  variant?: 'metal' | 'parchment' | 'dark' | 'hologram';
  borderWidth?: number;
  padding?: number;
  children: React.ReactNode;
}

/**
 * GameCard - The core container component replacing RetroCard.
 * Simulates 9-slice game UI panels using thick borders and specific background colors.
 */
export const GameCard: React.FC<GameCardProps> = ({ 
  variant = 'dark',
  borderWidth = 3,
  padding = 16,
  children,
  ...props 
}) => {
  // Theme colors based on variant
  const themes = {
    dark: { bg: '#0B1D33', border: '#D4A373' },      // Deep sea blue with gold border
    metal: { bg: '#2B303A', border: '#9CA3AF' },     // Industrial gray/metal
    parchment: { bg: '#E2D4B7', border: '#3D3020' }, // Octopath paper/wood
    hologram: { bg: 'rgba(0, 209, 255, 0.15)', border: '#00D1FF' }, // Sci-fi overlay
  };

  const { bg, border } = themes[variant];

  return (
    <View
      backgroundColor={bg}
      borderWidth={borderWidth}
      borderColor={border}
      borderRadius={0} // Always 0 for pixel art
      padding={padding}
      shadowColor="#000000"
      shadowOffset={{ width: 6, height: 6 }}
      shadowOpacity={1}
      shadowRadius={0}
      elevation={8}
      {...props}
    >
      {/* Inner highlight line to simulate 3D inset */}
      <View 
        position="absolute" 
        top={0} left={0} right={0} bottom={0} 
        borderWidth={1} 
        borderColor={variant === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'} 
        pointerEvents="none" 
      />
      {children}
    </View>
  );
};
