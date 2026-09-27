import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface EdgeStateBannerProps {
  title: string;
  message: string;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'offline' | 'success';
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    banner: {
      backgroundColor: semantic.surface.raised,
      borderWidth: 1,
      borderColor: semantic.status.error,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 4,
    },
    bannerWarning: {
      borderColor: semantic.status.warning,
    },
    bannerOffline: {
      borderColor: semantic.status.offline,
    },
    bannerSuccess: {
      borderColor: semantic.status.success,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.error,
    },
    titleWarning: {
      color: semantic.status.warning,
    },
    titleOffline: {
      color: semantic.status.offline,
    },
    titleSuccess: {
      color: semantic.status.success,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.primary,
    },
    dismiss: {
      minHeight: 44,
      alignSelf: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    dismissText: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.secondary,
    },
  };
});

/** Frozen UI v1.2 edge state for non-blocking error/offline/status feedback. */
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
        variant === 'warning' && s.bannerWarning,
        variant === 'offline' && s.bannerOffline,
        variant === 'success' && s.bannerSuccess,
      ]}
      accessibilityRole="alert"
    >
      <Text
        style={[
          s.title,
          variant === 'warning' && s.titleWarning,
          variant === 'offline' && s.titleOffline,
          variant === 'success' && s.titleSuccess,
        ]}
      >
        {title}
      </Text>
      <Text style={s.body}>{message}</Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          style={s.dismiss}
          onPress={onDismiss}
          hitSlop={8}
        >
          <Text style={s.dismissText}>OK</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
