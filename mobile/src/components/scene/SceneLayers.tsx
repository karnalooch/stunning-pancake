import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import type { EnvironmentLayerId } from '../../theme/scenes';

interface ImageParallaxLayerProps {
  layerId: EnvironmentLayerId;
  heightPercent: number;
  bottom?: number;
  parallaxSpeed?: number;
  enabled?: boolean;
}

const LAYER_COLORS: Record<EnvironmentLayerId, string> = {
  sky_day: '#31546b',
  sky_sunset: '#7b4f42',
  sky_night: '#0b1620',
  hills_far: '#27423f',
  town_mid: '#1f3438',
  road_near: '#25313a',
};

export const ImageParallaxLayer: React.FC<ImageParallaxLayerProps> = ({
  layerId,
  heightPercent,
  bottom = 0,
  parallaxSpeed = 0.5,
  enabled = true,
}) => {
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!enabled || parallaxSpeed <= 0) {
      offset.value = 0;
      return;
    }
    offset.value = withRepeat(
      withTiming(-28, { duration: 12000 / Math.max(0.2, parallaxSpeed), easing: Easing.linear }),
      -1,
      false,
    );
  }, [enabled, parallaxSpeed, offset]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={[styles.layer, { bottom, height: `${heightPercent}%` }]}>
      <Animated.View style={[styles.proceduralBand, { backgroundColor: LAYER_COLORS[layerId] }, animStyle]}>
        <View style={styles.shapeA} />
        <View style={styles.shapeB} />
        <View style={styles.shapeC} />
      </Animated.View>
    </View>
  );
};

interface AmbientLayerProps {
  variant?: 'day' | 'sunset' | 'night';
}

export const AmbientLayer: React.FC<AmbientLayerProps> = ({ variant = 'day' }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const tint =
    variant === 'sunset'
      ? 'rgba(255,138,31,0.14)'
      : variant === 'night'
        ? 'rgba(3,10,18,0.46)'
        : 'transparent';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}>
      {variant !== 'night' ? <View style={[styles.sun, { backgroundColor: c.goldAmber ?? '#f4b942' }]} /> : null}
    </View>
  );
};

interface ScrimProps {
  strength?: 'soft' | 'strong';
}

export const Scrim: React.FC<ScrimProps> = ({ strength = 'soft' }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: strength === 'strong' ? c.scrimStrong : c.scrimSoft },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  proceduralBand: {
    width: '120%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  shapeA: { width: 90, height: 70, backgroundColor: 'rgba(255,255,255,0.035)', transform: [{ rotate: '45deg' }] },
  shapeB: { width: 130, height: 90, backgroundColor: 'rgba(0,0,0,0.07)', transform: [{ rotate: '45deg' }] },
  shapeC: { width: 80, height: 60, backgroundColor: 'rgba(255,255,255,0.025)', transform: [{ rotate: '45deg' }] },
  sun: {
    position: 'absolute',
    top: 46,
    right: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.78,
  },
});
