// Active Ride HUD — bike-computer grid over map (ADR 014 / DESIGN_SYSTEM_MOBILE §3)
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { RideMapView } from '../components/RideMapView';
import { DataFieldGrid } from '../components/ride/DataFieldGrid';
import { RideStatusBar } from '../components/ride/RideStatusBar';
import { RideActionBar } from '../components/ride/RideActionBar';
import { RideNavigationHint } from '../components/ride/RideNavigationHint';
import type { RideMetricsSnapshot } from '../ride/types';
import { useBatteryPct } from '../hooks/useBatteryPct';
import { useI18n } from '../i18n/useI18n';
import { VoiceCueService } from '../services/VoiceCueService';
import { RiderPreferencesService } from '../services/RiderPreferencesService';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: c.hudBackground },
    mapLayer: { ...StyleSheet.absoluteFillObject },
    overlay: {
      flex: 1,
      paddingHorizontal: 12,
      paddingBottom: 12,
      justifyContent: 'space-between',
    },
    top: { paddingTop: 4, gap: 8 },
    bottom: { gap: 10 },
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
  routeCoordinates?: [number, number][];
  navigationCueText?: string | null;
  navigationCueDistanceM?: number | null;
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
  routeCoordinates = [],
  navigationCueText = null,
  navigationCueDistanceM = null,
  gpsRecoveryVisible = false,
  gpsRecoveryBusy = false,
  onGpsRecoveryPress,
}) => {
  const s = stylesheet;
  const { t, locale } = useI18n();
  const batteryPct = useBatteryPct(true);
  const speedKmh = liveSpeed * 3.6;
  const cyclistState =
    speedKmh >= 35 ? 'attack' : speedKmh >= 15 ? 'cruise' : 'idle';
  const gpsLocked = liveCoord != null && !gpsRecoveryVisible;
  const didMountRef = useRef(false);

  useEffect(() => {
    VoiceCueService.setLanguage(locale === 'pl' ? 'pl-PL' : 'en-US');
    VoiceCueService.setEnabled(RiderPreferencesService.isVoiceCuesEnabled());
  }, [locale]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (gpsRecoveryVisible) {
      void VoiceCueService.speak(t.gps.recovery);
    }
  }, [gpsRecoveryVisible, t.gps.recovery]);

  useEffect(() => {
    if (isPaused) {
      void VoiceCueService.speak(t.ride.paused.title);
    }
  }, [isPaused, t.ride.paused.title]);

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
        <RideMapView
          userCoordinate={liveCoord}
          cyclistState={cyclistState}
          routeCoordinates={routeCoordinates}
        />
      </View>
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <View style={s.top}>
          <RideStatusBar gpsLocked={gpsLocked} batteryPct={batteryPct} />
          <RideNavigationHint
            text={navigationCueText}
            distanceM={navigationCueDistanceM}
          />
          <GpsRecoveryBanner
            visible={gpsRecoveryVisible}
            busy={gpsRecoveryBusy}
            onPress={() => onGpsRecoveryPress?.()}
          />
          <DataFieldGrid metrics={metrics} hudMode />
        </View>
        <View style={s.bottom}>
          <RideActionBar
            isPaused={isPaused}
            onPause={() => onPause?.()}
            onResume={() => onResume?.()}
            onStop={() => onStop?.()}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};
