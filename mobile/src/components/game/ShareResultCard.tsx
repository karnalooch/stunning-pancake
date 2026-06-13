import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { CyclistSprite } from '../sprites/CyclistSprite';
import type { RideRank } from '../../game/ranks';
import { rankDisplayName } from '../../game/ranks';

export interface ShareResultCardProps {
  distanceKm: number;
  timeLabel: string;
  elevationM: number;
  rank: RideRank;
  xpGained?: number;
  username?: string;
}

/** Compact pixel-art card optimized for view-shot sharing. */
export const ShareResultCard: React.FC<ShareResultCardProps> = ({
  distanceKm,
  timeLabel,
  elevationM,
  rank,
  xpGained,
  username = 'RIDER',
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <View style={[styles.card, { borderColor: c.onBackground, backgroundColor: c.parchment }]}>
      <Text style={[styles.brand, { color: c.primary }]}>4VELO · CYKLO-QUEST</Text>
      <View style={styles.heroRow}>
        <CyclistSprite size={56} state="victory" />
        <View style={styles.rankBox}>
          <Text style={[styles.rankLabel, { color: c.secondary }]}>RANK</Text>
          <Text style={[styles.rankLetter, { color: c.goldAmber }]}>{rank}</Text>
          <Text style={[styles.rankName, { color: c.onBackground }]}>{rankDisplayName(rank)}</Text>
        </View>
      </View>
      <Text style={[styles.rider, { color: c.onBackground }]}>{username}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary }]}>Distance</Text>
          <Text style={[styles.statValue, { color: c.onBackground }]}>{distanceKm.toFixed(1)} km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary }]}>Time</Text>
          <Text style={[styles.statValue, { color: c.onBackground }]}>{timeLabel}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary }]}>Elev</Text>
          <Text style={[styles.statValue, { color: c.onBackground }]}>{Math.round(elevationM)} m</Text>
        </View>
      </View>
      {xpGained != null && xpGained > 0 && (
        <Text style={[styles.xp, { color: c.primary }]}>+{xpGained} XP</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 4,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: '100%',
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  rankBox: { alignItems: 'center' },
  rankLabel: { fontSize: 10, fontWeight: '700' },
  rankLetter: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  rankName: { fontSize: 12, fontWeight: '700' },
  rider: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  xp: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
