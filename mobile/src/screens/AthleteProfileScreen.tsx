import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { ActivityService, AuthService } from '../services/api';
import { useMobileI18n } from '../i18n/useI18n';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { SceneBackground } from '../components/scene/SceneBackground';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { CyclistSprite } from '../components/sprites/CyclistSprite';

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
      padding: 16,
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
      margin: 16,
      padding: 16,
      borderWidth: 4,
      borderColor: c.onBackground,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 8 },
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
      padding: 16,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: c.onBackground,
      marginHorizontal: 16,
      marginBottom: 8,
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
}

export const AthleteProfileScreen: React.FC<Props> = ({
  user,
  onLogout,
  onTraining,
  onSettings,
}) => {
  const { theme } = useUnistyles();
  const { t } = useMobileI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const { level, xpBar, progression } = useGameProgress();
  const [username, setUsername] = useState(user?.username ?? 'RIDER');
  const [rides, setRides] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [verified, setVerified] = useState(0);

  useEffect(() => {
    AuthService.getProfile()
      .then((p: any) => {
        const d = p?.data ?? p;
        if (d?.username) setUsername(d.username);
      })
      .catch(() => {});
    ActivityService.getHistory()
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        setRides(list.length);
        const dist = list.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000;
        setDistanceKm(Math.round(dist));
        setVerified(list.filter((a) => a.is_verified).length);
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={s.ct} edges={['top']}>
      {immersiveEnabled && <SceneBackground sceneId="profile" scrim="soft" />}
      <View style={[s.h, s.sh]}>
        <View style={s.hl}>
          <View style={s.av} />
          <Text style={s.ht}>{t.profile.title}</Text>
        </View>
        <Pressable onPress={onSettings} hitSlop={12}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </Pressable>
      </View>
      <ScrollView>
        <View style={s.hero}>
          {immersiveEnabled ? <CyclistSprite size={64} state="victory" /> : <View style={s.hi} />}
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.hn}>{username}</Text>
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
                🔥 {progression.streakDays} day streak · {progression.totalRides} rides
              </Text>
            )}
          </View>
        </View>
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
    </SafeAreaView>
  );
};
