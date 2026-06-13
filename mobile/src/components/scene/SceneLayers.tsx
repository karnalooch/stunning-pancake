import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface ParallaxLayerProps {
  color: string;
  heightPercent: number;
  bottom?: number;
  opacity?: number;
}

export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  color,
  heightPercent,
  bottom = 0,
  opacity = 1,
}) => (
  <View
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom,
      height: `${heightPercent}%`,
      backgroundColor: color,
      opacity,
    }}
  />
);

interface AmbientLayerProps {
  variant?: 'day' | 'sunset' | 'night';
}

export const AmbientLayer: React.FC<AmbientLayerProps> = ({ variant = 'day' }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const tint =
    variant === 'sunset'
      ? 'rgba(255, 184, 0, 0.12)'
      : variant === 'night'
        ? 'rgba(13, 27, 15, 0.35)'
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
            borderWidth: 3,
            borderColor: c.onBackground,
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
