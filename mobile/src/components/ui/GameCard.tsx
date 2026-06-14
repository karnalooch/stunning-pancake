import React from 'react';
import { type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { TextureBackground } from './TextureBackground';
import { pixelShadow } from '../../theme/pixelShadow';
import type { TextureId } from '../../assets/assetRegistry';

interface GameCardProps {
  texture?: TextureId;
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export const GameCard: React.FC<GameCardProps> = ({
  texture = 'parchment_grain',
  children,
  style,
  padding = 16,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const outline = c.hudOutline ?? '#111111';
  const cardStyle = {
    backgroundColor: c.parchment,
    borderWidth: 3,
    borderColor: outline,
    borderRadius: 8,
    padding,
    ...pixelShadow(outline, 'md'),
  };

  return (
    <TextureBackground texture={texture} opacity={0.07} style={[cardStyle, style]}>
      {children}
    </TextureBackground>
  );
};
