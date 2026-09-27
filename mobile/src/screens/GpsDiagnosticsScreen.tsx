/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { StyleSheet } from 'react-native-unistyles';

import { PrimaryButton } from '../components/product/PrimaryButton';
import { ProductCard } from '../components/product/ProductCard';
import {
  getGpsSyncStatus,
  isRideTrackingActive,
  runManualGpsRecovery,
} from '../services/GpsSyncManager';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

type CheckItem = {
  key: string;
  label: string;
  ok: boolean;
  details: string;
};

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      gap: 4,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    subtitle: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 48,
      gap: 10,
    },
    cardContent: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      flexShrink: 1,
    },
    details: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    badge: {
      minWidth: 72,
      minHeight: 32,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeOk: {
      borderColor: semantic.status.success,
    },
    badgeFail: {
      borderColor: semantic.status.error,
    },
    badgeText: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
    },
    badgeTextOk: {
      color: semantic.status.success,
    },
    badgeTextFail: {
      color: semantic.status.error,
    },
    help: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    actions: {
      gap: 10,
      marginTop: 6,
    },
  };
});

export const GpsDiagnosticsScreen: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const s = stylesheet;
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

  const needsHelp = checks.some((check) => !check.ok);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>GPS Diagnostics</Text>
        <Text style={s.subtitle}>Green = healthy, red = action required</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {checks.map((check) => (
          <ProductCard key={check.key}>
            <View style={s.cardContent}>
              <View style={s.row}>
                <Text style={s.label}>{check.label}</Text>
                <View style={[s.badge, check.ok ? s.badgeOk : s.badgeFail]}>
                  <Text style={[s.badgeText, check.ok ? s.badgeTextOk : s.badgeTextFail]}>
                    {check.ok ? 'HEALTHY' : 'ACTION'}
                  </Text>
                </View>
              </View>
              <Text style={s.details}>{check.details}</Text>
            </View>
          </ProductCard>
        ))}

        {needsHelp ? (
          <ProductCard variant="raised">
            <Text style={s.help}>
              If checks stay red, open the GPS/battery help material and retry diagnostics.
            </Text>
          </ProductCard>
        ) : null}

        <View style={s.actions}>
          <PrimaryButton
            label={loading ? 'CHECKING…' : 'REFRESH CHECKS'}
            onPress={() => void refresh()}
            disabled={loading || recovering}
          />
          <PrimaryButton
            label={recovering ? 'RECOVERING…' : 'RUN GPS RECOVERY'}
            onPress={() => {
              setRecovering(true);
              void runManualGpsRecovery().finally(() => {
                setRecovering(false);
                void refresh();
              });
            }}
            variant="secondary"
            disabled={loading || recovering}
          />
          {onClose ? (
            <PrimaryButton label="CLOSE" onPress={onClose} variant="secondary" />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
