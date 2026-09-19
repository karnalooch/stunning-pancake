/**
 * Authenticated 4VELO Home / pre-ride dashboard.
 *
 * Frozen UI v1.2: product-first chrome, truthful activity history and a
 * dominant ride action. Approved Home artwork is intentionally not wired
 * until asset governance approves rider_canonical_v1 + home_hero_day_v1.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native-unistyles';

import { DevEnvironmentBanner } from '../components/DevEnvironmentBanner';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { PlatformNoticeBanner } from '../components/PlatformNoticeBanner';
import {
  Metric,
  PrimaryButton,
  ProductCard,
  SportChip,
} from '../components/product';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import {
  getVisionHomePreviewState,
  getVisionProfileFixture,
  getVisionRideDashboardFixture,
  isVisionFixtures,
  type VisionHomePreviewState,
} from '../bootstrap/visionFixtures';
import { useGameProgress } from '../hooks/useGameProgress';
import { usePlatformNotices } from '../hooks/usePlatformNotices';
import { useRiderStats } from '../hooks/useRiderStats';
import { useI18n } from '../i18n/useI18n';
import type { RideEdgeMessage } from '../services/apiRetry';
import type { ActivitySportType } from '../services/api';
import { ACTIVITY_SPORT_OPTIONS } from '../types/activitySport';
import { formatRiderDisplayName } from '../utils/displayName';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { BRAND_TYPOGRAPHY, PRODUCT_TYPOGRAPHY } from '../theme/typography';

const WEEK_DAYS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEK_DAYS_PL = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 68,
      paddingHorizontal: LAYOUT.gutter,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    riderContext: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.selection.background,
      borderWidth: 1,
      borderColor: semantic.selection.border,
    },
    avatarText: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.selection.content,
    },
    riderCopy: {
      flex: 1,
      gap: 1,
    },
    riderName: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    riderPlace: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
    },
    settingsButton: {
      minHeight: 44,
      minWidth: 76,
      paddingHorizontal: 12,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.surface.default,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
    },
    settingsPressed: {
      backgroundColor: semantic.surface.interactive,
      borderColor: semantic.border.strong,
    },
    settingsLabel: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
    },
    heroContent: {
      gap: 16,
    },
    heroArtSlot: {
      height: 104,
      borderRadius: 14,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: semantic.navigation.shell,
      borderWidth: 1,
      borderColor: semantic.border.strong,
    },
    heroBrand: {
      ...BRAND_TYPOGRAPHY.displayPixel,
      fontSize: 28,
      lineHeight: 34,
      color: semantic.navigation.active,
      letterSpacing: 2,
    },
    heroAccent: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 6,
      backgroundColor: semantic.progress.primary,
    },
    heroCopy: {
      gap: 4,
    },
    heroEyebrow: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
    },
    heroTitle: {
      ...PRODUCT_TYPOGRAPHY.displayEditorial,
      color: semantic.text.primary,
    },
    heroBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    sportRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionStack: {
      gap: 8,
    },
    activeMetricRow: {
      flexDirection: 'row',
      gap: 20,
      paddingVertical: 4,
    },
    activeMetricCell: {
      flex: 1,
    },
    section: {
      gap: 8,
    },
    sectionHeader: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 18,
      lineHeight: 24,
      color: semantic.text.primary,
    },
    cardContent: {
      gap: 12,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 20,
    },
    metricCell: {
      flex: 1,
    },
    emptyTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    emptyBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    errorTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.error,
    },
    errorBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    weeklyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
    },
    weeklyChart: {
      height: 72,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    weeklyDay: {
      flex: 1,
      gap: 4,
      alignItems: 'center',
    },
    weeklyTrack: {
      flex: 1,
      width: '100%',
      borderRadius: 5,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: semantic.surface.interactive,
    },
    weeklyFill: {
      width: '100%',
      borderRadius: 5,
      backgroundColor: semantic.progress.primary,
    },
    weeklyLabel: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      fontSize: 11,
      lineHeight: 14,
      color: semantic.text.secondary,
    },
    bottomInset: {
      height: LAYOUT.tabBarBottomInset,
    },
  };
});

export type HomePreviewState = VisionHomePreviewState;

interface RideDashboardScreenProps {
  user: { username: string; tenant_name?: string; tenant_id?: string } | null;
  onStartRide?: (sport: ActivitySportType) => void;
  onGoToRide?: () => void;
  isRecording?: boolean;
  liveSpeed?: number;
  liveDistance?: number;
  gpsRecoveryVisible?: boolean;
  gpsRecoveryBusy?: boolean;
  onGpsRecoveryPress?: () => void;
  onOpenGpsWizard?: () => void;
  onOpenSettings?: () => void;
  startRideError?: string | null;
  onDismissStartRideError?: () => void;
  rideEdgeMessage?: RideEdgeMessage | null;
  onDismissRideEdgeMessage?: () => void;
  previewState?: HomePreviewState;
}

export const RideDashboardScreen: React.FC<RideDashboardScreenProps> = observer(({
  user,
  onStartRide,
  onGoToRide,
  isRecording = false,
  liveSpeed = 0,
  liveDistance = 0,
  gpsRecoveryVisible = false,
  gpsRecoveryBusy = false,
  onGpsRecoveryPress,
  onOpenGpsWizard,
  onOpenSettings,
  startRideError,
  onDismissStartRideError,
  rideEdgeMessage,
  onDismissRideEdgeMessage,
  previewState,
}) => {
  const s = stylesheet;
  const { t, locale } = useI18n();
  const fixturesEnabled = isVisionFixtures();
  const rideFixture = getVisionRideDashboardFixture(fixturesEnabled);
  const profileFixture = getVisionProfileFixture(fixturesEnabled);
  const [selectedSport, setSelectedSport] = useState<ActivitySportType>('BIKE');
  const { notice, dismiss } = usePlatformNotices(user?.tenant_id ?? null);
  const { onStartRide: trackQuestStart } = useGameProgress();
  const {
    latest: latestRide,
    weeklyBars,
    weeklyDistanceKm,
    loading: statsLoading,
    offline: statsOffline,
    error: statsError,
    refresh: refreshStats,
  } = useRiderStats();

  const displayName = formatRiderDisplayName(profileFixture?.username ?? user?.username);
  const riderInitial = displayName.trim().charAt(0).toUpperCase() || '4';
  const riderPlace = user?.tenant_name?.trim() || '4VELO';
  const weekDays = locale === 'pl' ? WEEK_DAYS_PL : WEEK_DAYS_EN;

  const effectivePreviewState = fixturesEnabled
    ? (previewState ?? getVisionHomePreviewState(true) ?? 'default')
    : null;
  const forceEmpty = effectivePreviewState === 'empty';

  const displayStatsLoading = effectivePreviewState
    ? effectivePreviewState === 'loading'
    : statsLoading;
  const displayStatsOffline = effectivePreviewState
    ? effectivePreviewState === 'offline'
    : statsOffline;
  const displayStatsError = effectivePreviewState
    ? effectivePreviewState === 'error'
    : statsError;
  const displayWeeklyBars = forceEmpty
    ? [0, 0, 0, 0, 0, 0, 0]
    : fixturesEnabled
      ? [0.52, 0.64, 0.47, 0.88, 0.72, 0.58, 0.41]
      : weeklyBars;
  const displayWeeklyDistanceKm = forceEmpty
    ? 0
    : fixturesEnabled
      ? (rideFixture?.weekDistanceKm ?? 128.7)
      : weeklyDistanceKm;
  const lastRideDistanceKm = forceEmpty
    ? null
    : fixturesEnabled
      ? 42.3
      : latestRide
        ? Math.max(0, latestRide.distance ?? 0) / 1000
        : null;
  const lastRideDuration = forceEmpty
    ? null
    : fixturesEnabled
      ? '01:42:00'
      : latestRide?.duration ?? null;

  const handleStartRide = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    trackQuestStart();
    onStartRide?.(selectedSport);
  }, [onStartRide, selectedSport, trackQuestStart]);

  const handleGoToRide = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onGoToRide?.();
  }, [onGoToRide]);

  const handleOpenSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onOpenSettings?.();
  }, [onOpenSettings]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={s.riderContext}>
          <View style={s.avatar} accessibilityElementsHidden>
            <Text style={s.avatarText}>{riderInitial}</Text>
          </View>
          <View style={s.riderCopy}>
            <Text style={s.riderName} numberOfLines={1}>{displayName}</Text>
            <Text style={s.riderPlace} numberOfLines={1}>{riderPlace}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.settings.title}
          onPress={handleOpenSettings}
          hitSlop={8}
          style={({ pressed }) => [
            s.settingsButton,
            pressed && s.settingsPressed,
          ]}
        >
          <Text style={s.settingsLabel}>{t.settings.title}</Text>
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <DevEnvironmentBanner />

        {displayStatsOffline ? (
          <EdgeStateBanner
            title={t.errors.network}
            message={t.errors.offlineCache}
            variant="offline"
          />
        ) : null}

        {rideEdgeMessage ? (
          <EdgeStateBanner
            title={rideEdgeMessage.title}
            message={rideEdgeMessage.message}
            variant={rideEdgeMessage.variant}
            onDismiss={onDismissRideEdgeMessage}
          />
        ) : null}

        {startRideError ? (
          <EdgeStateBanner
            title={t.errors.startRide}
            message={startRideError}
            onDismiss={onDismissStartRideError}
          />
        ) : null}

        <PlatformNoticeBanner notice={notice} onDismiss={dismiss} />
        <GpsRecoveryBanner
          visible={gpsRecoveryVisible}
          busy={gpsRecoveryBusy}
          onPress={() => onGpsRecoveryPress?.()}
        />

        <ProductCard variant="raised">
          <View style={s.heroContent}>
            {!isRecording ? (
              <View
                style={s.heroArtSlot}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={s.heroBrand}>4VELO</Text>
                <View style={s.heroAccent} />
              </View>
            ) : null}

            <View style={s.heroCopy}>
              <Text style={s.heroEyebrow}>
                {isRecording ? t.dashboard.currentRide : riderPlace}
              </Text>
              <Text style={s.heroTitle}>
                {isRecording ? t.dashboard.inProgress : t.dashboard.ready}
              </Text>
              {!isRecording ? (
                <Text style={s.heroBody}>{displayName}</Text>
              ) : null}
            </View>

            {isRecording ? (
              <>
                <View style={s.activeMetricRow}>
                  <View style={s.activeMetricCell}>
                    <Metric
                      value={`${liveSpeed.toFixed(1)} km/h`}
                      label={t.ride.fields.speed}
                      testID="home-live-speed"
                    />
                  </View>
                  <View style={s.activeMetricCell}>
                    <Metric
                      value={`${liveDistance.toFixed(1)} km`}
                      label={t.ride.fields.distance}
                      testID="home-live-distance"
                    />
                  </View>
                </View>
                <PrimaryButton
                  label={t.dashboard.goToRide}
                  onPress={handleGoToRide}
                  testID="home-go-to-ride"
                />
              </>
            ) : (
              <>
                <View style={s.sportRow}>
                  {ACTIVITY_SPORT_OPTIONS.map((option) => (
                    <SportChip
                      key={option.type}
                      label={locale === 'pl' ? option.labelPl : option.labelEn}
                      selected={selectedSport === option.type}
                      onPress={() => setSelectedSport(option.type)}
                      testID={`home-sport-${option.type.toLowerCase()}`}
                    />
                  ))}
                </View>
                <View style={s.actionStack}>
                  <PrimaryButton
                    label={t.dashboard.startRide}
                    onPress={handleStartRide}
                    testID="home-start-ride"
                  />
                  <PrimaryButton
                    label={t.dashboard.gpsWizard}
                    onPress={() => onOpenGpsWizard?.()}
                    variant="secondary"
                    testID="home-gps-check"
                  />
                </View>
              </>
            )}
          </View>
        </ProductCard>

        {displayStatsError ? (
          <ProductCard testID="home-stats-error">
            <View style={s.cardContent}>
              <Text style={s.errorTitle}>{t.dashboard.historyErrorTitle}</Text>
              <Text style={s.errorBody}>{t.dashboard.historyErrorBody}</Text>
              <PrimaryButton
                label={t.common.retry}
                onPress={() => {
                  void refreshStats();
                }}
                variant="secondary"
                testID="home-stats-retry"
              />
            </View>
          </ProductCard>
        ) : null}

        {!displayStatsError ? (
          <>
            <View style={s.section}>
              <Text style={s.sectionHeader}>{t.dashboard.lastRide}</Text>
              {displayStatsLoading ? (
                <SkeletonBlock height={104} />
              ) : lastRideDistanceKm == null ? (
                <ProductCard testID="home-first-use-empty">
                  <View style={s.cardContent}>
                    <Text style={s.emptyTitle}>{t.dashboard.noRides}</Text>
                    <Text style={s.emptyBody}>{t.dashboard.firstRideHint}</Text>
                  </View>
                </ProductCard>
              ) : (
                <ProductCard>
                  <View style={s.metricRow}>
                    <View style={s.metricCell}>
                      <Metric
                        value={`${lastRideDistanceKm.toFixed(1)} km`}
                        label={t.ride.fields.distance}
                        testID="home-last-ride-distance"
                      />
                    </View>
                    <View style={s.metricCell}>
                      <Metric
                        value={lastRideDuration ?? '—'}
                        label={t.ride.fields.time}
                        testID="home-last-ride-duration"
                      />
                    </View>
                  </View>
                </ProductCard>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionHeader}>{t.dashboard.weeklyLoad}</Text>
              {displayStatsLoading ? (
                <SkeletonBlock height={132} />
              ) : (
                <ProductCard testID="home-weekly-context">
                  <View style={s.cardContent}>
                    <View style={s.weeklyHeader}>
                      <Metric
                        value={`${displayWeeklyDistanceKm.toFixed(1)} km`}
                        label={t.dashboard.weekDistance}
                        testID="home-week-distance"
                      />
                    </View>

                    {displayWeeklyDistanceKm <= 0 ? (
                      <Text style={s.emptyBody}>{t.dashboard.noWeekRides}</Text>
                    ) : (
                      <View style={s.weeklyChart} accessibilityLabel={t.dashboard.weeklyLoad}>
                        {displayWeeklyBars.map((height, index) => {
                          const pct = Math.max(0, Math.min(1, height));
                          return (
                            <View key={`${weekDays[index]}-${index}`} style={s.weeklyDay}>
                              <View style={s.weeklyTrack}>
                                <View
                                  style={[
                                    s.weeklyFill,
                                    { height: `${Math.round(pct * 100)}%` },
                                  ]}
                                />
                              </View>
                              <Text style={s.weeklyLabel}>{weekDays[index]}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </ProductCard>
              )}
            </View>
          </>
        ) : null}

        <View style={s.bottomInset} />
      </ScrollView>
    </SafeAreaView>
  );
});
