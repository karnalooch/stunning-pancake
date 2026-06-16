import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { AuthService } from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { FONTS } from '../theme/fonts';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { useRiderStats } from '../hooks/useRiderStats';
import { SceneBackground } from '../components/scene/SceneBackground';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { formatRiderDisplayName } from '../utils/displayName';
import { AppHeader } from '../components/ui/AppHeader';
import { RiderAvatar } from '../components/ui/RiderAvatar';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { LAYOUT } from '../theme/layout';
import { AvatarFramed } from '../components/ui/AvatarFramed';
import { LaurelHeader } from '../components/ui/LaurelHeader';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { AchievementGrid } from '../components/game/AchievementGrid';
import { PixelText } from '../components/PixelText';
import { getVisionProfileFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const sh = {
    shadowColor: c.onBackground,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  };
  return {
    sh,
    ct: { flex: 1, backgroundColor: c.background },
    h: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: LAYOUT.gutter,
      borderBottomWidth: 4,
      borderBottomColor: c.onBackground,
      backgroundColor: c.surface,
    },
    hl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    av: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 4,
      borderColor: c.onBackground,
      backgroundColor: c.primaryContainer,
    },
    ht: { fontSize: 16, fontFamily: FONTS.display, color: c.primary, textTransform: 'uppercase' },
    hero: {
      backgroundColor: c.parchment,
      margin: LAYOUT.gutter,
      padding: LAYOUT.gutter,
      borderWidth: 4,
      borderColor: c.onBackground,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: LAYOUT.sectionGap,
      ...sh,
    },
    hi: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 4,
      borderColor: c.onBackground,
      backgroundColor: c.primaryContainer,
    },
    hn: { color: c.onBackground },
    hs: { fontSize: 12, color: c.secondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: LAYOUT.gutter, gap: LAYOUT.compactGap },
    tile: {
      width: '47%',
      padding: 0,
    },
    tl: { fontSize: 10, color: c.secondary, textTransform: 'uppercase' },
    tv: { fontSize: 20, color: c.onBackground, marginTop: 4 },
    btn: {
      backgroundColor: c.primaryContainer,
      padding: LAYOUT.gutter,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: c.onBackground,
      marginHorizontal: LAYOUT.gutter,
      marginBottom: LAYOUT.compactGap,
      alignItems: 'center',
      ...sh,
    },
    btnT: { fontSize: 16, fontFamily: FONTS.display, color: c.onPrimaryContainer },
  };
});

interface Props {
  user?: { username?: string };
  onLogout?: () => void;
  onTraining?: () => void;
  onSettings?: () => void;
  onTrends?: () => void;
  onLeaderboard?: () => void;
}

export const AthleteProfileScreen: React.FC<Props> = ({
  user,
  onLogout,
  onTraining,
  onSettings,
  onTrends,
  onLeaderboard,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const fixturesEnabled = isVisionFixtures();
  const profileFixture = getVisionProfileFixture(fixturesEnabled);
  const { level, xpBar } = useGameProgress();
  const { rides, distanceKm, verified, streakDays, loading: statsLoading, offline } = useRiderStats();
  const [username, setUsername] = useState(profileFixture?.username ?? user?.username ?? 'RIDER');

  useEffect(() => {
    if (fixturesEnabled) return;
    AuthService.getProfile()
      .then((profile) => {
        if (profile?.username) setUsername(profile.username);
      })
      .catch(() => {});
  }, [fixturesEnabled]);

  const displayLevel = profileFixture?.level ?? level;
  const displayXpCurrent = profileFixture?.xpCurrent ?? xpBar.current;
  const displayXpMax = profileFixture?.xpMax ?? xpBar.max;
  const displayDistanceKm = profileFixture?.stats.km ?? distanceKm;
  const displayRides = profileFixture?.stats.rides ?? rides;
  const displayVerified = profileFixture?.stats.kom ?? verified;
  const displayName = formatRiderDisplayName(profileFixture?.username ?? username);
  const displayStatsLoading = fixturesEnabled ? false : statsLoading;
  const displayOffline = fixturesEnabled ? false : offline;
  const displayXpPct = Math.max(0, Math.min(1, displayXpCurrent / Math.max(1, displayXpMax)));

  const achievements = fixturesEnabled
    ? [...(profileFixture?.achievements ?? [])]
    : [
        { id: 'ach_100km', label: '100 KM', unlocked: distanceKm >= 100 },
        { id: 'ach_10rides', label: '10 JAZD', unlocked: rides >= 10 },
        { id: 'ach_500m', label: '500 M', unlocked: distanceKm >= 0.5 },
        { id: 'ach_kom', label: 'KOM', unlocked: verified >= 1 },
        { id: 'ach_5h', label: '5H CZAS', unlocked: rides >= 5 },
        { id: 'ach_endurance', label: 'WYTRWAŁOŚĆ', unlocked: streakDays >= 7 },
        { id: 'ach_1000kcal', label: '1000 KCAL', unlocked: rides >= 8 },
        { id: 'ach_7days', label: '7 DNI', unlocked: streakDays >= 7 },
        { id: 'ach_explorer', label: 'ODKRYWCA', unlocked: distanceKm >= 200 },
        { id: 'ach_passion', label: 'PASJA', unlocked: rides >= 25 },
      ];

  return (
    <View style={s.ct}>
      {immersiveEnabled && <SceneBackground sceneId="profile" scrim="soft" />}
      <AppHeader
        rightAction={{
          icon: 'settings',
          onPress: () => onSettings?.(),
          accessibilityLabel: t.settings.title,
          testID: 'profile-settings-button',
        }}
      >
        <RiderAvatar size={40} />
      </AppHeader>
      <ScrollView>
        {displayOffline ? (
          <EdgeStateBanner
            title={t.errors.network}
            message={t.errors.offlineCache}
            variant="offline"
          />
        ) : null}
        <OrnateFrame style={{ margin: LAYOUT.gutter }} tone="parchment">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: LAYOUT.sectionGap }}>
            <AvatarFramed size={88} />
            <View style={{ flex: 1, gap: 8 }}>
              <PixelText size="xl" style={s.hn} numberOfLines={1}>
                {displayName}
              </PixelText>
              <PixelText size="sm" style={s.hs}>
                {t.profile.warrior.toUpperCase()}
              </PixelText>
              {immersiveEnabled && (
                <LevelXpBar
                  level={displayLevel}
                  xpCurrent={displayXpCurrent}
                  xpMax={displayXpMax}
                  pct={displayXpPct}
                />
              )}
              {immersiveEnabled && (
                <PixelText size="sm" style={[s.hs, { color: c.primary }]}>
                  {streakDays} {t.profile.streakLabel} · {displayRides} {t.profile.rides.toLowerCase()}
                </PixelText>
              )}
            </View>
          </View>
        </OrnateFrame>
        {displayStatsLoading ? (
          <SkeletonBlock height={120} style={{ marginHorizontal: LAYOUT.gutter }} />
        ) : (
        <View style={s.grid}>
          {[
            { l: t.profile.distance, v: `${displayDistanceKm.toLocaleString()} km` },
            { l: t.profile.rides, v: String(displayRides) },
            { l: t.profile.verified, v: String(displayVerified) },
            { l: t.profile.pending, v: String(Math.max(0, displayRides - displayVerified)) },
          ].map((m, i) => (
            <OrnateFrame key={i} style={s.tile} padding={12}>
              <PixelText size="xs" style={s.tl}>{m.l}</PixelText>
              <PixelText size="xl" style={s.tv}>{m.v}</PixelText>
            </OrnateFrame>
          ))}
        </View>
        )}
        <OrnateFrame style={{ marginHorizontal: LAYOUT.gutter, marginBottom: LAYOUT.gutter }} tone="surface">
          <LaurelHeader title={t.settings.achievements} />
          <AchievementGrid items={achievements} />
        </OrnateFrame>
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onTrends?.();
          }}
        >
          <Text style={s.btnT}>{t.settings.trends.toUpperCase()}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onLeaderboard?.();
          }}
        >
          <Text style={s.btnT}>{t.settings.globalLb.toUpperCase()}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onTraining?.();
          }}
        >
          <Text style={s.btnT}>{t.profile.trainingLog}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btn, { backgroundColor: c.error }, pressed && { opacity: 0.8 }]}
          onPress={onLogout}
        >
          <Text style={[s.btnT, { color: c.onError }]}>{t.common.logout.toUpperCase()}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};
