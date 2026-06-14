import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelIcon } from '../ui/PixelIcon';
import { CURRENCY_ICONS } from '../../assets/tabIcons';

interface EnergyBarProps {
  /** 0–100 */
  value: number;
  label?: string;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({ value, label = 'Energy' }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const clamped = Math.max(0, Math.min(100, value));
  const fillColor =
    clamped > 50 ? c.primaryFixed : clamped > 25 ? c.goldAmber : c.tertiaryContainer;

  return (
    <View style={[styles.wrap, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainer }]}>
      <View style={styles.labelRow}>
        <PixelIcon source={CURRENCY_ICONS.energy} size={14} baseSize={16} />
        <Text style={[styles.label, { color: c.secondary, fontFamily: 'PressStart2P' }]}>
          {label}: {Math.round(clamped)}%
        </Text>
      </View>
      <View style={[styles.track, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainerHigh }]}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderRadius: 6,
    padding: 8,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 8,
    textTransform: 'uppercase',
  },
  track: {
    height: 12,
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
