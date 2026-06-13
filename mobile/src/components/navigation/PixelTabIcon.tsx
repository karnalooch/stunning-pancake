import React from 'react';
import { Text, View } from 'react-native';
import { useImmersiveTheme } from '../../hooks/useImmersiveTheme';
import { PIXEL_TAB_ICONS, TAB_EMOJI_FALLBACK, type TabRouteName } from '../../assets/tabIcons';

interface PixelTabIconProps {
  routeName: string;
  focused: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

export const PixelTabIcon: React.FC<PixelTabIconProps> = ({
  routeName,
  focused,
  size = 24,
  activeColor = '#7BA05B',
  inactiveColor = '#4A4A4A',
}) => {
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const name = routeName as TabRouteName;
  const SvgIcon = immersiveEnabled ? PIXEL_TAB_ICONS[name] : undefined;
  const emoji = TAB_EMOJI_FALLBACK[name] ?? '📍';

  if (SvgIcon) {
    return (
      <SvgIcon
        width={size}
        height={size}
        fill={focused ? activeColor : inactiveColor}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size - 4 }}>{emoji}</Text>
    </View>
  );
};
