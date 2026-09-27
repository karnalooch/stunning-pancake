import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface PlaceBadgeProps {
  name: string;
  size?: number;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '4V';
  if (words.length === 1) return first.slice(0, 2).toUpperCase();

  const last = words[words.length - 1] ?? first;
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export const PlaceBadge: React.FC<PlaceBadgeProps> = ({ name, size = 44 }) => {
  const s = styles;

  return (
    <View
      testID="place-badge-v1"
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        s.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        },
      ]}
    >
      <View style={s.accent} />
      <Text
        allowFontScaling={false}
        style={[s.label, { fontSize: Math.max(10, Math.round(size * 0.28)) }]}
      >
        {initialsFor(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    badge: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.navigation.shell,
      borderWidth: 1,
      borderColor: semantic.border.selected,
    },
    accent: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: '18%',
      backgroundColor: semantic.progress.primary,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      letterSpacing: 0.6,
    },
  };
});
