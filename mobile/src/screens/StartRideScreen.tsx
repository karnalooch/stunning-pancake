import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { DevEnvironmentBanner } from '../components/DevEnvironmentBanner';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { PrimaryButton, SportChip } from '../components/product';
import { roadbookCopy } from '../components/roadbook/copy';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { useI18n } from '../i18n/useI18n';
import type { ActivitySportType } from '../services/api';
import type { RideEdgeMessage } from '../services/apiRetry';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { ACTIVITY_SPORT_OPTIONS } from '../types/activitySport';

export type StartRideScreenProps = {
  isRecording: boolean;
  onStartRide: (sport: ActivitySportType) => Promise<void>;
  onGoToRide: () => void;
  onOpenGpsWizard: () => void;
  gpsRecoveryVisible?: boolean;
  gpsRecoveryBusy?: boolean;
  onGpsRecoveryPress?: () => void;
  startRideError?: string | null;
  onDismissStartRideError?: () => void;
  rideEdgeMessage?: RideEdgeMessage | null;
  onDismissRideEdgeMessage?: () => void;
};

export function StartRideScreen({
  isRecording, onStartRide, onGoToRide, onOpenGpsWizard,
  gpsRecoveryVisible = false, gpsRecoveryBusy = false, onGpsRecoveryPress,
  startRideError, onDismissStartRideError, rideEdgeMessage, onDismissRideEdgeMessage,
}: StartRideScreenProps) {
  const s = stylesheet;
  const { t, locale } = useI18n();
  const copy = roadbookCopy[locale === 'pl' ? 'pl' : 'en'];
  const [selectedSport, setSelectedSport] = useState<ActivitySportType>('BIKE');
  const [isStarting, setIsStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleStartRide = async () => {
    // A synchronous lock prevents repeated presses before React has rendered disabled=true.
    if (startingRef.current || isRecording) return;
    startingRef.current = true;
    setIsStarting(true);
    setLocalError(null);
    try {
      await onStartRide(selectedSport);
    } catch {
      if (mountedRef.current) setLocalError(t.errors.startRide);
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setIsStarting(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <DevEnvironmentBanner />
        <View style={s.hero}>
          <Text style={s.eyebrow}>{copy.eyebrow}</Text>
          <Text accessibilityRole="header" style={s.title}>{isRecording ? copy.activeTitle : copy.title}</Text>
          <Text style={s.body}>{isRecording ? copy.activeBody : copy.freeRideBody}</Text>
        </View>
        {rideEdgeMessage && (
          <EdgeStateBanner title={rideEdgeMessage.title} message={rideEdgeMessage.message}
            variant={rideEdgeMessage.variant} onDismiss={onDismissRideEdgeMessage} />
        )}
        {(startRideError || localError) && (
          <EdgeStateBanner title={t.errors.startRide} message={startRideError || localError || t.errors.startRide}
            onDismiss={() => { setLocalError(null); onDismissStartRideError?.(); }} />
        )}
        <GpsRecoveryBanner visible={gpsRecoveryVisible} busy={gpsRecoveryBusy} onPress={() => onGpsRecoveryPress?.()} />
        {!isRecording && (
          <View style={s.section}>
            <Text accessibilityRole="header" style={s.sectionTitle}>{copy.sport}</Text>
            <View style={s.sportRow} accessibilityState={{ busy: isStarting }}>
              {ACTIVITY_SPORT_OPTIONS.map((option) => (
                <SportChip key={option.type} label={locale === 'pl' ? option.labelPl : option.labelEn}
                  selected={selectedSport === option.type}
                  onPress={() => { if (!startingRef.current) setSelectedSport(option.type); }}
                  testID={`start-ride-sport-${option.type.toLowerCase()}`} />
              ))}
            </View>
            <View style={s.sessionKind}>
              <Text style={s.sectionTitle}>{copy.freeRide}</Text>
              <Text style={s.body}>{copy.freeRideBody}</Text>
            </View>
          </View>
        )}
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.sectionTitle}>{copy.location}</Text>
          <Text style={s.body}>{copy.locationBody}</Text>
          <PrimaryButton label={t.dashboard.gpsWizard} onPress={onOpenGpsWizard}
            variant="secondary" testID="start-ride-gps-diagnostics" />
        </View>
      </ScrollView>
      <View style={s.footer}>
        {isRecording ? (
          <PrimaryButton label={t.dashboard.goToRide} onPress={onGoToRide} testID="start-ride-go-live" />
        ) : (
          <>
            <Text style={s.footerNote}>{copy.footer}</Text>
            <PrimaryButton label={isStarting ? t.dashboard.startingRide : t.dashboard.startRide}
              onPress={() => void handleStartRide()} disabled={isStarting} testID="start-ride-primary" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    container: { flex: 1, backgroundColor: c.canvas.background },
    scroll: { flex: 1 }, content: { padding: 24, gap: 28, paddingBottom: 24 },
    hero: { gap: 16, paddingTop: 12, paddingBottom: 8 },
    eyebrow: { ...PRODUCT_TYPOGRAPHY.metricLabel, letterSpacing: 1.2, color: c.text.secondary },
    title: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 44, lineHeight: 50, color: c.text.primary },
    body: { ...PRODUCT_TYPOGRAPHY.body, lineHeight: 25, color: c.text.secondary },
    section: { gap: 16, paddingTop: 20, borderTopWidth: 1, borderColor: c.border.subtle },
    sectionTitle: { ...PRODUCT_TYPOGRAPHY.title, fontSize: 19, lineHeight: 26, color: c.text.primary },
    sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    sessionKind: { borderLeftWidth: 3, borderColor: c.action.primary, paddingLeft: 16, gap: 6, marginTop: 8 },
    footer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 12,
      borderTopWidth: 1, borderColor: c.border.subtle, backgroundColor: c.surface.default },
    footerNote: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary, textAlign: 'center' },
  };
});
