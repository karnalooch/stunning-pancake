/**
 * RideSummaryScreen — post-ride result surface (ADR 014 engagement zone).
 *
 * Frozen UI v1.2 keeps the Grand Prix celebration in durable-success only;
 * routine result data and actions use modern product chrome.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { ShareResultCard } from '../components/game/ShareResultCard';
import {
  Metric,
  PrimaryButton,
  ProductCard,
} from '../components/product';
import {
  computeRideRank,
  formatElapsed,
  rankDisplayName,
  estimateXpGain,
} from '../game/ranks';
import { useI18n } from '../i18n/useI18n';
import { APPROVED_ASSETS } from '../assets/approvedAssets';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import {
  isDurableRideSuccess,
  type RideFinishState,
} from '../features/ride/model/RideFinishState';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 56,
      justifyContent: 'center' as const,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
      backgroundColor: semantic.surface.default,
    },
    headerTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      fontSize: 20,
      lineHeight: 26,
      color: semantic.text.primary,
      textAlign: 'center' as const,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    finishArt: {
      width: '100%',
      height: 156,
      borderRadius: 18,
      overflow: 'hidden' as const,
      backgroundColor: semantic.surface.raised,
    },
    finishImage: {
      width: '100%',
      height: '100%',
    },
    successIntro: {
      gap: 4,
    },
    successEyebrow: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.status.success,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    successTitle: {
      ...PRODUCT_TYPOGRAPHY.displayEditorial,
      color: semantic.text.primary,
    },
    rankRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 16,
    },
    rankCopy: {
      flex: 1,
      gap: 4,
    },
    rankLabel: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    rankName: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    rankBadge: {
      minWidth: 64,
      minHeight: 64,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: semantic.selection.border,
      backgroundColor: semantic.selection.background,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    rankLetter: {
      ...PRODUCT_TYPOGRAPHY.displayEditorial,
      color: semantic.selection.content,
    },
    metricsRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
    },
    metricCell: {
      flex: 1,
    },
    statusCard: {
      gap: 12,
    },
    statusLabelPending: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.status.warning,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
    },
    statusLabelRecovery: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.status.error,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
    },
    statusTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    actions: {
      gap: 12,
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

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onShare?.();
  }, [onShare]);

  const handleBackToHub = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onBackToHub?.();
  }, [onBackToHub]);

  return (
    <SafeAreaView testID="ride-summary-screen" style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t.summary.title}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {durableSuccess ? (
          <>
            <View style={s.finishArt} testID="summary-finish-v1">
              <Image
                source={APPROVED_ASSETS.summaryFinish}
                resizeMode="cover"
                style={s.finishImage}
              />
            </View>

            <View style={s.successIntro} testID="ride-summary-durable-success">
              <Text style={s.successEyebrow}>{t.summary.subtitle}</Text>
              <Text style={s.successTitle}>{distance.toFixed(1)} km</Text>
            </View>

            <ProductCard variant="raised" testID="ride-summary-rank-card">
              <View style={s.rankRow}>
                <View style={s.rankCopy}>
                  <Text style={s.rankLabel}>{t.share.rank}</Text>
                  <Text style={s.rankName}>{rankDisplayName(rank)}</Text>
                </View>
                <View style={s.rankBadge}>
                  <Text style={s.rankLetter}>{rank}</Text>
                </View>
              </View>
            </ProductCard>

            <ProductCard testID="ride-summary-metrics">
              <View style={s.metricsRow}>
                <View style={s.metricCell}>
                  <Metric
                    value={`${distance.toFixed(1)} km`}
                    label={t.share.distance}
                    testID="ride-summary-distance"
                  />
                </View>
                <View style={s.metricCell}>
                  <Metric
                    value={timeLabel}
                    label={t.share.time}
                    testID="ride-summary-time"
                  />
                </View>
                <View style={s.metricCell}>
                  <Metric
                    value={`${Math.round(elevation)} m`}
                    label={t.share.elev}
                    testID="ride-summary-elevation"
                  />
                </View>
              </View>
            </ProductCard>

            <ShareResultCard
              distanceKm={distance}
              timeLabel={timeLabel}
              elevationM={elevation}
              rank={rank}
              xpGained={xpGained}
              username={username}
            />

            <View style={s.actions}>
              <PrimaryButton
                label={t.summary.share}
                variant="secondary"
                testID="ride-summary-share"
                onPress={handleShare}
              />
            </View>
          </>
        ) : (
          <ProductCard
            variant="raised"
            testID={`ride-summary-${finishState.kind}`}
          >
            <View style={s.statusCard}>
              <Text
                style={
                  finishState.kind === 'pending-finalization'
                    ? s.statusLabelPending
                    : s.statusLabelRecovery
                }
              >
                {finishState.kind === 'pending-finalization'
                  ? t.rideMessages.stopPending
                  : t.rideMessages.stopError}
              </Text>
              <Text style={s.statusTitle}>
                {finishState.kind === 'pending-finalization'
                  ? t.rideMessages.stopPendingBody
                  : t.rideMessages.stopErrorBody}
              </Text>
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
            </View>
          </ProductCard>
        )}

        <View style={s.actions}>
          <PrimaryButton
            label={t.summary.backToHub}
            testID="ride-summary-back-home"
            onPress={handleBackToHub}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
