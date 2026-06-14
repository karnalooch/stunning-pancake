import React from 'react';
import { PixelIcon } from '../ui/PixelIcon';
import { PIXEL_TAB_ICONS, type TabRouteName } from '../../assets/tabIcons';

interface PixelTabIconProps {
  routeName: string;
  focused: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

export const PixelTabIcon: React.FC<PixelTabIconProps> = ({
  routeName,
  size = 24,
}) => {
  const name = routeName as TabRouteName;
  const source = PIXEL_TAB_ICONS[name] ?? PIXEL_TAB_ICONS.Ride;

  return <PixelIcon source={source} size={size} baseSize={24} />;
};
