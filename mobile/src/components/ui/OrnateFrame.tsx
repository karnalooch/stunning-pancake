import React from 'react';
import { ImageBackground, View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { pixelShadow } from '../../theme/pixelShadow';
import { VISION_BANNERS } from '../../assets/visionAssets';

interface OrnateFrameProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  tone?: 'parchment' | 'surface';
}

/**
 * OrnateFrame — standard pixel-sharp panel border used across the vision mocks.
 * Uses a 9-slice frame_ornate.png when available (pixel-art scroll-frame border),
 * falling back to a themed double-border for pixel auth.
 */
export const OrnateFrame: React.FC<OrnateFrameProps> = ({
  children,
  style,
  padding = 16,
  tone = 'parchment',
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const outline = c.hudOutline ?? '#0B1D33';
  const frameSource = VISION_BANNERS.frame_ornate;
  const bg = tone === 'parchment' ? c.parchment : c.surface;

  if (frameSource) {
    return (
      <ImageBackground
        source={frameSource}
        resizeMode="stretch"
        style={[{ padding, ...pixelShadow(outline, 'md') }, style]}
      >
        <View style={{ borderRadius: 0, overflow: 'hidden' }}>
          {children}
        </View>
      </ImageBackground>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: 3,
          borderColor: outline,
          padding,
          ...pixelShadow(outline, 'md'),
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          right: 4,
          bottom: 4,
          borderWidth: 1,
          borderColor: c.outlineVariant,
        }}
      />
      {children}
    </View>
  );
};
