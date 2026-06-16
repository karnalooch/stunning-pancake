import React, { useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../../i18n/useI18n';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { FONTS } from '../../theme/fonts';
import { HUD_ACTION_ICONS } from '../../assets/visionAssets';

interface RideActionBarProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const STOP_HOLD_MS = 900;

type ActionIcon = 'stop' | 'play' | 'pause';

const RideActionIcon: React.FC<{ type: ActionIcon; color: string }> = ({ type, color }) => {
  const source = HUD_ACTION_ICONS[type];
  if (source) {
    return <Image source={source} style={{ width: 18, height: 18 }} resizeMode="contain" />;
  }
  // Pixel glif fallback — replaced by PNG asset once generated
  if (type === 'stop') {
    return <View style={{ width: 12, height: 12, backgroundColor: color, borderWidth: 1, borderColor: color }} />;
  }
  if (type === 'pause') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <View style={{ width: 4, height: 12, backgroundColor: color }} />
        <View style={{ width: 4, height: 12, backgroundColor: color }} />
      </View>
    );
  }
  return (
    <View style={{ justifyContent: 'center', gap: 1 }}>
      <View style={{ width: 4, height: 2, backgroundColor: color }} />
      <View style={{ width: 6, height: 2, backgroundColor: color }} />
      <View style={{ width: 8, height: 2, backgroundColor: color }} />
      <View style={{ width: 10, height: 2, backgroundColor: color }} />
    </View>
  );
};

export const RideActionBar: React.FC<RideActionBarProps> = ({
  isPaused,
  onPause,
  onResume,
  onStop,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const onError = c.onError ?? '#FFFFFF';
  const onBackground = c.onBackground ?? '#0B1D33';
  const hudOutline = c.hudOutline ?? '#0B1D33';
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
        <RideActionIcon type="stop" color={onError} />
        <Text style={[styles.label, { color: onError, fontFamily: FONTS.display }]} allowFontScaling>
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
          <RideActionIcon type="play" color={onBackground} />
          <Text style={[styles.label, { color: onBackground, fontFamily: FONTS.display }]}>
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
          <RideActionIcon type="pause" color={hudOutline} />
          <Text style={[styles.label, { color: hudOutline, fontFamily: FONTS.display }]}>
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
    borderRadius: 0,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
