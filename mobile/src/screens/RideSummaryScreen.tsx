/**
 * RideSummaryScreen — truthful post-ride result with optional Grand Prix celebration.
 */

import React, { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { ParticleSystem } from '../components/effects/ParticleSystem';
import { FinishCelebration } from '../components/game/FinishCelebration';
import { ShareResultCard } from '../components/game/ShareResultCard';
import { Metric, PrimaryButton, ProductCard } from '../components/product';
import { SceneBackground } from '../components/scene/SceneBackground';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import {
  isDurableRideSuccess,
  type RideFinishState,
} from '../features/ride/model/RideFinishState';
import {
  computeRideRank,
  estimateXpGain,
  formatElapsed,
  rankDisplayName,
} from '../game/ranks';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useI18n } from '../i18n/useI18n';
import { getSemanticColors } from '../theme/semantic';
import {
  BRAND_TYPOGRAPHY,
  PRODUCT_TYPOGRAPHY,
} from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
      position: 'relative' as const,
    },
    header: {
      minHeight: 60,
      justifyContent: 'center' as const,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    headerTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    celebrationHeader: {
      alignItems: 'center' as const,
      gap: 10,
      paddingVertical: 8,
    },
    resultTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
      textAlign: 'center' as const,
    },
    resultSubtitle: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      textAlign: 'center' as const,
    },
    rankBadge: {
      minWidth: 80,
      alignItems: 'center' as const,
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: semantic.selection.border,
      backgroundColor: semantic.selection.background,
    },
    rankLetter: {
      ...BRAND_TYPOGRAPHY.displayPixel,
      fontSize: 28,
      lineHeight: 34,
      color: semantic.selection.content,
    },
    rankName: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase' as const,
    },
    metricsRow: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    metricCell: {
      flex: 1,
      minWidth: 0,
    },
    xpText: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.secondary,
    },
    stateCard: {
      gap: 12,
    },
    stateTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    stateBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
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
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const summary = finishState.summary;
  const distance = summary?.distanceKm ?? 0;
  const elapsedSeconds = summary?.elapsedS ?? 0;
  const elevation = summary?.elevationGainM ?? 0;
  const durableSuccess = isDurableRideSuccess(finishState);
  const rank = useMemo(
    () => computeRideRank(distance, elevation),
    [distance, elevation],
  );
  const timeLabel = formatElapsed(elapsedSeconds);
  const xpGained = estimateXpGain(distance, elapsedSeconds / 60);

  useEffect(() => {
    if (!durableSuccess) return;
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }, [durableSuccess]);

  const goBackHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onBackToHub?.();
  };

  return (
    <SafeAreaView
      testID="ride-summary-screen"
      style={s.container}
      edges={['top', 'bottom']}
    >
      {immersiveEnabled && durableSuccess ? (
        <SceneBackground sceneId="ride_summary" scrim="soft" />
      ) : null}
      <ParticleSystem trigger={immersiveEnabled && durableSuccess} />

      <View style={s.header}>
        <Text style={s.headerTitle}>{t.summary.title}</Text>
      </View>

      {durableSuccess ? <FinishCelebration /> : null}

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {durableSuccess ? (
          <>
            <View
              style={s.celebrationHeader}
              testID="ride-summary-durable-success"
            >
              <Text style={s.resultTitle}>{t.summary.title}</Text>
              <Text style={s.resultSubtitle}>
                {rankDisplayName(rank)} {t.summary.subtitle}
              </Text>
              <View style={s.rankBadge}>
                <Text style={s.rankLetter}>{rank}</Text>
                <Text style={s.rankName}>{rankDisplayName(rank)}</Text>
              </View>
              {immersiveEnabled ? (
                <CyclistSprite
                  size={72}
                  state="victory"
                  expressionMode
                />
              ) : null}
            </View>

            <ProductCard variant="raised" testID="ride-summary-metrics">
              <View style={s.metricsRow}>
                <View style={s.metricCell}>
                  <Metric
                    value={`${distance.toFixed(1)} km`}
                    label={t.share.distance}
                  />
                </View>
                <View style={s.metricCell}>
                  <Metric value={timeLabel} label={t.share.time} />
                </View>
                <View style={s.metricCell}>
                  <Metric
                    value={`${Math.round(elevation)} m`}
                    label={t.share.elev}
                  />
                </View>
              </View>
              {xpGained > 0 ? (
                <Text style={s.xpText}>+{xpGained} XP</Text>
              ) : null}
            </ProductCard>

            <ShareResultCard
              distanceKm={distance}
              timeLabel={timeLabel}
              elevationM={elevation}
              rank={rank}
              xpGained={xpGained}
              username={username}
            />

            <PrimaryButton
              label={t.summary.share}
              testID="ride-summary-share"
              onPress={() => {
                Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Medium,
                ).catch(() => {});
                onShare?.();
              }}
            />
          </>
        ) : (
          <ProductCard
            variant="raised"
            testID={`ride-summary-${finishState.kind}`}
          >
            <View style={s.stateCard}>
              <Text style={s.stateTitle}>
                {finishState.kind === 'pending-finalization'
                  ? t.rideMessages.stopPending
                  : t.rideMessages.stopError}
              </Text>
              <Text style={s.stateBody}>
                {finishState.kind === 'pending-finalization'
                  ? t.rideMessages.stopPendingBody
                  : t.rideMessages.stopErrorBody}
              </Text>
              {summary ? (
                <View style={s.metricsRow}>
                  <View style={s.metricCell}>
                    <Metric
                      value={`${distance.toFixed(1)} km`}
                      label={t.share.distance}
                    />
                  </View>
                  <View style={s.metricCell}>
                    <Metric value={timeLabel} label={t.share.time} />
                  </View>
                  <View style={s.metricCell}>
                    <Metric
                      value={`${Math.round(elevation)} m`}
                      label={t.share.elev}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </ProductCard>
        )}

        <PrimaryButton
          label={t.summary.backToHub}
          variant={durableSuccess ? 'secondary' : 'primary'}
          testID="ride-summary-back-home"
          onPress={goBackHome}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
