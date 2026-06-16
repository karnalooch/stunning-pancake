import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ArcadeButton } from '../components/ArcadeButton';
import { FONTS } from '../theme/fonts';
import {
  getGpsSyncStatus,
  isRideTrackingActive,
  runManualGpsRecovery,
} from '../services/GpsSyncManager';

type CheckItem = {
  key: string;
  label: string;
  ok: boolean;
  details: string;
};

const stylesheet = StyleSheet.create((theme) => {
  const C = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: C.background },
    header: {
      padding: 16,
      borderBottomWidth: 4,
      borderBottomColor: C.onBackground,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontSize: 16, fontFamily: FONTS.display, color: C.primary, textTransform: 'uppercase' },
    subtitle: { color: C.secondary, marginTop: 4, fontFamily: FONTS.display },
    card: {
      borderWidth: 3,
      borderColor: C.onBackground,
      backgroundColor: C.parchment,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 14, fontFamily: FONTS.display, color: C.onBackground },
    details: { fontSize: 12, color: C.secondary, marginTop: 6 },
    badgeOk: {
      backgroundColor: C.primaryContainer,
      borderWidth: 2,
      borderColor: C.onBackground,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeFail: {
      backgroundColor: C.errorContainer,
      borderWidth: 2,
      borderColor: C.onBackground,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    content: { padding: 16, paddingBottom: 48 },
    faqHint: { marginTop: 8, color: C.secondary, fontSize: 12, fontFamily: FONTS.display },
  };
});

export const GpsDiagnosticsScreen: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const C = theme.colors as Record<string, string>;
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      const updatesRunning = await Location.hasStartedLocationUpdatesAsync('BACKGROUND_LOCATION_TASK');
      const sync = getGpsSyncStatus();
      const trackingActive = isRideTrackingActive();

      const nextChecks: CheckItem[] = [
        {
          key: 'fg',
          label: 'Foreground permission',
          ok: fg.status === 'granted',
          details: `status=${fg.status}`,
        },
        {
          key: 'bg',
          label: 'Background permission',
          ok: bg.status === 'granted',
          details: `status=${bg.status}`,
        },
        {
          key: 'tracking',
          label: 'Background tracking task',
          ok: updatesRunning || !trackingActive,
          details: updatesRunning
            ? 'BACKGROUND_LOCATION_TASK active'
            : trackingActive
              ? 'tracking flagged active, but task not running'
              : 'idle ride session',
        },
        {
          key: 'outbox',
          label: 'Outbox / pending GPS',
          ok: sync.pendingPoints === 0,
          details: `${sync.pendingPoints} pending point(s)`,
        },
        {
          key: 'ingest',
          label: 'Telemetry ingest status',
          ok: !sync.ingestPaused,
          details: sync.ingestPaused
            ? `paused until ${new Date(sync.pauseUntil).toLocaleTimeString()}`
            : 'active',
        },
      ];
      setChecks(nextChecks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsHelp = checks.some((c) => !c.ok);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>GPS Diagnostics</Text>
          <Text style={s.subtitle}>Green = healthy, Red = action required</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {checks.map((check) => (
          <View key={check.key} style={s.card}>
            <View style={s.row}>
              <Text style={s.label}>{check.label}</Text>
              <Text style={check.ok ? s.badgeOk : s.badgeFail}>
                {check.ok ? 'GREEN' : 'RED'}
              </Text>
            </View>
            <Text style={s.details}>{check.details}</Text>
          </View>
        ))}

        {needsHelp && (
          <Text style={s.faqHint}>
            If checks stay RED, open campaign FAQ (GPS/battery) from GTM materials and retry diagnostics.
          </Text>
        )}

        <View style={{ marginTop: 16, gap: 10 }}>
          <ArcadeButton
            label={loading ? 'CHECKING...' : 'REFRESH CHECKS'}
            onPress={() => void refresh()}
            variant="primary"
          />
          <ArcadeButton
            label={recovering ? 'RECOVERING...' : 'RUN GPS RECOVERY'}
            onPress={() => {
              setRecovering(true);
              runManualGpsRecovery()
                .finally(() => setRecovering(false))
                .then(() => void refresh());
            }}
            variant="success"
          />
          <Pressable
            onPress={onClose}
            style={{
              borderWidth: 3,
              borderColor: C.onBackground,
              backgroundColor: C.surface,
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: FONTS.display, color: C.onBackground }}>CLOSE</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
