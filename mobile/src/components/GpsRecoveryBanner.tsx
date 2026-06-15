import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { HapticService } from '../services/HapticService';
import { FONTS } from '../theme/fonts';

interface GpsRecoveryBannerProps {
  visible: boolean;
  busy?: boolean;
  onPress: () => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const C = theme.colors as Record<string, string>;
  return {
    banner: {
      borderWidth: 2,
      borderColor: C.hudOutline,
      borderRadius: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      shadowColor: C.hudOutline,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
      backgroundColor: C.goldAmber,
    },
    text: {
      fontSize: 9,
      fontFamily: FONTS.display,
      color: C.hudOutline,
      textAlign: 'center',
      lineHeight: 14,
    },
  };
});

export const GpsRecoveryBanner: React.FC<GpsRecoveryBannerProps> = ({
  visible,
  busy = false,
  onPress,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const C = theme.colors as Record<string, string>;

  if (!visible) return null;

  return (
    <Pressable
      style={({ pressed }) => [s.banner, pressed && { opacity: 0.88 }]}
      onPress={() => {
        HapticService.trigger('button_press');
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t.gps.recoveryA11y}
    >
      <View style={{ overflow: 'hidden', borderRadius: 4 }}>
        {busy ? (
          <ActivityIndicator color={C.hudOutline} />
        ) : (
          <Text style={s.text}>{t.gps.recovery}</Text>
        )}
      </View>
    </Pressable>
  );
};
