import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';

interface CyclistSpriteProps {
  size?: number;
  state?: 'idle' | 'cruise' | 'attack' | 'victory';
}

export const CyclistSprite: React.FC<CyclistSpriteProps> = ({
  size = 44,
  state = 'cruise',
}) => {
  const bounce = useSharedValue(0);
  const { allowSpriteAnim } = useMotionPolicy();

  useEffect(() => {
    if (!allowSpriteAnim) {
      bounce.value = 0;
      return;
    }
    bounce.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: state === 'attack' ? 120 : 220 }),
        withTiming(0, { duration: state === 'attack' ? 120 : 220 }),
      ),
      -1,
      true,
    );
  }, [bounce, state, allowSpriteAnim]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  const emoji = state === 'victory' ? '🏆' : state === 'idle' ? '🧍' : '🚴';

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        anim,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 3,
    borderColor: '#191d17',
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
