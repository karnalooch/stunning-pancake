import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { View } from 'tamagui';
import { PixelText } from './PixelText';
import * as Haptics from 'expo-haptics';

interface ArcadeButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'green' | 'red' | 'blue' | 'gold' | 'ghost';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/**
 * ArcadeButton - Replaces HD2DButton.
 * True arcade machine feel: presses "down" visually, plays haptics, chunky borders.
 */
export const ArcadeButton: React.FC<ArcadeButtonProps> = ({ 
  label, 
  onPress, 
  variant = 'green',
  fullWidth = true,
  size = 'md',
  disabled = false
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const colors = {
    green: { main: '#7BA05B', dark: '#4A6B34', text: '#FFFFFF' },
    red: { main: '#EF4444', dark: '#991B1B', text: '#FFFFFF' },
    blue: { main: '#3B82F6', dark: '#1E3A8A', text: '#FFFFFF' },
    gold: { main: '#D4A373', dark: '#8B7355', text: '#000000' },
    ghost: { main: 'transparent', dark: 'transparent', text: '#D4A373' },
  };

  const sizes = {
    sm: { height: 36, px: 12, fontSize: 10, shadow: 3 },
    md: { height: 50, px: 20, fontSize: 14, shadow: 5 },
    lg: { height: 64, px: 24, fontSize: 18, shadow: 6 },
  };

  const c = disabled ? { main: '#6B7280', dark: '#374151', text: '#9CA3AF' } : colors[variant];
  const s = sizes[size];
  
  const handlePressIn = () => {
    if (disabled) return;
    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    if (disabled) return;
    setIsPressed(false);
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={{ width: fullWidth ? '100%' : 'auto' }}
    >
      <View
        height={s.height}
        backgroundColor={c.main}
        paddingHorizontal={s.px}
        justifyContent="center"
        alignItems="center"
        borderWidth={variant === 'ghost' ? 2 : 3}
        borderColor={variant === 'ghost' ? c.text : '#000000'}
        transform={[{ translateY: isPressed ? s.shadow : 0 }]}
      >
        {/* The 3D drop shadow part (simulated using absolute positioning underneath) */}
        {variant !== 'ghost' && !isPressed && (
          <View
            position="absolute"
            bottom={-s.shadow - 3}
            left={-3}
            right={-3}
            height={s.shadow}
            backgroundColor={c.dark}
            borderLeftWidth={3}
            borderRightWidth={3}
            borderBottomWidth={3}
            borderColor="#000000"
            zIndex={-1}
          />
        )}
        
        {/* Inner highlight */}
        {variant !== 'ghost' && (
          <View
            position="absolute"
            top={0} left={0} right={0} height={2}
            backgroundColor="rgba(255,255,255,0.3)"
          />
        )}

        <PixelText color={c.text} size={s.fontSize} shadow={variant !== 'ghost' && !disabled}>
          {label}
        </PixelText>
      </View>
    </Pressable>
  );
};
