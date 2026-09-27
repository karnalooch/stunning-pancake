/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Metric } from '../components/product/Metric';
import { PrimaryButton } from '../components/product/PrimaryButton';
import { ProductCard } from '../components/product/ProductCard';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionActivityHistoryFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useI18n } from '../i18n/useI18n';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { getSemanticColors } from '../theme/semantic';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
      gap: 10,
    },
    metricGrid: {
      gap: 10,
    },
    retry: {
      marginTop: 2,
    },
  };
});

export const PerformanceTrendsScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;
  const [history, setHistory] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingCached, setUsingCached] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    const fixture = getVisionActivityHistoryFixture(isVisionFixtures());
    if (fixture) {
      setHistory(fixture as unknown as ActivityItem[]);
      setUsingCached(false);
      setLoadError(false);
      setLoading(false);
      return;
    }

    const cached = OfflineCacheService.getHistory();
    const hasCachedHistory = Boolean(cached?.length);
    if (hasCachedHistory && cached) {
      setHistory(cached);
      setUsingCached(true);
    }

    setLoadError(false);
    setLoading(true);
    ActivityService.getHistory()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        OfflineCacheService.setHistory(list);
        setHistory(list);
        setUsingCached(false);
        setLoadError(false);
      })
      .catch(() => {
        if (hasCachedHistory) {
          setUsingCached(true);
        } else {
          setHistory([]);
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const recent = history.slice(0, 8);
    const totalDistanceKm = recent.reduce((acc, item) => acc + (item.distance ?? 0) / 1000, 0);
    const totalSeconds = recent.reduce(
      (acc, item) => acc + (item.duration != null && Number.isFinite(item.duration) ? item.duration : 0),
      0,
    );
    const avgSpeedKmh = totalSeconds > 0 ? (totalDistanceKm / totalSeconds) * 3600 : 0;

    return {
      rides: recent.length,
      distanceKm: totalDistanceKm,
      avgSpeedKmh,
    };
  }, [history]);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        {usingCached ? (
          <EdgeStateBanner
            title={t.errors.network}
            message={t.errors.offlineCache}
            variant="offline"
          />
        ) : null}

        {loading && history.length === 0 ? (
          <SkeletonBlock height={220} />
        ) : loadError && history.length === 0 ? (
          <View style={s.metricGrid}>
            <EdgeStateBanner
              title={t.errors.network}
              message={t.training.loadErrorHint}
              variant="error"
            />
            <View style={s.retry}>
              <PrimaryButton label={t.common.retry} onPress={load} />
            </View>
          </View>
        ) : stats.rides === 0 ? (
          <ProductCard>
            <EmptyState message={t.demo.trendsEmpty} hint={t.settings.trends} icon="training" />
          </ProductCard>
        ) : (
          <View style={s.metricGrid}>
            <ProductCard>
              <Metric value={String(stats.rides)} label={t.trends.lastActivities} />
            </ProductCard>
            <ProductCard>
              <Metric value={`${stats.distanceKm.toFixed(1)} km`} label={t.trends.rollingLoad} />
            </ProductCard>
            <ProductCard>
              <Metric
                value={`${stats.avgSpeedKmh.toFixed(1)} km/h`}
                label={t.trends.computedFromRideTime}
              />
            </ProductCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
