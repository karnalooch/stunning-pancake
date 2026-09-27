/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ProductCard } from '../components/product/ProductCard';
import { PrimaryButton } from '../components/product/PrimaryButton';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionLeaderboardFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useI18n } from '../i18n/useI18n';
import { ActivityService, type LeaderboardEntry } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rank: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      width: 36,
      color: semantic.text.secondary,
    },
    identity: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    me: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.selection.active,
    },
    score: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      fontVariant: ['tabular-nums'],
    },
    retry: {
      marginTop: 2,
    },
  };
});

export const GlobalLeaderboardScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingCached, setUsingCached] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    const fixture = getVisionLeaderboardFixture(isVisionFixtures());
    if (fixture) {
      setEntries(fixture as unknown as LeaderboardEntry[]);
      setUsingCached(false);
      setLoadError(false);
      setLoading(false);
      return;
    }

    const cached = OfflineCacheService.getCityHub();
    const cachedEntries = cached?.leaderboard ?? [];
    const hasCachedEntries = cachedEntries.length > 0;

    if (hasCachedEntries) {
      setEntries(cachedEntries);
      setUsingCached(true);
    }

    setLoadError(false);
    setLoading(true);
    ActivityService.getCityHubSummary()
      .then((summary) => {
        OfflineCacheService.setCityHub(summary);
        setEntries(summary.leaderboard ?? []);
        setUsingCached(false);
        setLoadError(false);
      })
      .catch(() => {
        if (hasCachedEntries) {
          setUsingCached(true);
        } else {
          setEntries([]);
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

        {loading && entries.length === 0 ? (
          <SkeletonBlock height={220} />
        ) : loadError && entries.length === 0 ? (
          <>
            <EdgeStateBanner
              title={t.errors.network}
              message={t.training.loadErrorHint}
              variant="error"
            />
            <View style={s.retry}>
              <PrimaryButton label={t.common.retry} onPress={load} />
            </View>
          </>
        ) : entries.length === 0 ? (
          <ProductCard>
            <EmptyState
              message={t.demo.leaderboardEmpty}
              icon="leaderboard"
              hint={t.settings.globalLb}
            />
          </ProductCard>
        ) : (
          entries.slice(0, 20).map((entry) => (
            <ProductCard
              key={`${entry.rank}-${entry.username}`}
              variant={entry.is_me ? 'selected' : 'default'}
            >
              <View style={s.row}>
                <Text style={s.rank}>#{entry.rank}</Text>
                <View style={s.identity}>
                  <Text style={s.name}>{entry.username}</Text>
                  {entry.is_me ? <Text style={s.me}>{t.compete.you}</Text> : null}
                </View>
                <Text style={s.score}>
                  {entry.score_km != null
                    ? `${entry.score_km.toFixed(1)} km`
                    : String(entry.points)}
                </Text>
              </View>
            </ProductCard>
          ))
        )}
      </ScrollView>
    </View>
  );
};
