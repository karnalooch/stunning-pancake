// STITCH Phase 2 — RidePausedScreen (stack modal)
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { ChromeIcon } from '../components/ui/ChromeIcon';
import { pixelShadow } from '../theme/pixelShadow';
import { FONTS } from '../theme/fonts';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 29, 51, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    borderWidth: 4,
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 24,
    fontFamily: FONTS.display,
  },
  btn: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontFamily: FONTS.display,
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
  const outline = c.hudOutline ?? '#111111';
  return (
    <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
      <View
        style={[
          styles.modal,
          {
            backgroundColor: c.surface,
            borderColor: outline,
            ...pixelShadow(outline, 'md'),
          },
        ]}
      >
        <ChromeIcon id="quests" size={32} />
        <Text style={[styles.title, { color: c.onBackground }]} allowFontScaling>
          {t.ride.paused.title}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: outline, backgroundColor: c.primaryContainer },
            pressed && { opacity: 0.85 },
          ]}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel={t.ride.paused.resume}
        >
          <Text style={[styles.btnText, { color: c.onPrimaryContainer }]} allowFontScaling>
            ▶ {t.ride.paused.resume}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: outline, backgroundColor: c.error },
            pressed && { opacity: 0.85 },
          ]}
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel={t.ride.paused.stop}
        >
          <Text style={[styles.btnText, { color: c.onError }]} allowFontScaling>
            ■ {t.ride.paused.stop}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
