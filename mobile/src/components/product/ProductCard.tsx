import React from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { getSemanticColors } from '../../theme/semantic';

export type ProductCardVariant = 'default' | 'raised' | 'interactive' | 'selected';
export type ProductCardPadding = 'compact' | 'default';

interface ProductCardProps {
  children: React.ReactNode;
  variant?: ProductCardVariant;
  padding?: ProductCardPadding;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    base: {
      borderRadius: 16,
      borderWidth: 1,
    },
    paddingCompact: {
      padding: 12,
    },
    paddingDefault: {
      padding: 16,
    },
    default: {
      backgroundColor: semantic.surface.default,
      borderColor: semantic.border.subtle,
    },
    raised: {
      backgroundColor: semantic.surface.raised,
      borderColor: semantic.border.subtle,
    },
    interactive: {
      backgroundColor: semantic.surface.interactive,
      borderColor: semantic.border.subtle,
    },
    selected: {
      backgroundColor: semantic.selection.background,
      borderColor: semantic.selection.border,
    },
    pressed: {
      opacity: 0.82,
    },
  };
});

export const ProductCard: React.FC<ProductCardProps> = ({
  children,
  variant = 'default',
  padding = 'default',
  onPress,
  accessibilityLabel,
  testID,
}) => {
  const s = stylesheet;
  const cardStyle = [
    s.base,
    padding === 'compact' ? s.paddingCompact : s.paddingDefault,
    variant === 'default' && s.default,
    variant === 'raised' && s.raised,
    variant === 'interactive' && s.interactive,
    variant === 'selected' && s.selected,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [cardStyle, pressed && s.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
};
