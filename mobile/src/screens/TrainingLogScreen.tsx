/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { useI18n } from '../i18n/useI18n';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { PixelText } from '../components/PixelText';
import { EmptyState } from '../components/ui/EmptyState';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { PrimaryButton } from '../components/product/PrimaryButton';
import { formatDurationSeconds } from '../utils/activityMetrics';
import { getVisionActivityHistoryFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: c.background },
    header: {
      padding: 16,
      borderBottomWidth: 4,
      borderBottomColor: c.onBackground,
      backgroundColor: c.surface,
    },
    headerTitle: {
      fontSize: 16,
      color: c.primary,
      textTransform: 'uppercase',
    },
    cardWrap: { margin: 16, marginBottom: 0 },
    label: { fontSize: 10, color: c.secondary, textTransform: 'uppercase' },
    name: { fontSize: 14, color: c.onBackground, marginTop: 4 },
    stateWrap: { padding: 16, gap: 12 },
  };
});

function statusLabel(
  item: ActivityItem,
  t: ReturnType<typeof useI18n.getState>['t'],
): string {
  if (item.is_verified) return t.training.verified;
  if (item.rejection_reason) return `${t.training.rejected}: ${item.rejection_reason}`;
  return t.training.pending;
}

interface TrainingLogScreenProps {
  onBack?: () => void;
  onOpenActivity?: (activityId: number) => void;
}

export const TrainingLogScreen: React.FC<TrainingLogScreenProps> = ({ onBack, onOpenActivity }) => {
  const { t } = useI18n();
  const s = stylesheet;
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
          <Pressable onPress={onBack}>
            <PixelText color="primary" size="sm">← {t.training.back}</PixelText>
          </Pressable>
        ) : null}
        <PixelText style={s.headerTitle}>{t.training.title}</PixelText>
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
      ) : (
        <ScrollView>
          {items.length === 0 ? (
            <View style={s.stateWrap}>
              <EmptyState message={t.training.empty} icon="training" />
            </View>
          ) : (
            items.map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [s.cardWrap, pressed && { opacity: 0.85 }]}
                onPress={() => onOpenActivity?.(a.id)}
                disabled={!onOpenActivity}
                testID={`training-activity-${a.id}`}
              >
                <OrnateFrame>
                  <PixelText style={s.label}>{new Date(a.start_time).toLocaleDateString()}</PixelText>
                  <PixelText style={s.name}>{a.type}</PixelText>
                  <PixelText size="lg" color="primary">
                    {(a.distance / 1000).toFixed(1)} km
                    {a.duration != null ? ` · ${formatDurationSeconds(a.duration)}` : ''}
                  </PixelText>
                  <PixelText
                    size="sm"
                    color={
                      a.is_verified
                        ? 'primary'
                        : a.rejection_reason
                          ? 'error'
                          : 'secondary'
                    }
                  >
                    {statusLabel(a, t)}
                  </PixelText>
                </OrnateFrame>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
