/**
 * RideSummaryScreen — post-ride celebration (ADR 014 engagement zone).
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { PixelBurst } from '../components/effects/PixelBurst';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { ShareResultCard } from '../components/game/ShareResultCard';
import { SceneBackground } from '../components/scene/SceneBackground';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import {
  computeRideRank,
  formatElapsed,
  rankDisplayName,
  estimateXpGain,
} from '../game/ranks';

const stylesheet = StyleSheet.create((theme) => {
  const C = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: C.background, position: 'relative' as const },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
      borderBottomWidth: 4,
      borderBottomColor: C.onBackground,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: C.primary,
      textTransform: 'uppercase' as const,
    },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, alignItems: 'center' as const },
    titleSection: { alignItems: 'center' as const, paddingTop: 16, paddingBottom: 8 },
    title: {
      fontSize: 40,
      fontWeight: '700',
      color: C.onBackground,
      textTransform: 'uppercase' as const,
      letterSpacing: 2,
      textAlign: 'center' as const,
    },
    subtitle: { fontSize: 16, fontWeight: '500', color: C.outline, marginTop: 4 },
    xpBanner: {
      backgroundColor: C.primaryContainer,
      borderWidth: 3,
      borderColor: C.onBackground,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    xpText: { fontSize: 14, fontWeight: '800', color: C.onPrimaryContainer, textTransform: 'uppercase' as const },
    ctaBtn: {
      backgroundColor: C.goldAmber,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: C.onBackground,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: 'center' as const,
      marginTop: 8,
      width: '100%',
    },
    ctaText: {
      fontSize: 20,
      fontWeight: '700',
      color: C.onBackground,
      textTransform: 'uppercase' as const,
    },
    shadow: {
      shadowColor: C.onBackground,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 8,
    },
  };
});

interface RideSummaryScreenProps {
  distance?: number;
  elapsedSeconds?: number;
  elevation?: number;
  username?: string;
  onShare?: () => void;
  onBackToHub?: () => void;
}

export const RideSummaryScreen: React.FC<RideSummaryScreenProps> = ({
  distance = 0,
  elapsedSeconds = 0,
  elevation = 0,
  username = 'RIDER',
  onShare,
  onBackToHub,
}) => {
  const s = stylesheet;
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const rank = useMemo(() => computeRideRank(distance, elevation), [distance, elevation]);
  const timeLabel = formatElapsed(elapsedSeconds);
  const xpGained = estimateXpGain(distance, elapsedSeconds / 60);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {immersiveEnabled && <SceneBackground sceneId="ride_summary" scrim="soft" />}
      <PixelBurst trigger={immersiveEnabled} />
      <View style={[s.header, s.shadow]}>
        <View style={{ width: 40 }} />
        <Text style={s.headerTitle}>QUEST COMPLETE</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.titleSection}>
          <Text style={s.title}>RIDE COMPLETE</Text>
          <Text style={s.subtitle}>{rankDisplayName(rank)} finish · {distance.toFixed(1)} km</Text>
        </View>
        {immersiveEnabled && <CyclistSprite size={72} state="victory" />}
        <View style={s.xpBanner}>
          <Text style={s.xpText}>+{xpGained} XP earned</Text>
        </View>
        <ShareResultCard
          distanceKm={distance}
          timeLabel={timeLabel}
          elevationM={elevation}
          rank={rank}
          xpGained={xpGained}
          username={username}
        />
        <Pressable
          style={({ pressed }) => [s.ctaBtn, s.shadow, pressed && { transform: [{ translateY: 2 }], opacity: 0.85 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onShare?.();
          }}
        >
          <Text style={s.ctaText}>SHARE RESULT</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.ctaBtn, s.shadow, pressed && { transform: [{ translateY: 2 }], opacity: 0.85 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            onBackToHub?.();
          }}
        >
          <Text style={s.ctaText}>BACK TO HUB</Text>
        </Pressable>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
};
