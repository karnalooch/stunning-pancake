import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CyclistSprite } from '../sprites/CyclistSprite';
import { useImmersiveTheme } from '../../hooks/useImmersiveTheme';

interface RiderAvatarProps {
  size?: number;
  style?: ViewStyle;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    ring: {
      borderWidth: 3,
      borderColor: c.hudOutline,
      backgroundColor: c.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    dot: {
      backgroundColor: c.primaryContainer,
    },
  };
});

/** Bundled default avatar (DS §7) — CyclistSprite in chrome ring. */
export const RiderAvatar: React.FC<RiderAvatarProps> = ({ size = 40, style }) => {
  const s = stylesheet;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const radius = size / 2;

  return (
    <View style={[s.ring, { width: size, height: size, borderRadius: radius }, style]}>
      {immersiveEnabled ? (
        <CyclistSprite size={Math.round(size * 0.8)} state="idle" />
      ) : (
        <View style={[s.dot, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25 }]} />
      )}
    </View>
  );
};
