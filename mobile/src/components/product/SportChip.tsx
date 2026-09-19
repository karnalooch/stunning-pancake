import React from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface SportChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    base: {
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.surface.default,
      borderColor: semantic.border.subtle,
    },
    selected: {
      backgroundColor: semantic.selection.background,
      borderColor: semantic.selection.border,
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.82,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    selectedLabel: {
      color: semantic.selection.content,
    },
  };
});

export const SportChip: React.FC<SportChipProps> = ({
  label,
  selected,
  onPress,
  disabled = false,
  testID,
}) => {
  const s = stylesheet;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        s.base,
        selected && s.selected,
        disabled && s.disabled,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.label, selected && s.selectedLabel]}>{label}</Text>
    </Pressable>
  );
};
