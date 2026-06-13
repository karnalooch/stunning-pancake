import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { SpriteAnimator } from './SpriteAnimator';

interface CyclistSpriteProps {
  size?: number;
  state?: 'idle' | 'cruise' | 'attack' | 'victory';
  /** Use pixel-art sprite sheet when true (default). */
  useSheet?: boolean;
}

export const CyclistSprite: React.FC<CyclistSpriteProps> = ({
  size = 44,
  state = 'cruise',
  useSheet = true,
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

  const playing = state === 'cruise' || state === 'attack';
  const fps = state === 'attack' ? 14 : 8;
  const emoji = state === 'victory' ? '🏆' : state === 'idle' ? '🧍' : '🚴';

  if (useSheet) {
    return (
      <Animated.View style={anim}>
        <SpriteAnimator
          size={size}
          playing={playing}
          fps={fps}
          frame={state === 'victory' ? 7 : state === 'idle' ? 0 : 0}
        />
      </Animated.View>
    );
  }

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
