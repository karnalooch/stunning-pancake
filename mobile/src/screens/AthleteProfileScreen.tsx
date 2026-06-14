import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { AuthService } from '../services/api';
import { useMobileI18n } from '../i18n/useI18n';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { useRiderStats } from '../hooks/useRiderStats';
import { SceneBackground } from '../components/scene/SceneBackground';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { formatRiderDisplayName } from '../utils/displayName';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { AppHeader } from '../components/ui/AppHeader';
import { GameCard } from '../components/ui/GameCard';
import { RiderAvatar } from '../components/ui/RiderAvatar';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { LAYOUT } from '../theme/layout';

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
    ht: { fontSize: 20, fontWeight: '700', color: c.primary, textTransform: 'uppercase' },
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
    hn: { fontSize: 24, fontWeight: '700', color: c.onBackground },
    hs: { fontSize: 14, color: c.secondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: LAYOUT.gutter, gap: LAYOUT.compactGap },
    tile: {
      width: '47%',
      backgroundColor: c.parchment,
      padding: 12,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
      ...sh,
    },
    tl: { fontSize: 10, fontWeight: '700', color: c.secondary, textTransform: 'uppercase' },
    tv: { fontSize: 22, fontWeight: '700', color: c.onBackground, marginTop: 4 },
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
    btnT: { fontSize: 16, fontWeight: '700', color: c.onPrimaryContainer },
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
  const { t } = useMobileI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const { level, xpBar } = useGameProgress();
  const { rides, distanceKm, verified, streakDays, loading: statsLoading, offline } = useRiderStats();
  const [username, setUsername] = useState(user?.username ?? 'RIDER');

  useEffect(() => {
    AuthService.getProfile()
      .then((profile) => {
        if (profile?.username) setUsername(profile.username);
      })
      .catch(() => {});
  }, []);

  return (
    <View style={s.ct}>
      {immersiveEnabled && <SceneBackground sceneId="profile" scrim="soft" />}
      <AppHeader
        rightAction={{
          icon: 'settings',
          onPress: () => onSettings?.(),
          accessibilityLabel: t.settings.title,
        }}
      >
        <RiderAvatar size={40} />
      </AppHeader>
      <ScrollView>
        {offline ? (
          <EdgeStateBanner
            title={t.errors.network}
            message={t.errors.offlineCache}
            variant="offline"
          />
        ) : null}
        <GameCard
          style={{ margin: LAYOUT.gutter, flexDirection: 'row', alignItems: 'center', gap: LAYOUT.sectionGap }}
          texture="wood_grain"
        >
          {immersiveEnabled ? <CyclistSprite size={64} state="victory" /> : <View style={s.hi} />}
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.hn} numberOfLines={1}>{formatRiderDisplayName(username)}</Text>
            <Text style={s.hs}>{t.profile.warrior.toUpperCase()}</Text>
            {immersiveEnabled && (
              <LevelXpBar
                level={level}
                xpCurrent={xpBar.current}
                xpMax={xpBar.max}
                pct={xpBar.pct}
              />
            )}
            {immersiveEnabled && (
              <Text style={[s.hs, { color: c.primary }]}>
                {streakDays} {t.profile.streakLabel} · {rides} {t.profile.rides.toLowerCase()}
              </Text>
            )}
          </View>
        </GameCard>
        {statsLoading ? (
          <SkeletonBlock height={120} style={{ marginHorizontal: LAYOUT.gutter }} />
        ) : (
        <View style={s.grid}>
          {[
            { l: t.profile.distance, v: `${distanceKm.toLocaleString()} km` },
            { l: t.profile.rides, v: String(rides) },
            { l: t.profile.verified, v: String(verified) },
            { l: t.profile.pending, v: String(Math.max(0, rides - verified)) },
          ].map((m, i) => (
            <View key={i} style={s.tile}>
              <Text style={s.tl}>{m.l}</Text>
              <Text style={s.tv}>{m.v}</Text>
            </View>
          ))}
        </View>
        )}
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
