import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../../i18n/useI18n';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';

interface RideActionBarProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const STOP_HOLD_MS = 900;

export const RideActionBar: React.FC<RideActionBarProps> = ({
  isPaused,
  onPause,
  onResume,
  onStop,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stopArmed, setStopArmed] = useState(false);

  const clearStopTimer = () => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    setStopArmed(false);
  };

  const startStopHold = () => {
    clearStopTimer();
    setStopArmed(true);
    HapticService.trigger('button_press');
    stopTimer.current = setTimeout(() => {
      setStopArmed(false);
      void SoundService.play('ui_confirm');
      HapticService.trigger('error');
      onStop();
    }, STOP_HOLD_MS);
  };

  const pixelShadow = {
    shadowColor: c.hudOutline,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  };

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: c.error,
            borderColor: c.hudOutline,
            flex: 1,
            ...pixelShadow,
          },
          stopArmed && { backgroundColor: c.tertiaryContainer },
          pressed && { opacity: 0.9 },
        ]}
        onPressIn={startStopHold}
        onPressOut={clearStopTimer}
        accessibilityRole="button"
        accessibilityLabel={t.ride.actions.stopConfirm}
      >
        <Text style={[styles.icon, { color: c.onError }]}>■</Text>
        <Text style={[styles.label, { color: c.onError, fontFamily: 'PressStart2P' }]} allowFontScaling>
          {stopArmed ? '…' : t.ride.actions.stop}
        </Text>
      </Pressable>

      {isPaused ? (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: c.primaryContainer,
              borderColor: c.hudOutline,
              flex: 1,
              ...pixelShadow,
            },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => {
            HapticService.trigger('button_press');
            void SoundService.play('ui_confirm');
            onResume();
          }}
        >
          <Text style={[styles.icon, { color: c.onBackground }]}>▶</Text>
          <Text style={[styles.label, { color: c.onBackground, fontFamily: 'PressStart2P' }]}>
            {t.ride.actions.resume}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: c.goldAmber,
              borderColor: c.hudOutline,
              flex: 1,
              ...pixelShadow,
            },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => {
            HapticService.trigger('button_press');
            void SoundService.play('ui_click');
            onPause();
          }}
          testID="ride-pause-button"
          accessibilityRole="button"
          accessibilityLabel={t.ride.actions.pause}
        >
          <Text style={[styles.icon, { color: c.hudOutline }]}>❚❚</Text>
          <Text style={[styles.label, { color: c.hudOutline, fontFamily: 'PressStart2P' }]}>
            {t.ride.actions.pause}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    borderWidth: 2,
    borderRadius: 8,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
