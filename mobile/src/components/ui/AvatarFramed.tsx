import React from 'react';
import { Image, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { CyclistSprite } from '../sprites/CyclistSprite';
import { VISION_BANNERS } from '../../assets/visionAssets';

interface AvatarFramedProps {
  size?: number;
}

/** Circular portrait inside a gold frame ring (vision/12_profile.png). */
export const AvatarFramed: React.FC<AvatarFramedProps> = ({ size = 96 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const frame = VISION_BANNERS.avatar_frame;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: c.goldAmber,
          backgroundColor: c.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <CyclistSprite size={Math.round(size * 0.8)} state="idle" />
      </View>
      {frame ? (
        <Image
          source={frame}
          style={{ position: 'absolute', width: size, height: size }}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
};
