import React, { useEffect } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { ASSETS } from '../../assets/assetRegistry';
import { HeroPreferencesService } from '../../services/HeroPreferencesService';
import { SpriteAnimator } from './SpriteAnimator';
import { FONTS } from '../../theme/fonts';

interface CyclistSpriteProps {
  size?: number;
  state?: 'idle' | 'cruise' | 'attack' | 'victory';
  /** Use pixel-art sprite sheet when true (default). */
  useSheet?: boolean;
  /** Prefer expression PNG portraits for idle/victory (Summary/Profile). */
  expressionMode?: boolean;
}

const EXPRESSION_BY_STATE = {
  idle: ASSETS.expressions.cyclist_idle,
  victory: ASSETS.expressions.cyclist_victory,
  tired: ASSETS.expressions.cyclist_tired,
  happy: ASSETS.expressions.cyclist_happy,
} as const;

export const CyclistSprite: React.FC<CyclistSpriteProps> = ({
  size = 44,
  state = 'cruise',
  useSheet = true,
  expressionMode = false,
}) => {
  const bounce = useSharedValue(0);
  const { allowSpriteAnim } = useMotionPolicy();
  const helmetColor = HeroPreferencesService.getHelmetColor();
  const cityText = HeroPreferencesService.getCityText();

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

  const showExpression =
    expressionMode && (state === 'idle' || state === 'victory');

  if (showExpression) {
    const source =
      state === 'victory'
        ? EXPRESSION_BY_STATE.victory
        : EXPRESSION_BY_STATE.idle;
    return (
      <Animated.View style={[styles.frame, { width: size, height: size, borderColor: helmetColor }, anim]}>
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
        <Text style={[styles.decal, { fontSize: Math.max(6, size * 0.14) }]} numberOfLines={1}>
          {cityText}
        </Text>
      </Animated.View>
    );
  }

  if (useSheet) {
    return (
      <Animated.View style={[anim, { position: 'relative' }]}>
        <SpriteAnimator
          size={size}
          playing={playing}
          fps={fps}
          frame={state === 'victory' ? 7 : 0}
        />
        <Text style={[styles.decal, { fontSize: Math.max(6, size * 0.14) }]} numberOfLines={1}>
          {cityText}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, borderColor: helmetColor },
        anim,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    borderWidth: 2,
    borderColor: '#CC4444',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5E6CC',
  },
  decal: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: FONTS.display,
    color: '#191d17',
    opacity: 0.85,
  },
  wrap: {
    borderWidth: 3,
    borderColor: '#191d17',
    backgroundColor: '#F5E6CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
