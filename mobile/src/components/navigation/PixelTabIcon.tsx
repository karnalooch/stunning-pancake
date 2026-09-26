import React from 'react';
import { Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface PixelTabIconProps {
  routeName: string;
  focused: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

const GLYPHS: Record<string, string> = {
  Ride: '◉',
  Compete: '◇',
  Explore: '⌖',
  Profile: '●',
};

export const PixelTabIcon: React.FC<PixelTabIconProps> = ({
  routeName,
  focused,
  size = 24,
  activeColor,
  inactiveColor,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const color = focused
    ? (activeColor ?? c.primary ?? '#ff8a1f')
    : (inactiveColor ?? c.outline ?? '#8797a3');

  return (
    <Text
      allowFontScaling={false}
      accessibilityElementsHidden
      style={{ fontSize: size, lineHeight: size + 2, color }}
    >
      {GLYPHS[routeName] ?? GLYPHS.Ride}
    </Text>
  );
};
