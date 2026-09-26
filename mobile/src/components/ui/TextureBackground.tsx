import React from 'react';
import { View, type ViewProps } from 'react-native';

export type TextureId = 'parchment_grain' | 'metal_plate' | 'wood_grain';

interface TextureBackgroundProps extends ViewProps {
  texture: TextureId;
  opacity?: number;
  children?: React.ReactNode;
}

/**
 * Fresh-v1 texture shell. Old raster textures were retired during the
 * governed v1 cut-over; subtle surface treatment now comes from product chrome.
 */
export const TextureBackground: React.FC<TextureBackgroundProps> = ({
  style,
  children,
  ...rest
}) => (
  <View style={[{ overflow: 'hidden' }, style]} {...rest}>
    {children}
  </View>
);
