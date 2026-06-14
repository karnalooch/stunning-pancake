import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface SkeletonBlockProps {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    block: {
      backgroundColor: c.surfaceContainerHigh,
      borderWidth: 2,
      borderColor: c.outlineVariant,
      borderRadius: 6,
    },
  };
});

/** Pixel-art skeleton placeholder (replaces spinners on list cards). */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  height = 72,
  width = '100%',
  style,
}) => {
  const s = stylesheet;
  return <View style={[s.block, { height, width }, style]} />;
};
