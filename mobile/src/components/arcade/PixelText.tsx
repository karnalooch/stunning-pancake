import React from 'react';
import { Text, TextProps } from 'tamagui';

interface PixelTextProps extends TextProps {
  color?: string;
  size?: number;
  shadow?: boolean;
}

/**
 * PixelText - Base typography component for the entire app.
 * Enforces the "Press Start 2P" font and handles arcade-style drop shadows.
 */
export const PixelText: React.FC<PixelTextProps> = ({ 
  color = '#F5E6CC', // Default Octopath parchment color
  size = 12, 
  shadow = false,
  children,
  ...props 
}) => {
  return (
    <Text
      fontFamily="$pixel"
      color={color}
      fontSize={size}
      textShadowColor={shadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent'}
      textShadowOffset={shadow ? { width: 2, height: 2 } : { width: 0, height: 0 }}
      textShadowRadius={0} // Hard shadow for pixel art
      {...props}
    >
      {children}
    </Text>
  );
};
