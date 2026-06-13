import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

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
    <View style={[styles.wrap, { borderColor: c.onBackground, backgroundColor: c.surfaceContainer }]}>
      <Text style={[styles.label, { color: c.secondary }]}>
        {label}: {Math.round(clamped)}%
      </Text>
      <View style={[styles.track, { borderColor: c.onBackground, backgroundColor: c.surfaceContainerHigh }]}>
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
  label: {
    fontSize: 10,
    fontWeight: '700',
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
