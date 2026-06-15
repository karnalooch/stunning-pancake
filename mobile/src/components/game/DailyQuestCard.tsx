import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { DailyQuest } from '../../game/quests';
import { PixelIcon } from '../ui/PixelIcon';
import { CURRENCY_ICONS } from '../../assets/tabIcons';
import { TextureBackground } from '../ui/TextureBackground';
import { FONTS } from '../../theme/fonts';

interface DailyQuestCardProps {
  quests: DailyQuest[];
}

export const DailyQuestCard: React.FC<DailyQuestCardProps> = ({ quests }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <TextureBackground
      texture="parchment_grain"
      opacity={0.07}
      style={[styles.card, { borderColor: c.hudOutline, backgroundColor: c.parchment }]}
    >
      <Text style={[styles.header, { color: c.primary, fontFamily: FONTS.display }]}>Daily Quests</Text>
      {quests.map((q) => {
        const pct = q.completed ? 100 : Math.min(100, (q.progress / q.target) * 100);
        return (
          <View key={q.id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[styles.title, { color: c.onBackground, fontFamily: FONTS.display }]}>
                {q.completed ? '✓ ' : ''}{q.title}
              </Text>
              <View style={styles.rewardRow}>
                <PixelIcon source={CURRENCY_ICONS.xp} size={12} baseSize={16} />
                <Text style={[styles.reward, { color: c.secondary, fontFamily: 'VT323', fontSize: 14 }]}>
                  +{q.xpReward}
                </Text>
              </View>
            </View>
            <Text style={[styles.desc, { color: c.outline }]}>{q.description}</Text>
            <View style={[styles.track, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainerHigh }]}>
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
    </TextureBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  header: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 8, flex: 1 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reward: { textTransform: 'uppercase' },
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
