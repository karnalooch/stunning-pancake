import React from 'react';
import { Image, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { VISION_BANNERS } from '../../assets/visionAssets';

interface FinishCelebrationProps {
  height?: number;
}

/** Finish-line "META" scene (vision/00_onboarding_finish.png). Asset-optional. */
export const FinishCelebration: React.FC<FinishCelebrationProps> = ({ height = 140 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const source = VISION_BANNERS.finish_meta;

  if (source) {
    return (
      <Image
        source={source}
        style={{ width: '100%', height, borderTopWidth: 3, borderColor: c.hudOutline }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        height,
        backgroundColor: c.gpSepia,
        borderTopWidth: 3,
        borderColor: c.hudOutline,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: c.cta,
          borderWidth: 2,
          borderColor: c.hudOutline,
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}
      >
        <PixelText size="lg" style={{ color: c.onCta }}>META</PixelText>
      </View>
    </View>
  );
};
