import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { CyclistSprite } from '../sprites/CyclistSprite';
import { PixelIcon } from '../ui/PixelIcon';
import { GRADE_ICONS, CURRENCY_ICONS } from '../../assets/tabIcons';
import { TextureBackground } from '../ui/TextureBackground';
import type { RideRank } from '../../game/ranks';
import { rankDisplayName } from '../../game/ranks';
import { useI18n } from '../../i18n/useI18n';
import { FONTS } from '../../theme/fonts';

/** Portrait share card target (1080×1920 capture via view-shot). */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;
/** On-screen preview width; captureRef scales to SHARE_CARD_WIDTH. */
export const SHARE_CARD_PREVIEW_WIDTH = 360;

export interface ShareResultCardProps {
  distanceKm: number;
  timeLabel: string;
  elevationM: number;
  rank: RideRank;
  xpGained?: number;
  username?: string;
  /** When true, sizes card for high-res snapshot export. */
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
    <TextureBackground
      texture="wood_grain"
      opacity={0.08}
      style={[
        styles.card,
        {
          borderColor: c.hudOutline,
          backgroundColor: c.parchment,
          width,
          minHeight: captureMode ? SHARE_CARD_HEIGHT : undefined,
          padding: 16 * scale,
          gap: 12 * scale,
          borderWidth: 2 * scale,
          borderRadius: 12 * scale,
        },
      ]}
    >
      <Text
        style={[
          styles.brand,
          {
            color: c.primary,
            fontFamily: FONTS.display,
            fontSize: 11 * scale,
          },
        ]}
      >
        4VELO · CYKLO-QUEST
      </Text>
      <View style={[styles.heroRow, { gap: 24 * scale }]}>
        <CyclistSprite size={56 * scale} state="victory" expressionMode />
        <View style={styles.rankBox}>
          <Text style={[styles.rankLabel, { color: c.secondary, fontFamily: FONTS.display, fontSize: 10 * scale }]}>
            {t.share.rank}
          </Text>
          <PixelIcon source={GRADE_ICONS[rank]} size={48 * scale} baseSize={32} />
          <Text style={[styles.rankName, { color: c.onBackground, fontFamily: FONTS.display, fontSize: 12 * scale }]}>
            {rankDisplayName(rank)}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.rider,
          {
            color: c.onBackground,
            fontFamily: FONTS.display,
            fontSize: 16 * scale,
          },
        ]}
      >
        {username}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontFamily: FONTS.display, fontSize: 9 * scale }]}>
            {t.share.distance}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontFamily: 'VT323', fontSize: 22 * scale }]}>
            {distanceKm.toFixed(1)} km
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontFamily: FONTS.display, fontSize: 9 * scale }]}>
            {t.share.time}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontFamily: 'VT323', fontSize: 22 * scale }]}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.secondary, fontFamily: FONTS.display, fontSize: 9 * scale }]}>
            {t.share.elev}
          </Text>
          <Text style={[styles.statValue, { color: c.onBackground, fontFamily: 'VT323', fontSize: 22 * scale }]}>
            {Math.round(elevationM)} m
          </Text>
        </View>
      </View>
      {xpGained != null && xpGained > 0 && (
        <View style={styles.xpRow}>
          <PixelIcon source={CURRENCY_ICONS.xp} size={16 * scale} baseSize={16} />
          <Text style={[styles.xp, { color: c.primary, fontFamily: 'VT323', fontSize: 18 * scale }]}>
            +{xpGained} XP
          </Text>
        </View>
      )}
    </TextureBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  brand: {
    textAlign: 'center',
    letterSpacing: 1,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  rankBox: { alignItems: 'center', gap: 4 },
  rankLabel: { textTransform: 'uppercase' },
  rankName: { textTransform: 'uppercase' },
  rider: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { textTransform: 'uppercase' },
  statValue: { marginTop: 4 },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  xp: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
