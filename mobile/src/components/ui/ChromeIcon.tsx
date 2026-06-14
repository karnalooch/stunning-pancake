import React from 'react';
import { CHROME_ICONS, type ChromeIconId } from '../../assets/chromeIcons';
import { PixelIcon } from './PixelIcon';

interface ChromeIconProps {
  id: ChromeIconId;
  size?: number;
  baseSize?: number;
}

export const ChromeIcon: React.FC<ChromeIconProps> = ({ id, size = 20, baseSize = 24 }) => (
  <PixelIcon source={CHROME_ICONS[id]} size={size} baseSize={baseSize} />
);
