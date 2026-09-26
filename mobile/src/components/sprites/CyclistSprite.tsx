import React, { useEffect } from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { HeroPreferencesService } from '../../services/HeroPreferencesService';
import { APPROVED_ASSETS } from '../../assets/approvedAssets';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface CyclistSpriteProps {
  size?: number;
  state?: 'idle' | 'cruise' | 'attack' | 'victory';
  useSheet?: boolean;
  expressionMode?: boolean;
}

/**
 * Compatibility wrapper around the fresh canonical rider.
 * The stale sprite/expression raster family is intentionally retired.
 */
export const CyclistSprite: React.FC<CyclistSpriteProps> = ({
  size = 44,
  state = 'cruise',
}) => {
  const bounce = useSharedValue(0);
  const { allowSpriteAnim } = useMotionPolicy();
  const cityText = HeroPreferencesService.getCityText();

  useEffect(() => {
    if (!allowSpriteAnim) {
      bounce.value = 0;
      return;
    }
    bounce.value = withRepeat(
      withSequence(
        withTiming(state === 'victory' ? -4 : -2, { duration: state === 'attack' ? 120 : 260 }),
        withTiming(0, { duration: state === 'attack' ? 120 : 260 }),
      ),
      -1,
      true,
    );
  }, [allowSpriteAnim, bounce, state]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, anim]}>
      <Image
        source={APPROVED_ASSETS.riderCanonical}
        resizeMode="cover"
        style={[styles.rider, { width: size, height: size }]}
        testID="rider-canonical-v1"
      />
      {size >= 56 ? (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[styles.decal, { fontSize: Math.max(7, size * 0.11) }]}
        >
          {cityText}
        </Text>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rider: {
    borderRadius: 12,
  },
  decal: {
    ...PRODUCT_TYPOGRAPHY.metricLabel,
    position: 'absolute',
    bottom: -4,
    left: -8,
    right: -8,
    textAlign: 'center',
    color: '#f3efe4',
  },
});
