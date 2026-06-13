import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

interface PixelBurstProps {
  trigger: boolean;
  color?: string;
  count?: number;
}

export const PixelBurst: React.FC<PixelBurstProps> = ({
  trigger,
  color = '#D4A373',
  count = 8,
}) => {
  if (!trigger) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <BurstParticle key={i} index={i} total={count} color={color} />
      ))}
    </View>
  );
};

function BurstParticle({
  index,
  total,
  color,
}: {
  index: number;
  total: number;
  color: string;
}) {
  const progress = useSharedValue(0);
  const angle = (index / total) * Math.PI * 2;

  useEffect(() => {
    progress.value = withDelay(index * 30, withSpring(1, { damping: 12 }));
  }, [index, progress]);

  const style = useAnimatedStyle(() => {
    const dist = 40 * progress.value;
    return {
      opacity: 1 - progress.value * 0.8,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: '45%',
          left: '50%',
          width: 8,
          height: 8,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: '#191d17',
        },
        style,
      ]}
    />
  );
}
