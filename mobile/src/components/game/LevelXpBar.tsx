import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { TextureBackground } from '../ui/TextureBackground';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface LevelXpBarProps {
  level: number;
  xpCurrent: number;
  xpMax: number;
  pct: number;
}

export const LevelXpBar: React.FC<LevelXpBarProps> = ({
  level,
  xpCurrent,
  xpMax,
  pct,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <TextureBackground
      texture="parchment_grain"
      opacity={0.04}
      style={[styles.wrap, { borderColor: c.hudOutline, backgroundColor: c.parchment }]}
    >
      <View style={styles.header}>
        <View style={[styles.xpBadge, { backgroundColor: c.primary }]}>
          <Text style={styles.xpBadgeText}>XP</Text>
        </View>
        <Text style={[styles.level, { color: c.primary }]}>LVL {level}</Text>
      </View>
      <View style={[styles.track, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainerHigh }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.primaryFixed }]} />
      </View>
      <Text style={[styles.xp, { color: c.secondary }]}>
        {xpCurrent}/{xpMax} XP
      </Text>
    </TextureBackground>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    minWidth: 120,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  xpBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  xpBadgeText: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: '#0b1620', fontSize: 9 },
  level: { ...PRODUCT_TYPOGRAPHY.metricLabel },
  track: { height: 9, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  xp: { ...PRODUCT_TYPOGRAPHY.metricLabel, textAlign: 'center' },
});
