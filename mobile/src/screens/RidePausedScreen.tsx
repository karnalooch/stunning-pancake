// STITCH Phase 2 — RidePausedScreen (stack modal)
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    ...PRODUCT_TYPOGRAPHY.title,
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    ...PRODUCT_TYPOGRAPHY.bodyMedium,
  },
});

interface Props {
  onResume: () => void;
  onStop: () => void;
}

export const RidePausedScreen: React.FC<Props> = ({ onResume, onStop }) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);
  const outline = semantic.border.strong;
  return (
    <SafeAreaView testID="ride-paused-screen" style={[styles.overlay, { backgroundColor: c.ridePausedScrim }]} edges={['top', 'bottom']}>
      <View
        style={[
          styles.modal,
          {
            backgroundColor: semantic.surface.raised,
            borderColor: semantic.border.subtle,
          },
        ]}
      >
        <Text style={[styles.title, { color: semantic.text.primary }]} allowFontScaling>
          {t.ride.paused.title}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: semantic.action.primary, backgroundColor: semantic.action.primary },
            pressed && { opacity: 0.85 },
          ]}
          onPress={onResume}
          testID="ride-paused-resume"
          accessibilityRole="button"
          accessibilityLabel={t.ride.paused.resume}
        >
          <Text style={[styles.btnText, { color: semantic.text.onAction }]} allowFontScaling>
            {t.ride.paused.resume}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: semantic.action.destructive, backgroundColor: semantic.action.destructive },
            pressed && { opacity: 0.85 },
          ]}
          onPress={onStop}
          testID="ride-paused-stop"
          accessibilityRole="button"
          accessibilityLabel={t.ride.paused.stop}
        >
          <Text style={[styles.btnText, { color: semantic.text.onDestructive }]} allowFontScaling>
            {t.ride.paused.stop}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
