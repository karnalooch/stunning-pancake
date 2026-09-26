/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { ActivityService, type ActivityDetail, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { APP_BRAND_NAME } from '../theme/brand';
import { useI18n } from '../i18n/useI18n';
import { ProductCard } from '../components/product/ProductCard';
import { Metric } from '../components/product/Metric';
import { PrimaryButton } from '../components/product/PrimaryButton';
import { RideMapView } from '../components/RideMapView';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import {
  averageSpeedKmh,
  formatDurationSeconds,
  routeViewport,
} from '../utils/activityMetrics';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: { flex: 1, backgroundColor: semantic.canvas.background },
    header: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
      backgroundColor: semantic.surface.raised,
    },
    back: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
      width: 44,
    },
    brand: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      letterSpacing: 0.6,
    },
    headerSpacer: { width: 44 },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, paddingBottom: 96 },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    date: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      marginTop: 4,
    },
    status: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      marginTop: 10,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metricCell: {
      width: '47%',
      minWidth: 140,
    },
    mapWrap: {
      height: 280,
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 12,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      marginTop: 6,
    },
    errorText: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.status.error,
      marginTop: 8,
    },
    stateWrap: { padding: 16, gap: 12 },
  };
});

interface ActivityDetailScreenProps {
  onBack?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  activityId?: number;
}

function formatActivityDate(value: string | undefined, localeTag: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(localeTag);
}

function activityLabel(
  type: string,
  t: ReturnType<typeof useI18n.getState>['t'],
): string {
  if (type === 'BIKE') return t.training.bike;
  if (type === 'RUN') return t.training.run;
  if (type === 'WALK') return t.training.walk;
  return type;
}

function cacheFallback(activityId: number): ActivityItem | null {
  return OfflineCacheService.getHistory()?.find((item) => item.id === activityId) ?? null;
}

export const ActivityDetailScreen: React.FC<ActivityDetailScreenProps> = ({
  activityId,
  onBack,
  onShare,
  onDownload,
}) => {
  const { theme } = useUnistyles();
  const { t, locale } = useI18n();
  const s = stylesheet;
  const semantic = getSemanticColors(theme.colors);
  const localeTag = locale === 'pl' ? 'pl-PL' : 'en-US';

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [fallback, setFallback] = useState<ActivityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!activityId) {
      setLoading(false);
      setDetail(null);
      setFallback(null);
      return;
    }

    const cached = cacheFallback(activityId);
    setDetail(null);
    setFallback(cached);
    setOffline(Boolean(cached));
    setLoading(true);
    setLoadError(false);

    try {
      const data = await ActivityService.getDetail(activityId);
      setDetail(data);
      setOffline(false);
    } catch {
      setDetail(null);
      setOffline(Boolean(cached));
      setLoadError(!cached);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const data = detail ?? fallback;
  const routeCoordinates = detail?.route_coords ?? [];
  const viewport = useMemo(() => routeViewport(routeCoordinates), [routeCoordinates]);
  const avgSpeed = data ? averageSpeedKmh(data.distance, data.duration) : null;
  const verificationScore = detail?.verification_score ?? data?.verification_score ?? null;
  const statusLabel = data?.is_verified
    ? t.activityDetail.verified
    : detail?.rejection_reason
      ? t.activityDetail.rejected
      : t.activityDetail.pending;

  if (!activityId) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <EmptyState message={t.activityDetail.unavailable} icon="training" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t.training.back}>
          <Text style={s.back}>←</Text>
        </Pressable>
        <Text style={s.brand}>{APP_BRAND_NAME}</Text>
        <View style={s.headerSpacer} />
      </View>

      {offline ? (
        <EdgeStateBanner
          title={t.errors.network}
          message={t.errors.offlineCache}
          variant="offline"
        />
      ) : null}

      {loading && !data ? (
        <SkeletonBlock height={240} style={{ margin: 16 }} />
      ) : loadError || !data ? (
        <View style={s.stateWrap}>
          <EmptyState
            message={t.activityDetail.unavailable}
            hint={t.activityDetail.loadingHint}
            icon="training"
          />
          <PrimaryButton
            label={t.common.retry}
            onPress={() => void load()}
            variant="secondary"
            testID="activity-detail-retry"
          />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <ProductCard variant="raised">
            <Text style={s.title}>{activityLabel(data.type, t)}</Text>
            <Text style={s.date}>{formatActivityDate(data.start_time, localeTag)}</Text>
            <Text
              style={[
                s.status,
                {
                  color: data.is_verified
                    ? semantic.status.success
                    : detail?.rejection_reason
                      ? semantic.status.error
                      : semantic.status.warning,
                },
              ]}
            >
              {statusLabel}
            </Text>
            {detail?.rejection_reason ? (
              <Text style={s.errorText}>
                {detail.rejection_reason}
                {detail.rejection_notes ? ` — ${detail.rejection_notes}` : ''}
              </Text>
            ) : null}
          </ProductCard>

          <View style={s.metricGrid}>
            <View style={s.metricCell}>
              <ProductCard>
                <Metric
                  label={t.activityDetail.stats.distance}
                  value={`${(Math.max(0, data.distance) / 1000).toFixed(2)} ${t.activityDetail.stats.distanceUnit}`}
                  testID="activity-detail-distance"
                />
              </ProductCard>
            </View>
            <View style={s.metricCell}>
              <ProductCard>
                <Metric
                  label={t.activityDetail.stats.time}
                  value={formatDurationSeconds(data.duration)}
                  testID="activity-detail-duration"
                />
              </ProductCard>
            </View>
            <View style={s.metricCell}>
              <ProductCard>
                <Metric
                  label={t.activityDetail.stats.avgSpeed}
                  value={
                    avgSpeed == null
                      ? '—'
                      : `${avgSpeed.toFixed(1)} ${t.activityDetail.stats.speedUnit}`
                  }
                  testID="activity-detail-avg-speed"
                />
              </ProductCard>
            </View>
            <View style={s.metricCell}>
              <ProductCard>
                <Metric
                  label={t.activityDetail.verification}
                  value={
                    verificationScore == null
                      ? '—'
                      : `${Math.round(Math.max(0, Math.min(1, verificationScore)) * 100)}%`
                  }
                  testID="activity-detail-verification"
                />
              </ProductCard>
            </View>
          </View>

          <ProductCard>
            <Text style={s.sectionTitle}>{t.activityDetail.route}</Text>
            {routeCoordinates.length >= 2 && viewport.center ? (
              <View style={s.mapWrap} testID="activity-detail-route-map">
                <RideMapView
                  userCoordinate={viewport.center}
                  zoomLevel={viewport.zoom}
                  routeCoordinates={routeCoordinates}
                  showRiderMarker={false}
                />
              </View>
            ) : (
              <Text style={s.body}>{t.activityDetail.noRouteData}</Text>
            )}
          </ProductCard>

          <ProductCard>
            <Text style={s.sectionTitle}>{t.activityDetail.dataIntegrity}</Text>
            <Text style={s.body}>
              {detail
                ? t.activityDetail.detailSource
                : t.activityDetail.cachedSummaryOnly}
            </Text>
          </ProductCard>

          {onShare || onDownload ? (
            <View style={{ gap: 10 }}>
              {onShare ? (
                <PrimaryButton
                  label={t.activityDetail.shareRide}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    onShare();
                  }}
                />
              ) : null}
              {onDownload ? (
                <PrimaryButton
                  label={t.activityDetail.downloadGpx}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    onDownload();
                  }}
                  variant="secondary"
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
