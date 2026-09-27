import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { DailyQuest } from '../../game/quests';
import { TextureBackground } from '../ui/TextureBackground';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface DailyQuestCardProps {
  quests: DailyQuest[];
}

export const DailyQuestCard: React.FC<DailyQuestCardProps> = ({ quests }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <TextureBackground
      texture="parchment_grain"
      opacity={0.04}
      style={[styles.card, { borderColor: c.hudOutline, backgroundColor: c.parchment }]}
    >
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
            <View style={[styles.track, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainerHigh }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: q.completed ? c.primary : c.primaryFixed },
                ]}
              />
            </View>
          </View>
        );
      })}
    </TextureBackground>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  header: { ...PRODUCT_TYPOGRAPHY.bodyMedium, textTransform: 'uppercase' },
  row: { gap: 5 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...PRODUCT_TYPOGRAPHY.metricLabel, flex: 1 },
  reward: { ...PRODUCT_TYPOGRAPHY.metricLabel },
  desc: { ...PRODUCT_TYPOGRAPHY.body, fontSize: 11 },
  track: { height: 8, borderWidth: 1, borderRadius: 5, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%' },
});
