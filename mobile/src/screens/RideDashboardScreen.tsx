import React, { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from '@legendapp/state/react';
import { PrimaryButton, Metric } from '../components/product';
import { DevEnvironmentBanner } from '../components/DevEnvironmentBanner';
import { PlatformNoticeBanner } from '../components/PlatformNoticeBanner';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { RoadbookPage, RoadbookSection, RoadbookRow, RoadbookNotice, roadbookStyles as s } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { metricNumber } from '../components/roadbook/summaryPresentation';
import { getVisionHomePreviewState, getVisionProfileFixture, getVisionRideDashboardFixture,
  isVisionFixtures, type VisionHomePreviewState } from '../bootstrap/visionFixtures';
import { usePlatformNotices } from '../hooks/usePlatformNotices';
import { useRiderStats } from '../hooks/useRiderStats';
import { useI18n } from '../i18n/useI18n';
import type { RideEdgeMessage } from '../services/apiRetry';
import { formatRiderDisplayName } from '../utils/displayName';
import { formatDurationSeconds } from '../utils/activityMetrics';

export type HomePreviewState = VisionHomePreviewState;
interface RideDashboardScreenProps {
  user: { username: string; tenant_name?: string; tenant_id?: string } | null;
  onOpenStartRide?: () => void; onGoToRide?: () => void; isRecording?: boolean;
  liveSpeed?: number; liveDistance?: number; onOpenSettings?: () => void;
  onOpenActivity?: (id: number) => void;
  rideEdgeMessage?: RideEdgeMessage | null; onDismissRideEdgeMessage?: () => void;
  previewState?: HomePreviewState;
}
export const RideDashboardScreen: React.FC<RideDashboardScreenProps> = observer(({
  user, onOpenStartRide, onGoToRide, isRecording = false, liveSpeed = 0, liveDistance = 0,
  onOpenSettings, onOpenActivity, rideEdgeMessage, onDismissRideEdgeMessage, previewState,
}) => {
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const fixturesEnabled = isVisionFixtures();
  const rideFixture = getVisionRideDashboardFixture(fixturesEnabled);
  const profileFixture = getVisionProfileFixture(fixturesEnabled);
  const { notice, dismiss } = usePlatformNotices(user?.tenant_id ?? null);
  const { latest: latestRide, weeklyDistanceKm, loading: statsLoading, offline: statsOffline,
    error: statsError, refresh: refreshStats } = useRiderStats();
  const hasFocusedHome = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!hasFocusedHome.current) { hasFocusedHome.current = true; return; }
    void refreshStats();
  }, [refreshStats]));
  const effectivePreviewState = fixturesEnabled ? (previewState ?? getVisionHomePreviewState(true) ?? 'default') : null;
  const forceEmpty = effectivePreviewState === 'empty';
  const displayStatsLoading = effectivePreviewState ? effectivePreviewState === 'loading' : statsLoading;
  const displayStatsOffline = effectivePreviewState ? effectivePreviewState === 'offline' : statsOffline;
  const displayStatsError = effectivePreviewState ? effectivePreviewState === 'error' : statsError;
  const weekKm = forceEmpty ? 0 : fixturesEnabled ? (rideFixture?.weekDistanceKm ?? 128.7) : weeklyDistanceKm;
  const lastKm = forceEmpty ? null : fixturesEnabled ? 42.3 : latestRide ? latestRide.distance / 1000 : null;
  const lastTime = forceEmpty ? null : fixturesEnabled ? '01:42:00'
    : latestRide?.duration != null ? formatDurationSeconds(latestRide.duration) : null;
  const name = formatRiderDisplayName(profileFixture?.username ?? user?.username);
  return <RoadbookPage title={copy.ride} testID="roadbook-ride-home" sampleLabel={fixturesEnabled ? copy.sample : undefined}>
    <DevEnvironmentBanner />
    <View style={s.hero}>
      <Text style={s.caption}>{name}{user?.tenant_name ? ` · ${user.tenant_name}` : ''}</Text>
      <Text accessibilityRole="header" style={s.display}>{isRecording ? copy.live : copy.greeting}</Text>
      <Text style={s.body}>{isRecording ? copy.liveBody : copy.prepare}</Text>
      {isRecording ? <View style={s.metrics}>
        <View style={s.metric}><Metric value={`${metricNumber(liveSpeed)} km/h`} label={copy.speed} testID="home-live-speed" /></View>
        <View style={s.metric}><Metric value={`${metricNumber(liveDistance)} km`} label={copy.distance} testID="home-live-distance" /></View>
      </View> : null}
      {isRecording ? <PrimaryButton label={t.dashboard.goToRide} onPress={() => onGoToRide?.()} testID="home-go-to-ride" />
        : <PrimaryButton label={t.dashboard.startRide} onPress={() => onOpenStartRide?.()} testID="home-open-start-ride" />}
    </View>
    {rideEdgeMessage ? <EdgeStateBanner title={rideEdgeMessage.title} message={rideEdgeMessage.message}
      variant={rideEdgeMessage.variant} onDismiss={onDismissRideEdgeMessage} /> : null}
    <PlatformNoticeBanner notice={notice} onDismiss={dismiss} />
    {displayStatsOffline ? <RoadbookNotice testID="home-stats-offline" title={t.errors.network} message={t.errors.offlineCache} /> : null}
    {displayStatsError ? <RoadbookNotice error testID="home-stats-error" title={t.dashboard.historyErrorTitle}
      message={t.dashboard.historyErrorBody} action={<PrimaryButton variant="secondary" label={t.common.retry}
        onPress={() => { void refreshStats(); }} testID="home-stats-retry" />} /> : <>
      <RoadbookSection title={copy.week} testID="home-weekly-context">
        {displayStatsLoading ? <SkeletonBlock height={76} /> : <>
          <Metric value={`${metricNumber(weekKm)} km`} label={t.dashboard.weekDistance} testID="home-week-distance" />
          {weekKm <= 0 ? <Text style={s.body}>{t.dashboard.noWeekRides}</Text> : null}
        </>}
      </RoadbookSection>
      <RoadbookSection title={copy.recent}>
        {displayStatsLoading ? <SkeletonBlock height={80} /> : lastKm != null ? <>
          <View style={s.metrics}>
            <View style={s.metric}><Metric value={`${metricNumber(lastKm)} km`} label={copy.distance} testID="home-last-ride-distance" /></View>
            <View style={s.metric}><Metric value={lastTime ?? '—'} label={copy.duration} testID="home-last-ride-time" /></View>
          </View>
          {!fixturesEnabled && latestRide && onOpenActivity ? <RoadbookRow label={copy.recent}
            detail={latestRide.type} onPress={() => onOpenActivity(latestRide.id)} testID="home-open-last-ride" /> : null}
        </> : <Text testID="home-first-use-empty" style={s.body}>{t.dashboard.noWeekRides}</Text>}
      </RoadbookSection>
    </>}
    <RoadbookRow label={t.settings.title} onPress={() => onOpenSettings?.()} testID="home-open-settings" />
  </RoadbookPage>;
});
