import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

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
    <View style={[styles.wrap, { borderColor: c.onBackground, backgroundColor: c.parchment }]}>
      <Text style={[styles.level, { color: c.primary }]}>LVL {level}</Text>
      <View style={[styles.track, { borderColor: c.onBackground, backgroundColor: c.surfaceContainerHigh }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.primaryFixed }]} />
      </View>
      <Text style={[styles.xp, { color: c.secondary }]}>
        {xpCurrent}/{xpMax} XP
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 3,
    borderRadius: 8,
    padding: 8,
    gap: 4,
    minWidth: 120,
  },
  level: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  track: {
    height: 10,
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  xp: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
