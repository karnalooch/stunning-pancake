import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { ASSETS } from '../../assets/assetRegistry';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { useMotionDegradeMonitor } from '../../hooks/useMotionDegrade';

const ATLAS_FRAME = 32;
const ATLAS_FRAMES = 4;

interface ParticleSystemProps {
  trigger: boolean;
  count?: number;
}

/** Burst particles using `particle_atlas.png` tiles (128×32, 4×32px frames). */
export const ParticleSystem: React.FC<ParticleSystemProps> = ({
  trigger,
  count = 10,
}) => {
  const { allowParticles } = useMotionPolicy();
  const degraded = useMotionDegradeMonitor(false);

  if (!trigger || !allowParticles || degraded) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <AtlasParticle key={i} index={i} total={count} />
      ))}
    </View>
  );
};

function AtlasParticle({ index, total }: { index: number; total: number }) {
  const progress = useSharedValue(0);
  const angle = (index / total) * Math.PI * 2;
  const frameIndex = index % ATLAS_FRAMES;
  const scale = 0.5;

  useEffect(() => {
    progress.value = withDelay(index * 25, withSpring(1, { damping: 11 }));
  }, [index, progress]);

  const style = useAnimatedStyle(() => {
    const dist = 48 * progress.value;
    return {
      opacity: 1 - progress.value * 0.85,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
      ],
    };
  });

  const sheetStyle = useMemo(
    () => ({
      width: ATLAS_FRAME * ATLAS_FRAMES * scale,
      height: ATLAS_FRAME * scale,
      transform: [{ translateX: -frameIndex * ATLAS_FRAME * scale }],
    }),
    [frameIndex, scale],
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: '42%',
          left: '50%',
          width: ATLAS_FRAME * scale,
          height: ATLAS_FRAME * scale,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Image source={ASSETS.particles.particle_atlas} style={sheetStyle} resizeMode="stretch" />
    </Animated.View>
  );
}
