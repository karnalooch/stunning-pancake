import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface GpsRecoveryBannerProps {
  visible: boolean;
  busy?: boolean;
  onPress: () => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const C = theme.colors as Record<string, string>;
  return {
    banner: {
      backgroundColor: C.tertiaryContainer ?? C.primaryContainer,
      borderWidth: 3,
      borderColor: C.onBackground,
      borderRadius: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    text: {
      fontSize: 13,
      fontWeight: '700',
      color: C.onBackground,
      textAlign: 'center',
    },
  };
});

export const GpsRecoveryBanner: React.FC<GpsRecoveryBannerProps> = ({
  visible,
  busy = false,
  onPress,
}) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const C = theme.colors as Record<string, string>;

  if (!visible) return null;

  return (
    <Pressable
      style={({ pressed }) => [s.banner, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Wyślij niewysłane punkty GPS"
    >
      {busy ? (
        <ActivityIndicator color={C.primary} />
      ) : (
        <Text style={s.text}>
          Masz niewysłane punkty GPS — dotknij aby wysłać
        </Text>
      )}
    </Pressable>
  );
};
