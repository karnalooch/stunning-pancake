import React from 'react';
import { Button, ButtonProps, Text, useTheme } from 'tamagui';
import * as Haptics from 'expo-haptics';

export interface HD2DButtonProps extends ButtonProps {
  label?: string;
}

/**
 * HD2DButton: A retro-style button with 1px outline and hard shadows.
 * Implements the Phase 3 HD-2D aesthetic.
 * Optimized with React.memo and ensuring 44x44 minimum touch target.
 */
export const HD2DButton: React.FC<HD2DButtonProps> = React.memo(({ children, label, onPress, ...props }) => {
  const theme = useTheme();

  const handlePress = (e: any) => {
    // Integrate expo-haptics (ImpactLight) on press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore errors if haptics are not available
    });
    
    if (onPress) {
      onPress(e);
    }
  };

  return (
    <Button
      {...props}
      onPress={handlePress}
      // Accessibility: Ensure minimum touch target size
      minHeight={44}
      minWidth={44}
      
      // Apply 1px black outline (Theme.colors.outline or hardcoded if not in theme)
      borderWidth={1}
      borderColor="$hd2d.outlineColor"
      borderRadius={0} // Radius 0 for pixel look
      backgroundColor="$primary"
      
      // Implement hard shadow (4px offset, no blur)
      shadowColor="#000000"
      shadowOffset={{ width: 4, height: 4 }}
      shadowOpacity={1}
      shadowRadius={0}
      
      // Elevation for Android to support the hard shadow look
      elevation={4}

      pressStyle={{
        backgroundColor: '$primary',
        opacity: 0.9,
        scale: 0.97,
        shadowOffset: { width: 2, height: 2 },
        ...props.pressStyle,
      }}
    >
      {/* Use 'Press Start 2P' font for labels (mapped to $pixel in config) */}
      <Text 
        fontFamily="$pixel" 
        fontSize={12} 
        color={theme.background.get()} // Contrast with primary
        textAlign="center"
      >
        {label || children}
      </Text>
    </Button>
  );
});
