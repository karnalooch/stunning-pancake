import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { pixelShadow } from '../../theme/pixelShadow';

interface OrnateFrameProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  tone?: 'parchment' | 'surface';
}

/**
 * OrnateFrame — standard pixel-sharp panel border used across the vision mocks.
 * Renders a themed double-border now; ready to swap to a 9-slice `frame_ornate`
 * image once that asset is generated (see assets/visionAssets.ts).
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
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'parchment' ? c.parchment : c.surface,
          borderWidth: 3,
          borderColor: outline,
          padding,
          ...pixelShadow(outline, 'md'),
        },
        style,
      ]}
    >
      {/* inner hairline to evoke the scroll frame double-border */}
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
