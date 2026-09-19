import React from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

export type PrimaryButtonVariant = 'primary' | 'secondary' | 'destructive';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: PrimaryButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    base: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: semantic.action.primary,
      borderColor: semantic.action.primary,
    },
    primaryPressed: {
      backgroundColor: semantic.action.primaryPressed,
      borderColor: semantic.action.primaryPressed,
    },
    secondary: {
      backgroundColor: semantic.action.secondary,
      borderColor: semantic.border.subtle,
    },
    secondaryPressed: {
      backgroundColor: semantic.surface.interactive,
      borderColor: semantic.border.strong,
    },
    destructive: {
      backgroundColor: semantic.action.destructive,
      borderColor: semantic.action.destructive,
    },
    disabled: {
      backgroundColor: semantic.action.disabled,
      borderColor: semantic.action.disabled,
      opacity: 0.7,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    labelOnAction: {
      color: semantic.text.onAction,
    },
    labelOnDestructive: {
      color: semantic.text.onDestructive,
    },
  };
});

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  testID,
}) => {
  const s = stylesheet;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        s.base,
        variant === 'primary' && s.primary,
        variant === 'secondary' && s.secondary,
        variant === 'destructive' && s.destructive,
        pressed && variant === 'primary' && s.primaryPressed,
        pressed && variant === 'secondary' && s.secondaryPressed,
        disabled && s.disabled,
      ]}
    >
      <Text
        style={[
          s.label,
          variant === 'primary' && s.labelOnAction,
          variant === 'destructive' && s.labelOnDestructive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};
