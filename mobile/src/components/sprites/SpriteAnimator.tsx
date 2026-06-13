import React, { useEffect } from 'react';
import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';

const CYCLIST_SHEET = require('../../../assets/generated/sprites/cyclist_sheet.png') as ImageSourcePropType;

export interface SpriteSheetConfig {
  source: ImageSourcePropType;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export const CYCLIST_SHEET_CONFIG: SpriteSheetConfig = {
  source: CYCLIST_SHEET,
  frameWidth: 64,
  frameHeight: 64,
  frameCount: 8,
};

interface SpriteAnimatorProps {
  config?: SpriteSheetConfig;
  size?: number;
  /** Frames per second when animating */
  fps?: number;
  playing?: boolean;
  /** Static frame when not playing */
  frame?: number;
}

export const SpriteAnimator: React.FC<SpriteAnimatorProps> = ({
  config = CYCLIST_SHEET_CONFIG,
  size = 44,
  fps = 10,
  playing = true,
  frame = 0,
}) => {
  const { allowSpriteAnim } = useMotionPolicy();
  const [frameIndex, setFrameIndex] = React.useState(frame);

  useEffect(() => {
    if (!playing || !allowSpriteAnim) {
      setFrameIndex(frame);
      return;
    }
    const interval = setInterval(() => {
      setFrameIndex((i) => (i + 1) % config.frameCount);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [playing, allowSpriteAnim, fps, config.frameCount, frame]);

  const scale = size / config.frameHeight;

  return (
    <View
      style={[
        styles.clip,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Image
        source={config.source}
        style={{
          width: config.frameWidth * config.frameCount * scale,
          height: config.frameHeight * scale,
          transform: [{ translateX: -frameIndex * config.frameWidth * scale }],
        }}
        resizeMode="stretch"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#191d17',
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
});
