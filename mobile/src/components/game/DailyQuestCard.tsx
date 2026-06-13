import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { DailyQuest } from '../../game/quests';

interface DailyQuestCardProps {
  quests: DailyQuest[];
}

export const DailyQuestCard: React.FC<DailyQuestCardProps> = ({ quests }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <View style={[styles.card, { borderColor: c.onBackground, backgroundColor: c.parchment }]}>
      <Text style={[styles.header, { color: c.primary }]}>Daily Quests</Text>
      {quests.map((q) => {
        const pct = q.completed ? 100 : Math.min(100, (q.progress / q.target) * 100);
        return (
          <View key={q.id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[styles.title, { color: c.onBackground }]}>
                {q.completed ? '✓ ' : ''}{q.title}
              </Text>
              <Text style={[styles.reward, { color: c.secondary }]}>+{q.xpReward} XP</Text>
            </View>
            <Text style={[styles.desc, { color: c.outline }]}>{q.description}</Text>
            <View style={[styles.track, { borderColor: c.onBackground, backgroundColor: c.surfaceContainerHigh }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor: q.completed ? c.primary : c.primaryFixed,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 4,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '700' },
  reward: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 11 },
  track: {
    height: 8,
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: '100%' },
});
