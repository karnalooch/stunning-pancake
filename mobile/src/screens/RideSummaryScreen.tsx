/**
 * RideSummaryScreen — post-ride celebration (ADR 014 engagement zone).
 */

import React, { useEffect, useMemo } from 'react';
import { Image, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { ShareResultCard } from '../components/game/ShareResultCard';
import {
  computeRideRank,
  formatElapsed,
  rankDisplayName,
  estimateXpGain,
} from '../game/ranks';
import { useI18n } from '../i18n/useI18n';
import { FONTS } from '../theme/fonts';
import { APPROVED_ASSETS } from '../assets/approvedAssets';
import {
  isDurableRideSuccess,
  type RideFinishState,
} from '../features/ride/model/RideFinishState';

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
      fontSize: 18,
      fontFamily: FONTS.display,
      color: C.primary,
      textTransform: 'uppercase' as const,
    },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, alignItems: 'center' as const },
    finishArt: {
      width: '100%',
      height: 156,
      borderRadius: 18,
      overflow: 'hidden',
      marginTop: 4,
    },
    titleSection: { alignItems: 'center' as const, paddingTop: 8, paddingBottom: 8, gap: 8 },
    title: {
      fontSize: 36,
      fontFamily: FONTS.display,
      color: C.onBackground,
      textTransform: 'uppercase' as const,
      letterSpacing: 2,
      textAlign: 'center' as const,
    },
    subtitle: { fontSize: 14, fontFamily: FONTS.display, color: C.outline, marginTop: 4 },
    gradeBadge: {
      minWidth: 88,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 3,
      borderColor: C.hudOutline,
      backgroundColor: C.goldAmber,
      alignItems: 'center' as const,
    },
    gradeText: {
      fontSize: 28,
      fontFamily: FONTS.display,
      color: C.hudOutline,
      textTransform: 'uppercase' as const,
    },
    xpBanner: {
      backgroundColor: C.primaryContainer,
      borderWidth: 3,
      borderColor: C.onBackground,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    xpText: { fontSize: 14, fontFamily: FONTS.display, color: C.onPrimaryContainer, textTransform: 'uppercase' as const },
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
      fontSize: 18,
      fontFamily: FONTS.display,
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
  finishState: RideFinishState;
  username?: string;
  onShare?: () => void;
  onBackToHub?: () => void;
}

export const RideSummaryScreen: React.FC<RideSummaryScreenProps> = ({
  finishState,
  username = 'RIDER',
  onShare,
  onBackToHub,
}) => {
  const s = stylesheet;
  const { t } = useI18n();
  const summary = finishState.summary;
  const distance = summary?.distanceKm ?? 0;
  const elapsedSeconds = summary?.elapsedS ?? 0;
  const elevation = summary?.elevationGainM ?? 0;
  const durableSuccess = isDurableRideSuccess(finishState);
  const rank = useMemo(() => computeRideRank(distance, elevation), [distance, elevation]);
  const timeLabel = formatElapsed(elapsedSeconds);
  const xpGained = estimateXpGain(distance, elapsedSeconds / 60);

  useEffect(() => {
    if (!durableSuccess) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [durableSuccess]);

  return (
    <SafeAreaView testID="ride-summary-screen" style={s.container} edges={['top']}>
      <View style={[s.header, s.shadow]}>
        <View style={{ width: 40 }} />
        <Text style={s.headerTitle}>{t.summary.title.toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {durableSuccess ? (
          <>
            <View style={s.finishArt} testID="summary-finish-v1">
              <Image
                source={APPROVED_ASSETS.summaryFinish}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
            <View style={s.titleSection} testID="ride-summary-durable-success">
              <Text style={s.subtitle}>{rankDisplayName(rank)} {t.summary.subtitle} · {distance.toFixed(1)} km</Text>
              <View style={[s.gradeBadge, s.shadow]}>
                <Text style={s.gradeText}>{rank}</Text>
              </View>

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
              testID="ride-summary-share"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onShare?.();
              }}
            >
              <Text style={s.ctaText}>{t.summary.share}</Text>
            </Pressable>
          </>
        ) : (
          <View
            style={s.titleSection}
            testID={`ride-summary-${finishState.kind}`}
          >
            <Text style={s.subtitle}>
              {finishState.kind === 'pending-finalization'
                ? t.rideMessages.stopPending
                : t.rideMessages.stopError}
            </Text>
            <Text style={s.subtitle}>
              {finishState.kind === 'pending-finalization'
                ? t.rideMessages.stopPendingBody
                : t.rideMessages.stopErrorBody}
            </Text>
            <Text style={s.subtitle}>
              {distance.toFixed(1)} km · {timeLabel} · {elevation.toFixed(0)} m
            </Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, s.shadow, pressed && { transform: [{ translateY: 2 }], opacity: 0.85 }]}
          testID="ride-summary-back-home"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            onBackToHub?.();
          }}
        >
          <Text style={s.ctaText}>{t.summary.backToHub}</Text>
        </Pressable>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
};
