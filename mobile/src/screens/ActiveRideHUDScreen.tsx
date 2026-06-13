// Active Ride HUD — bike-computer grid over map (ADR 014 / DESIGN_SYSTEM_MOBILE §3)
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { RideMapView } from '../components/RideMapView';
import { DataFieldGrid } from '../components/ride/DataFieldGrid';
import { EnergyBar } from '../components/effects/EnergyBar';
import { SpeechBubble } from '../components/narration/SpeechBubble';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import type { RideMetricsSnapshot } from '../ride/types';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const sh = {
    shadowColor: c.onBackground,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  };
  return {
    container: { flex: 1, backgroundColor: c.hudBackground },
    mapLayer: { ...StyleSheet.absoluteFillObject },
    overlay: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: 16,
      justifyContent: 'space-between',
    },
    top: { paddingTop: 8, gap: 8 },
    actions: { gap: 8 },
    pauseBtn: {
      backgroundColor: c.goldAmber,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: c.onBackground,
      paddingVertical: 14,
      alignItems: 'center',
      ...sh,
    },
    resumeBtn: {
      backgroundColor: c.primaryContainer,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: c.onBackground,
      paddingVertical: 12,
      alignItems: 'center',
      ...sh,
    },
    stopBtn: {
      backgroundColor: c.errorContainer ?? c.tertiaryContainer,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: c.onBackground,
      paddingVertical: 12,
      alignItems: 'center',
      ...sh,
    },
    actionText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.onBackground,
      textTransform: 'uppercase',
    },
    stopText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.onError ?? c.onBackground,
      textTransform: 'uppercase',
    },
  };
});

interface Props {
  user?: unknown;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  isPaused?: boolean;
  liveSpeed?: number;
  liveDistanceKm?: number;
  liveElevationGainM?: number;
  liveElapsedS?: number;
  liveCoord?: [number, number] | null;
  gpsRecoveryVisible?: boolean;
  gpsRecoveryBusy?: boolean;
  onGpsRecoveryPress?: () => void;
}

export const ActiveRideHUDScreen: React.FC<Props> = ({
  onPause,
  onResume,
  onStop,
  isPaused = false,
  liveSpeed = 0,
  liveDistanceKm = 0,
  liveElevationGainM = 0,
  liveElapsedS = 0,
  liveCoord = null,
  gpsRecoveryVisible = false,
  gpsRecoveryBusy = false,
  onGpsRecoveryPress,
}) => {
  const s = stylesheet;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const speedKmh = liveSpeed * 3.6;
  const cyclistState =
    speedKmh >= 35 ? 'attack' : speedKmh >= 15 ? 'cruise' : 'idle';
  const energy = Math.max(15, 100 - Math.min(85, liveElapsedS / 60));
  const showLudicrous = immersiveEnabled && speedKmh >= 32;

  const metrics: RideMetricsSnapshot = useMemo(() => {
    const avgSpeedKmh =
      liveElapsedS > 0 ? (liveDistanceKm / liveElapsedS) * 3600 : null;
    return {
      speedMs: liveSpeed,
      distanceKm: liveDistanceKm,
      avgSpeedKmh,
      elapsedSeconds: liveElapsedS,
      heartRateBpm: null,
      elevationGainM: liveElevationGainM,
      headingDeg: null,
      gpsPending: gpsRecoveryVisible,
    };
  }, [
    liveSpeed,
    liveDistanceKm,
    liveElapsedS,
    liveElevationGainM,
    gpsRecoveryVisible,
  ]);

  return (
    <View style={s.container}>
      <View style={s.mapLayer}>
        <RideMapView userCoordinate={liveCoord} cyclistState={cyclistState} />
      </View>
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <View style={s.top}>
          <GpsRecoveryBanner
            visible={gpsRecoveryVisible}
            busy={gpsRecoveryBusy}
            onPress={() => onGpsRecoveryPress?.()}
          />
          {immersiveEnabled && (
            <>
              <SpeechBubble text={showLudicrous ? 'LUDICROUS SPEED!' : ''} />
              <EnergyBar value={energy} />
            </>
          )}
          <DataFieldGrid metrics={metrics} />
        </View>
        <View style={s.actions}>
          {isPaused ? (
            <Pressable
              style={({ pressed }) => [s.resumeBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onResume?.();
              }}
            >
              <Text style={s.actionText}>▶ Resume</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [s.pauseBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
                onPause?.();
              }}
            >
              <Text style={s.actionText}>⏸ Pause</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [s.stopBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onStop?.();
            }}
          >
            <Text style={s.stopText}>■ Stop</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};
