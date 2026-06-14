import React from 'react';
import { Image, ImageSourcePropType, View } from 'react-native';

interface PixelIconProps {
  source: ImageSourcePropType;
  /** Display slot size in dp */
  size?: number;
  /** Native asset pixel dimension (e.g. 24 for tab icons, 32 for grades) */
  baseSize?: number;
}

/** Renders a pixel-art PNG at an integer scale to avoid blur (DESIGN_SYSTEM §8). */
export const PixelIcon: React.FC<PixelIconProps> = ({
  source,
  size = 24,
  baseSize = 24,
}) => {
  const scale = Math.max(1, Math.round(size / baseSize));
  const renderSize = baseSize * scale;

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image
        source={source}
        style={{ width: renderSize, height: renderSize }}
        resizeMode="contain"
      />
    </View>
  );
};
