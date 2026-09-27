import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { APPROVED_ASSETS } from '../../assets/approvedAssets';
import type { RideRank } from '../../game/ranks';
import { rankDisplayName } from '../../game/ranks';
import { useI18n } from '../../i18n/useI18n';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;
export const SHARE_CARD_PREVIEW_WIDTH = 360;

export interface ShareResultCardProps {
  distanceKm: number;
  timeLabel: string;
  elevationM: number;
  rank: RideRank;
  xpGained?: number;
  username?: string;
  captureMode?: boolean;
}

export const ShareResultCard: React.FC<ShareResultCardProps> = ({
  distanceKm,
  timeLabel,
  elevationM,
  rank,
  xpGained,
  username = 'RIDER',
  captureMode = false,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const scale = captureMode ? SHARE_CARD_WIDTH / SHARE_CARD_PREVIEW_WIDTH : 1;
  const width = captureMode ? SHARE_CARD_WIDTH : '100%';

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: c.hudOutline,
          backgroundColor: c.surfaceContainerLow ?? c.parchment,
          width,
          minHeight: captureMode ? SHARE_CARD_HEIGHT : undefined,
          padding: 16 * scale,
          gap: 14 * scale,
          borderWidth: 1 * scale,
          borderRadius: 16 * scale,
        },
      ]}
    >
      <Text style={[styles.brand, { color: c.primary, fontSize: 12 * scale }]}>
        4VELO
      </Text>

      <View style={[styles.heroRow, { gap: 22 * scale }]}>
        <Image
          source={APPROVED_ASSETS.riderCanonical}
          resizeMode="cover"
          style={[styles.riderArt, { width: 70 * scale, height: 92 * scale, borderRadius: 12 * scale }]}
          testID="share-rider-canonical-v1"
        />
        <View style={styles.rankBox}>
          <Text style={[styles.rankLabel, { color: c.secondary, fontSize: 10 * scale }]}>
            {t.share.rank}
          </Text>
          <View style={[styles.rankBadge, { backgroundColor: c.primaryContainer, borderColor: c.primary }]}>
            <Text style={[styles.rankLetter, { color: c.onPrimaryContainer, fontSize: 28 * scale }]}>
              {rank}
            </Text>
          </View>
          <Text style={[styles.rankName, { color: c.onBackground, fontSize: 11 * scale }]}>
            {rankDisplayName(rank)}
          </Text>
        </View>
      </View>

      <Text style={[styles.rider, { color: c.onBackground, fontSize: 16 * scale }]}>
        {username}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontSize: 9 * scale }]}>
            {t.share.distance}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontSize: 20 * scale }]}>
            {distanceKm.toFixed(1)} km
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontSize: 9 * scale }]}>
            {t.share.time}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontSize: 20 * scale }]}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontSize: 9 * scale }]}>
            {t.share.elev}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontSize: 20 * scale }]}>
            {Math.round(elevationM)} m
          </Text>
        </View>
      </View>

      {xpGained != null && xpGained > 0 ? (
        <View style={[styles.xpPill, { backgroundColor: c.primaryContainer }]}>
          <Text style={[styles.xp, { color: c.onPrimaryContainer, fontSize: 13 * scale }]}>
            +{xpGained} XP
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  brand: { ...PRODUCT_TYPOGRAPHY.bodyMedium, textAlign: 'center', letterSpacing: 1.2 },
  heroRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 },
  riderArt: { overflow: 'hidden' },
  rankBox: { alignItems: 'center', gap: 5 },
  rankLabel: { ...PRODUCT_TYPOGRAPHY.metricLabel, textTransform: 'uppercase' },
  rankBadge: {
    minWidth: 52,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLetter: { ...PRODUCT_TYPOGRAPHY.displayEditorial },
  rankName: { ...PRODUCT_TYPOGRAPHY.metricLabel, textTransform: 'uppercase' },
  rider: { ...PRODUCT_TYPOGRAPHY.bodyMedium, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { ...PRODUCT_TYPOGRAPHY.metricLabel, textTransform: 'uppercase' },
  statValue: { ...PRODUCT_TYPOGRAPHY.bodyMedium, marginTop: 4 },
  xpPill: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  xp: { ...PRODUCT_TYPOGRAPHY.bodyMedium },
});
