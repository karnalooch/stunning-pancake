import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../../i18n/useI18n';
import { HapticService } from '../../services/HapticService';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';
import { getAppCopy } from '../roadbook/appCopy';

export type RideAction = () => void | boolean | Promise<void | boolean>;
interface RideActionBarProps {
  isPaused: boolean; onPause?: RideAction; onResume?: RideAction; onStop: RideAction;
  pauseTestID?: string; resumeTestID?: string; stopTestID?: string;
}
const STOP_HOLD_MS = 900;
export const RideActionBar: React.FC<RideActionBarProps> = ({ isPaused, onPause, onResume, onStop,
  pauseTestID = 'ride-pause-button', resumeTestID = 'ride-resume-button', stopTestID = 'ride-stop-button',
}) => {
  const { theme } = useUnistyles();
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const c = getSemanticColors(theme.colors);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const confirming = useRef(false);
  const [stopArmed, setStopArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cancelHold = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (mounted.current) setStopArmed(false);
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancelHold(); });
    return () => { mounted.current = false; cancelHold(); subscription.remove(); };
  }, []);
  useEffect(() => { cancelHold(); }, [isPaused]);
  const run = async (action?: RideAction) => {
    if (locked.current || !action) return;
    locked.current = true;
    cancelHold(); setBusy(true); setError(false);
    try {
      HapticService.trigger('button_press');
      const result = await action();
      if (result === false && mounted.current) setError(true);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const startStopHold = () => {
    if (locked.current) return;
    cancelHold(); setStopArmed(true);
    timer.current = setTimeout(() => { timer.current = null; void run(onStop); }, STOP_HOLD_MS);
  };
  const confirmAccessibleFinish = () => {
    if (locked.current || confirming.current) return;
    cancelHold(); confirming.current = true;
    Alert.alert(copy.finishTitle, copy.finishBody, [
      { text: copy.cancel, style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: copy.finish, style: 'destructive', onPress: () => { confirming.current = false; void run(onStop); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  };
  const primaryLabel = isPaused ? t.ride.actions.resume : t.ride.actions.pause;
  const primaryAction = isPaused ? onResume : onPause;
  return <View style={styles.stack}>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" testID="ride-action-error" style={styles.error}>{copy.actionError}</Text> : null}
    <Pressable testID={isPaused ? resumeTestID : pauseTestID} accessibilityRole="button"
      accessibilityLabel={primaryLabel} accessibilityState={{ disabled: busy || !primaryAction, busy }}
      disabled={busy || !primaryAction} onPress={() => void run(primaryAction)}
      style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.action.primaryPressed : c.action.primary }]}>
      <View testID={isPaused ? 'ride-action-icon-resume-v1' : 'ride-action-icon-pause-v1'} accessible={false}>
        <Text style={[styles.icon, { color: c.text.onAction }]}>{isPaused ? '▶' : 'Ⅱ'}</Text>
      </View>
      <Text style={[styles.label, { color: c.text.onAction }]}>{busy ? copy.busy : primaryLabel}</Text>
    </Pressable>
    <Pressable testID={stopTestID} accessibilityRole="button" accessibilityLabel={t.ride.actions.stopConfirm}
      accessibilityHint={copy.hold} accessibilityState={{ disabled: busy, busy }} disabled={busy}
      onPressIn={startStopHold} onPressOut={cancelHold} onAccessibilityTap={confirmAccessibleFinish}
      accessibilityActions={[{ name: 'activate', label: copy.finish }]}
      onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') confirmAccessibleFinish(); }}
      style={[styles.stop, { borderColor: c.action.destructive }]}>
      <View testID="ride-action-icon-stop-v1" style={[styles.square, { backgroundColor: c.action.destructive }]} />
      <Text style={styles.error}>{stopArmed ? '…' : t.ride.actions.stop}</Text>
      <Text style={styles.hint}>{copy.hold}</Text>
    </Pressable>
  </View>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    stack: { gap: 10 }, primary: { minHeight: 60, padding: 16, borderRadius: 8,
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 },
    stop: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12,
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
    label: { ...PRODUCT_TYPOGRAPHY.bodyMedium }, error: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.status.error },
    hint: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary },
    icon: { fontSize: 22 }, square: { width: 12, height: 12, borderRadius: 2 },
  };
});
