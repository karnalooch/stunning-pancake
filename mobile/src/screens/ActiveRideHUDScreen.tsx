import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { RideMapView } from '../components/RideMapView';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { RideNavigationHint } from '../components/ride/RideNavigationHint';
import { RideActionBar, type RideAction } from '../components/ride/RideActionBar';
import { RideStatusBar } from '../components/ride/RideStatusBar';
import { RidePausedScreen } from './RidePausedScreen';
import { useBatteryPct } from '../hooks/useBatteryPct';
import { useI18n } from '../i18n/useI18n';
import { VoiceCueService } from '../services/VoiceCueService';
import { RiderPreferencesService } from '../services/RiderPreferencesService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { getAppCopy } from '../components/roadbook/appCopy';
import { elapsedLabel, metricNumber } from '../components/roadbook/summaryPresentation';
import { isMapCoordinate } from '../map/routeGeometry';

export interface ActiveRideHUDProps {
  user?: unknown; onPause?: RideAction; onResume?: RideAction; onStop?: RideAction; onOpenHub?: () => void;
  isPaused?: boolean; liveSpeed?: number; liveDistanceKm?: number; liveElevationGainM?: number;
  liveElapsedS?: number; liveCoord?: [number, number] | null; routeCoordinates?: [number, number][];
  navigationCueText?: string | null; navigationCueDistanceM?: number | null;
  gpsRecoveryVisible?: boolean; gpsRecoveryBusy?: boolean; onGpsRecoveryPress?: () => void;
}
/** View mode belongs to presentation; all live values and transitions belong to the same caller-owned session. */
export const ActiveRideHUDScreen: React.FC<ActiveRideHUDProps> = ({
  onPause, onResume, onStop, onOpenHub, isPaused = false, liveSpeed = 0, liveDistanceKm = 0,
  liveElevationGainM = 0, liveElapsedS = 0, liveCoord = null, routeCoordinates = [],
  navigationCueText = null, navigationCueDistanceM = null, gpsRecoveryVisible = false,
  gpsRecoveryBusy = false, onGpsRecoveryPress,
}) => {
  const [mode, setMode] = useState<'map' | 'instrument'>('map');
  const { t, locale } = useI18n();
  const c = getAppCopy(locale);
  const batteryPct = useBatteryPct(true);
  const didMountRef = useRef(false);
  useEffect(() => {
    VoiceCueService.setLanguage(locale === 'pl' ? 'pl-PL' : 'en-US');
    VoiceCueService.setEnabled(RiderPreferencesService.isVoiceCuesEnabled());
  }, [locale]);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (gpsRecoveryVisible) void VoiceCueService.speak(t.gps.recovery);
  }, [gpsRecoveryVisible, t.gps.recovery]);
  useEffect(() => { if (isPaused) void VoiceCueService.speak(t.ride.paused.title); }, [isPaused, t.ride.paused.title]);
  const average = liveElapsedS > 0 ? liveDistanceKm / liveElapsedS * 3600 : null;
  const stop: RideAction = onStop ?? (() => false);
  return <SafeAreaView testID="active-ride-screen" style={styles.page} edges={['top', 'bottom']}>
    <View style={styles.body} accessibilityElementsHidden={isPaused} importantForAccessibility={isPaused ? 'no-hide-descendants' : 'auto'}>
      <View style={styles.top}>
        <View style={styles.toolbar}>
          {onOpenHub ? <Pressable testID="ride-open-hub" accessibilityRole="button" accessibilityLabel={c.home}
            onPress={onOpenHub} style={styles.back}><Text style={styles.caption}>‹ {c.ride}</Text></Pressable> : null}
          <View style={styles.switcher}>
            {(['map', 'instrument'] as const).map((value) => <Pressable key={value} testID={`ride-view-${value}`}
              accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)}
              style={[styles.mode, mode === value && styles.selected]}><Text style={styles.caption}>{c[value]}</Text></Pressable>)}
          </View>
        </View>
        <RideStatusBar gpsLocked={isMapCoordinate(liveCoord) && !gpsRecoveryVisible} batteryPct={batteryPct} />
        <RideNavigationHint text={navigationCueText} distanceM={navigationCueDistanceM} />
        <GpsRecoveryBanner visible={gpsRecoveryVisible} busy={gpsRecoveryBusy} onPress={() => onGpsRecoveryPress?.()} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {mode === 'map' ? <View testID="active-ride-map" style={styles.map}>
          <RideMapView userCoordinate={liveCoord} routeCoordinates={routeCoordinates} />
        </View> : null}
        <View testID="active-ride-metrics" style={styles.metrics}>
          <Text style={styles.caption}>{c.speed} · km/h</Text>
          <Text testID="ride-live-speed" style={[styles.speed, mode === 'instrument' && styles.instrumentSpeed]}>{metricNumber(liveSpeed * 3.6)}</Text>
          <View style={styles.secondary}>
            <View style={styles.cell}><Text style={styles.caption}>{c.distance}</Text><Text testID="ride-live-distance" style={styles.value}>{metricNumber(liveDistanceKm)} km</Text></View>
            <View style={styles.cell}><Text style={styles.caption}>{c.duration}</Text><Text testID="ride-live-time" style={styles.value}>{elapsedLabel(liveElapsedS)}</Text></View>
          </View>
          {mode === 'instrument' ? <View style={styles.secondary}>
            <View style={styles.cell}><Text style={styles.caption}>{c.elevation}</Text><Text style={styles.value}>{metricNumber(liveElevationGainM, 0)} m</Text></View>
            <View style={styles.cell}><Text style={styles.caption}>{c.average}</Text><Text style={styles.value}>{metricNumber(average)} km/h</Text></View>
          </View> : null}
        </View>
      </ScrollView>
      {!isPaused ? <View style={styles.controls}><RideActionBar isPaused={false} onPause={onPause} onStop={stop} /></View> : null}
    </View>
    {isPaused ? <RidePausedScreen onResume={onResume ?? (() => false)} onStop={stop} /> : null}
  </SafeAreaView>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    page: { flex: 1, backgroundColor: c.canvas.background }, body: { flex: 1 }, top: { paddingHorizontal: 16, gap: 8 },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    back: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 8 },
    switcher: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end' },
    mode: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderBottomWidth: 2, borderColor: c.border.subtle },
    selected: { borderColor: c.action.primary, backgroundColor: c.surface.raised },
    scroll: { flex: 1 }, content: { flexGrow: 1 }, map: { height: 260, minHeight: 180, marginTop: 12 },
    metrics: { padding: 24, gap: 6 }, caption: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary },
    speed: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 62, lineHeight: 72, color: c.text.primary, fontVariant: ['tabular-nums'] },
    instrumentSpeed: { fontSize: 88, lineHeight: 102 },
    secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 18 },
    cell: { flexBasis: 120, flexGrow: 1, gap: 6 },
    value: { ...PRODUCT_TYPOGRAPHY.title, fontSize: 25, lineHeight: 34, color: c.text.primary, fontVariant: ['tabular-nums'] },
    controls: { padding: 16, borderTopWidth: 1, borderColor: c.border.subtle, backgroundColor: c.surface.default },
  };
});
