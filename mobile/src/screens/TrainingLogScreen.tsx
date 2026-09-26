/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { useI18n } from '../i18n/useI18n';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EmptyState } from '../components/ui/EmptyState';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { Metric, PrimaryButton, ProductCard } from '../components/product';
import { formatDurationSeconds } from '../utils/activityMetrics';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { getVisionActivityHistoryFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: { flex: 1, backgroundColor: semantic.canvas.background },
    header: {
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
      backgroundColor: semantic.surface.raised,
      justifyContent: 'center',
      gap: 2,
    },
    back: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.secondary,
    },
    headerTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    content: {
      padding: 16,
      gap: 12,
      paddingBottom: 96,
    },
    cardBody: { gap: 12 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    date: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
    },
    activityType: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    status: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
    },
    statusVerified: { color: semantic.status.success },
    statusRejected: { color: semantic.status.error },
    statusPending: { color: semantic.status.warning },
    metrics: {
      flexDirection: 'row',
      gap: 20,
    },
    stateWrap: { padding: 16, gap: 12 },
  };
});

function statusLabel(
  item: ActivityItem,
  t: ReturnType<typeof useI18n.getState>['t'],
): string {
  if (item.is_verified) return t.training.verified;
  if (item.rejection_reason) return t.training.rejected;
  return t.training.pending;
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

interface TrainingLogScreenProps {
  onBack?: () => void;
  onOpenActivity?: (activityId: number) => void;
}

export const TrainingLogScreen: React.FC<TrainingLogScreenProps> = ({ onBack, onOpenActivity }) => {
  const { t, locale } = useI18n();
  const s = stylesheet;
  const localeTag = locale === 'pl' ? 'pl-PL' : 'en-US';
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadHistory = useCallback(async () => {
    const cached = OfflineCacheService.getHistory();
    if (cached?.length) {
      setItems(cached);
      setOffline(true);
    }

    setLoading(true);
    setLoadError(false);
    try {
      const data = await ActivityService.getHistory();
      const list = Array.isArray(data) ? data : [];
      OfflineCacheService.setHistory(list);
      setItems(list);
      setOffline(false);
    } catch {
      if (!cached?.length) {
        setItems([]);
        setLoadError(true);
      }
      setOffline(Boolean(cached?.length));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fixture = getVisionActivityHistoryFixture(isVisionFixtures());
    if (fixture) {
      setItems(fixture as unknown as ActivityItem[]);
      setOffline(false);
      setLoadError(false);
      setLoading(false);
      return;
    }
    void loadHistory();
  }, [loadHistory]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t.training.back}>
            <Text style={s.back}>← {t.training.back}</Text>
          </Pressable>
        ) : null}
        <Text style={s.headerTitle}>{t.training.title}</Text>
      </View>

      {offline ? (
        <EdgeStateBanner
          title={t.errors.network}
          message={t.errors.offlineCache}
          variant="offline"
        />
      ) : null}

      {loading && items.length === 0 ? (
        <SkeletonBlock height={120} style={{ margin: 16 }} />
      ) : loadError ? (
        <View style={s.stateWrap}>
          <EmptyState
            message={t.training.loadError}
            hint={t.training.loadErrorHint}
            icon="training"
          />
          <PrimaryButton
            label={t.common.retry}
            onPress={() => void loadHistory()}
            variant="secondary"
            testID="training-log-retry"
          />
        </View>
      ) : items.length === 0 ? (
        <View style={s.stateWrap}>
          <EmptyState message={t.training.empty} icon="training" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {items.map((item) => (
            <ProductCard
              key={item.id}
              variant="interactive"
              onPress={onOpenActivity ? () => onOpenActivity(item.id) : undefined}
              accessibilityLabel={`${activityLabel(item.type, t)} ${new Date(item.start_time).toLocaleDateString(localeTag)}`}
              testID={`training-activity-${item.id}`}
            >
              <View style={s.cardBody}>
                <View style={s.cardHeader}>
                  <Text style={s.date}>
                    {new Date(item.start_time).toLocaleDateString(localeTag)}
                  </Text>
                  <Text
                    style={[
                      s.status,
                      item.is_verified
                        ? s.statusVerified
                        : item.rejection_reason
                          ? s.statusRejected
                          : s.statusPending,
                    ]}
                  >
                    {statusLabel(item, t)}
                  </Text>
                </View>
                <Text style={s.activityType}>{activityLabel(item.type, t)}</Text>
                <View style={s.metrics}>
                  <Metric
                    label={t.activityDetail.stats.distance}
                    value={`${(Math.max(0, item.distance) / 1000).toFixed(1)} ${t.activityDetail.stats.distanceUnit}`}
                  />
                  <Metric
                    label={t.activityDetail.stats.time}
                    value={formatDurationSeconds(item.duration)}
                  />
                </View>
              </View>
            </ProductCard>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
