import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { useMotionDegradeMonitor } from '../../hooks/useMotionDegrade';

interface ParticleSystemProps {
  trigger: boolean;
  count?: number;
}

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
        <Particle key={i} index={i} total={count} />
      ))}
    </View>
  );
};

function Particle({ index, total }: { index: number; total: number }) {
  const progress = useSharedValue(0);
  const angle = (index / total) * Math.PI * 2;
  const hue = index % 3;
  const color = hue === 0 ? '#ff8a1f' : hue === 1 ? '#f4b942' : '#f3efe4';

  useEffect(() => {
    progress.value = withDelay(index * 22, withSpring(1, { damping: 11 }));
  }, [index, progress]);

  const style = useAnimatedStyle(() => {
    const dist = 52 * progress.value;
    return {
      opacity: 1 - progress.value * 0.9,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { rotate: `${progress.value * 120}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: color,
          width: index % 2 ? 5 : 7,
          height: index % 2 ? 9 : 6,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    borderRadius: 2,
  },
});
