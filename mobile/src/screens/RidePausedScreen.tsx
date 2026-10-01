import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { RideActionBar, type RideAction } from '../components/ride/RideActionBar';
import { useI18n } from '../i18n/useI18n';
import { getAppCopy } from '../components/roadbook/appCopy';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

/** A bounded overlay in the current ride, not a route or a second recording controller. */
export const RidePausedScreen: React.FC<{ onResume: RideAction; onStop: RideAction }> = ({ onResume, onStop }) => {
  const { locale } = useI18n();
  const c = getAppCopy(locale);
  return <SafeAreaView style={styles.overlay} edges={['bottom']} testID="ride-paused-screen" accessibilityViewIsModal>
    <View style={styles.sheet} testID="ride-paused-card">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{c.paused}</Text>
        <Text style={styles.body}>{c.pauseBody}</Text>
        <RideActionBar isPaused onResume={onResume} onStop={onStop}
          resumeTestID="ride-paused-resume" stopTestID="ride-paused-stop" />
      </ScrollView>
    </View>
  </SafeAreaView>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end',
      backgroundColor: theme.colors.ridePausedScrim, zIndex: 30 },
    sheet: { maxHeight: '78%', width: '100%', maxWidth: 680, alignSelf: 'center',
      backgroundColor: c.surface.default, borderTopWidth: 2, borderColor: c.border.strong,
      borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    content: { padding: 24, gap: 20 }, title: { ...PRODUCT_TYPOGRAPHY.displayEditorial, color: c.text.primary },
    body: { ...PRODUCT_TYPOGRAPHY.body, lineHeight: 25, color: c.text.secondary },
  };
});
