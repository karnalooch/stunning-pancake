import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../../i18n/useI18n';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface RideStatusBarProps {
  gpsLocked: boolean;
  /** 0–100 when known */
  batteryPct?: number | null;
}

function formatClock(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatBatteryPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const clamped = Math.max(0, Math.min(100, value));
  return `${Math.round(clamped)}%`;
}

export const RideStatusBar: React.FC<RideStatusBarProps> = ({
  gpsLocked,
  batteryPct = null,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  const gpsLabel = gpsLocked ? t.ride.status.gpsLocked : t.ride.status.gpsSearching;
  const gpsColor = gpsLocked ? semantic.ride.gpsLocked : semantic.status.warning;
  const batteryLabel = formatBatteryPct(batteryPct);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.hudPanel,
          borderColor: c.hudOutline,

        },
      ]}
    >
      <View style={styles.segment}>
        <View style={[styles.gpsDot, { backgroundColor: gpsColor, borderColor: c.hudOutline }]} />
        <Text
          style={[styles.text, styles.gpsText, { color: c.hudOutline }]}
          allowFontScaling
          numberOfLines={1}
        >
          {gpsLabel}
        </Text>
      </View>
      <Text style={[styles.text, styles.batteryText, { color: c.hudOutline }]} numberOfLines={1}>
        {t.ride.status.battery} {batteryLabel}
      </Text>
      <Text style={[styles.clock, { color: c.hudOutline }]}>
        {clock}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderRadius: 5,
  },
  text: {
    ...PRODUCT_TYPOGRAPHY.metricLabel,
    letterSpacing: 0.2,
  },
  clock: {
    ...PRODUCT_TYPOGRAPHY.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  gpsText: {
    flexShrink: 1,
  },
  batteryText: {
    marginLeft: 8,
    marginRight: 8,
  },
});
