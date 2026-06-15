import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FONTS } from '../../theme/fonts';

interface EdgeStateBannerProps {
  title: string;
  message: string;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'offline' | 'success';
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    banner: {
      backgroundColor: c.tertiaryFixed ?? c.errorContainer,
      borderWidth: 3,
      borderColor: c.hudOutline,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    bannerOffline: {
      backgroundColor: c.secondaryContainer,
    },
    bannerSuccess: {
      backgroundColor: c.primaryContainer,
    },
    title: {
      fontSize: 12,
      fontFamily: FONTS.display,
      color: c.onBackground,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    body: {
      fontSize: 12,
      fontWeight: '600',
      color: c.onBackground,
      lineHeight: 18,
    },
    dismiss: { marginTop: 8, alignSelf: 'flex-end' },
    dismissText: {
      fontSize: 10,
      fontFamily: FONTS.display,
      color: c.primary,
      textTransform: 'uppercase',
    },
  };
});

/** Pixel-art edge state (DS §10) — replaces native Alert for non-blocking errors. */
export const EdgeStateBanner: React.FC<EdgeStateBannerProps> = ({
  title,
  message,
  onDismiss,
  variant = 'error',
}) => {
  const s = stylesheet;
  return (
    <View
      style={[
        s.banner,
        variant === 'offline' && s.bannerOffline,
        variant === 'success' && s.bannerSuccess,
      ]}
      accessibilityRole="alert"
    >
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{message}</Text>
      {onDismiss ? (
        <Pressable style={s.dismiss} onPress={onDismiss} hitSlop={8}>
          <Text style={s.dismissText}>OK</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
