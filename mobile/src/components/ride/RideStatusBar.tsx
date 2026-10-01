import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../../i18n/useI18n';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';
import { getAppCopy } from '../roadbook/appCopy';

interface RideStatusBarProps {
  gpsLocked: boolean;
  batteryPct?: number | null;
  clockText?: string;
}
function formatClock(date: Date): string { return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function formatBatteryPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}
export const RideStatusBar: React.FC<RideStatusBarProps> = ({ gpsLocked, batteryPct = null, clockText }) => {
  const { theme } = useUnistyles();
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const c = getSemanticColors(theme.colors);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    if (clockText !== undefined) return;
    const id = setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => clearInterval(id);
  }, [clockText]);
  return <View style={styles.bar}>
    <Text style={[styles.label, { color: gpsLocked ? c.text.primary : c.status.warning }]}
      accessibilityHint={copy.locationNote}>{gpsLocked ? copy.location : copy.locationUnknown}</Text>
    <Text style={styles.label}>{t.ride.status.battery} {formatBatteryPct(batteryPct)}</Text>
    <Text style={styles.clock}>{clockText ?? clock}</Text>
  </View>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border.subtle, backgroundColor: c.canvas.background },
    label: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary, flexShrink: 1 },
    clock: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.primary, fontVariant: ['tabular-nums'] },
  };
});
