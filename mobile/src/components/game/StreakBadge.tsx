import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface StreakBadgeProps {
  days: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ days }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <View style={[styles.wrap, { borderColor: c.onBackground, backgroundColor: c.goldAmber }]}>
      <Text style={styles.emoji}>🔥</Text>
      <View>
        <Text style={[styles.value, { color: c.onBackground }]}>{days}</Text>
        <Text style={[styles.label, { color: c.onBackground }]}>DAY STREAK</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emoji: { fontSize: 22 },
  value: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  label: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
});
