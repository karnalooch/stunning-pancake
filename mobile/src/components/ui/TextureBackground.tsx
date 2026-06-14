import React from 'react';
import { ImageBackground, View, type ViewProps } from 'react-native';
import { ASSETS, type TextureId } from '../../assets/assetRegistry';

interface TextureBackgroundProps extends ViewProps {
  texture: TextureId;
  /** 0–1 opacity of grain overlay (spec: 5–8%) */
  opacity?: number;
  children?: React.ReactNode;
}

const TEXTURE_SOURCES: Record<TextureId, number> = {
  parchment_grain: ASSETS.textures.parchment_grain,
  metal_plate: ASSETS.textures.metal_plate,
  wood_grain: ASSETS.textures.wood_grain,
};

/** Subtle pixel-art grain behind cards / HUD frames. */
export const TextureBackground: React.FC<TextureBackgroundProps> = ({
  texture,
  opacity = 0.07,
  style,
  children,
  ...rest
}) => (
  <View style={[{ overflow: 'hidden' }, style]} {...rest}>
    <ImageBackground
      source={TEXTURE_SOURCES[texture]}
      resizeMode="repeat"
      imageStyle={{ opacity }}
      style={{ flex: 1 }}
    >
      {children}
    </ImageBackground>
  </View>
);
