import React, { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import { ASSETS, type EnvironmentLayerId } from '../../assets/assetRegistry';

interface ImageParallaxLayerProps {
  layerId: EnvironmentLayerId;
  heightPercent: number;
  bottom?: number;
  parallaxSpeed?: number;
  enabled?: boolean;
}

const LAYER_SOURCES: Record<EnvironmentLayerId, ImageSourcePropType> = {
  sky_day: ASSETS.environment.sky_day,
  hills_far: ASSETS.environment.hills_far,
  town_mid: ASSETS.environment.town_mid,
  road_near: ASSETS.environment.road_near,
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
      withTiming(-48, { duration: 12000 / Math.max(0.2, parallaxSpeed), easing: Easing.linear }),
      -1,
      false,
    );
  }, [enabled, parallaxSpeed, offset]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        height: `${heightPercent}%`,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ flexDirection: 'row', width: '200%', height: '100%' }, animStyle]}>
        <Image source={LAYER_SOURCES[layerId]} style={styles.tile} resizeMode="cover" />
        <Image source={LAYER_SOURCES[layerId]} style={styles.tile} resizeMode="cover" />
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
      ? 'rgba(212, 163, 115, 0.15)'
      : variant === 'night'
        ? 'rgba(11, 29, 51, 0.4)'
        : 'transparent';
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
    >
      {variant === 'day' && (
        <View
          style={{
            position: 'absolute',
            top: 48,
            right: 32,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.goldAmber,
            opacity: 0.85,
            borderWidth: 2,
            borderColor: c.hudOutline,
          }}
        />
      )}
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
        {
          backgroundColor: strength === 'strong' ? c.scrimStrong : c.scrimSoft,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    height: '100%',
  },
});
