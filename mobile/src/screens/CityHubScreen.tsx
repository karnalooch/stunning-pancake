import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Metric, PrimaryButton, ProductCard } from '../components/product';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionCityHubFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useI18n } from '../i18n/useI18n';
import {
  ActivityService,
  type CityHubSummary,
} from '../services/api';
import { withRetry } from '../services/apiRetry';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 72,
      paddingHorizontal: LAYOUT.gutter,
      paddingVertical: 12,
      justifyContent: 'center',
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    headerTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    content: {
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
      paddingBottom: 112,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 18,
      lineHeight: 24,
      color: semantic.text.primary,
    },
    stateContent: {
      gap: 10,
    },
    errorTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.error,
    },
    offlineTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.offline,
    },
    stateBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    cityName: {
      ...PRODUCT_TYPOGRAPHY.title,
      fontSize: 20,
      lineHeight: 26,
      color: semantic.text.primary,
    },
    warRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    warSide: {
      flex: 1,
    },
    versus: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      alignSelf: 'center',
      color: semantic.text.secondary,
    },
    lead: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      textAlign: 'center',
    },
    leaderboard: {
      gap: 8,
    },
    leaderboardRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
      backgroundColor: semantic.surface.default,
    },
    leaderboardRowMine: {
      borderColor: semantic.selection.border,
      backgroundColor: semantic.selection.background,
    },
    rank: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      width: 32,
      color: semantic.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    rider: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      flex: 1,
      color: semantic.text.primary,
    },
    score: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      fontVariant: ['tabular-nums'],
    },
    questStack: {
      gap: 10,
    },
    questContent: {
      gap: 6,
    },
    questCategory: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
    },
    questTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 17,
      lineHeight: 23,
      color: semantic.text.primary,
    },
    questMeta: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    navActions: {
      gap: 8,
    },
  };
});

export const CityHubScreen: React.FC<{
  user?: { username: string } | null;
  onOpenStartRide?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenClubs?: () => void;
  onOpenSegments?: () => void;
}> = ({ onOpenStartRide, onOpenLeaderboard, onOpenClubs, onOpenSegments }) => {
  const { t } = useI18n();
  const s = stylesheet;
  const fixturesEnabled = isVisionFixtures();
  const cityHubFixture = getVisionCityHubFixture(fixturesEnabled);

  const fixtureSummary = useMemo<CityHubSummary>(() => ({
    active_event: null,
    city_of_week: {
      tenant_id: 'fixture_lublin',
      name: cityHubFixture?.cityOfWeek.name ?? 'Lublin',
      score_km: (cityHubFixture?.cityWars.left.score ?? 1240) / 10,
    },
    city_wars: {
      event_id: 1,
      tenant_a: {
        id: 'fixture_lublin',
        name: cityHubFixture?.cityWars.left.name ?? 'Lublin',
        score: cityHubFixture?.cityWars.left.score ?? 1240,
      },
      tenant_b: {
        id: 'fixture_warszawa',
        name: cityHubFixture?.cityWars.right.name ?? 'Warszawa',
        score: cityHubFixture?.cityWars.right.score ?? 1180,
      },
      leader:
        (cityHubFixture?.cityWars.left.score ?? 1240) >=
        (cityHubFixture?.cityWars.right.score ?? 1180)
          ? (cityHubFixture?.cityWars.left.name ?? 'Lublin')
          : (cityHubFixture?.cityWars.right.name ?? 'Warszawa'),
      delta: Math.abs(
        (cityHubFixture?.cityWars.left.score ?? 1240) -
          (cityHubFixture?.cityWars.right.score ?? 1180),
      ),
    },
    leaderboard: (cityHubFixture?.leaderboard ?? []).map((entry) => ({
      rank: entry.rank,
      username: entry.name,
      points: entry.score,
      score_km: entry.score,
      is_me: false,
    })),
    my_rank: null,
    quests: (cityHubFixture?.quests ?? []).map((quest) => ({
      id: quest.id,
      name: quest.title,
      category: 'QUEST',
      description: `${quest.distanceKm.toFixed(2)} km · ${quest.star}★ · ${quest.coin}`,
      latitude: null,
      longitude: null,
    })),
  }), [cityHubFixture]);

  const [cityHubLive, setCityHubLive] = useState<CityHubSummary | null>(
    () => (fixturesEnabled ? null : OfflineCacheService.getCityHub()),
  );
  const [loading, setLoading] = useState(!fixturesEnabled && cityHubLive === null);
  const [loadError, setLoadError] = useState(false);
  const [usingCached, setUsingCached] = useState(!fixturesEnabled && cityHubLive !== null);

  useEffect(() => {
    if (fixturesEnabled) return;

    let active = true;
    void withRetry(() => ActivityService.getCityHubSummary())
      .then((summary) => {
        if (!active) return;
        OfflineCacheService.setCityHub(summary);
        setCityHubLive(summary);
        setLoadError(false);
        setUsingCached(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fixturesEnabled]);

  const retryCityHub = useCallback(async () => {
    setLoading(cityHubLive === null);
    setLoadError(false);
    try {
      const summary = await withRetry(() => ActivityService.getCityHubSummary());
      OfflineCacheService.setCityHub(summary);
      setCityHubLive(summary);
      setUsingCached(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [cityHubLive]);

  const effectiveCityHub = fixturesEnabled ? fixtureSummary : cityHubLive;
  const cityOfWeek = effectiveCityHub?.city_of_week ?? null;
  const wars = effectiveCityHub?.city_wars ?? null;
  const leaderboard = effectiveCityHub?.leaderboard ?? [];
  const quests = effectiveCityHub?.quests ?? [];

  const openChallengeRide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onOpenStartRide?.();
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t.tabs.club}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {!fixturesEnabled && usingCached ? (
          <ProductCard testID="club-cached-state">
            <View style={s.stateContent}>
              <Text style={s.offlineTitle}>
                {loadError ? t.compete.cachedOfflineTitle : t.compete.refreshingCached}
              </Text>
              <Text style={s.stateBody}>{loadError ? t.compete.cachedOfflineBody : t.compete.refreshingCachedBody}</Text>
            </View>
          </ProductCard>
        ) : null}

        {loading && !effectiveCityHub ? (
          <SkeletonBlock height={360} />
        ) : loadError && !effectiveCityHub ? (
          <ProductCard variant="raised" testID="club-load-error">
            <View style={s.stateContent}>
              <Text style={s.errorTitle}>{t.compete.loadError}</Text>
              <Text style={s.stateBody}>{t.compete.loadErrorHint}</Text>
              <PrimaryButton
                label={t.common.retry}
                onPress={() => void retryCityHub()}
                variant="secondary"
                testID="club-retry"
              />
            </View>
          </ProductCard>
        ) : effectiveCityHub ? (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t.compete.cityOfWeek}</Text>
              {cityOfWeek ? (
                <ProductCard variant="raised" testID="club-city-of-week">
                  <View style={s.stateContent}>
                    <Text style={s.cityName}>{cityOfWeek.name}</Text>
                    <Metric
                      label={t.compete.distance}
                      value={`${cityOfWeek.score_km.toFixed(1)} km`}
                    />
                  </View>
                </ProductCard>
              ) : (
                <ProductCard testID="club-city-of-week-empty">
                  <Text style={s.stateBody}>{t.compete.noCityOfWeek}</Text>
                </ProductCard>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t.compete.cityWars}</Text>
              {wars ? (
                <ProductCard testID="club-city-wars">
                  <View style={s.stateContent}>
                    <View style={s.warRow}>
                      <View style={s.warSide}>
                        <Metric
                          label={wars.tenant_a.name}
                          value={`${Math.round(wars.tenant_a.score).toLocaleString()} ${t.compete.vpUnit}`}
                        />
                      </View>
                      <Text style={s.versus}>{t.compete.vs}</Text>
                      <View style={s.warSide}>
                        <Metric
                          label={wars.tenant_b.name}
                          value={`${Math.round(wars.tenant_b.score).toLocaleString()} ${t.compete.vpUnit}`}
                        />
                      </View>
                    </View>
                    <Text style={s.lead}>
                      {t.compete.lead}: {wars.leader} · +{wars.delta.toFixed(2)} {t.compete.vpUnit}
                    </Text>
                  </View>
                </ProductCard>
              ) : (
                <ProductCard testID="club-city-wars-empty">
                  <Text style={s.stateBody}>{t.compete.waitingBattle}</Text>
                </ProductCard>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t.compete.leaderboard}</Text>
              <ProductCard testID="club-leaderboard">
                {leaderboard.length === 0 ? (
                  <Text style={s.stateBody}>{t.compete.empty}</Text>
                ) : (
                  <View style={s.leaderboard}>
                    {leaderboard.slice(0, 10).map((entry) => (
                      <View
                        key={`${entry.rank}-${entry.username}`}
                        style={[
                          s.leaderboardRow,
                          entry.is_me && s.leaderboardRowMine,
                        ]}
                      >
                        <Text style={s.rank}>#{entry.rank}</Text>
                        <Text style={s.rider} numberOfLines={1}>
                          {entry.is_me ? t.compete.you : entry.username}
                        </Text>
                        <Text style={s.score}>
                          {entry.score_km != null
                            ? `${entry.score_km.toFixed(1)} km`
                            : entry.points.toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ProductCard>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t.compete.nearbyQuests}</Text>
              {quests.length === 0 ? (
                <ProductCard testID="club-quests-empty">
                  <Text style={s.stateBody}>{t.compete.noQuests}</Text>
                </ProductCard>
              ) : (
                <View style={s.questStack}>
                  {quests.map((quest) => (
                    <ProductCard key={quest.id} testID={`club-quest-${quest.id}`}>
                      <View style={s.questContent}>
                        <Text style={s.questCategory}>{quest.category}</Text>
                        <Text style={s.questTitle}>{quest.name}</Text>
                        {quest.description ? (
                          <Text style={s.questMeta}>{quest.description}</Text>
                        ) : null}
                        <Text style={s.questMeta}>
                          {quest.latitude != null && quest.longitude != null
                            ? `${quest.latitude.toFixed(3)}, ${quest.longitude.toFixed(3)}`
                            : t.compete.noGeoData}
                        </Text>
                        <PrimaryButton
                          label={t.compete.startQuest}
                          onPress={openChallengeRide}
                          variant="secondary"
                          disabled={!onOpenStartRide}
                          testID={`club-challenge-start-${quest.id}`}
                        />
                      </View>
                    </ProductCard>
                  ))}
                </View>
              )}
            </View>

            <View style={s.navActions}>
              <PrimaryButton
                label={t.settings.globalLb}
                onPress={() => onOpenLeaderboard?.()}
                variant="secondary"
                disabled={!onOpenLeaderboard}
                testID="club-open-global-leaderboard"
              />
              <PrimaryButton
                label={t.compete.clubs}
                onPress={() => onOpenClubs?.()}
                variant="secondary"
                disabled={!onOpenClubs}
                testID="club-open-clubs"
              />
              <PrimaryButton
                label={t.compete.segments}
                onPress={() => onOpenSegments?.()}
                variant="secondary"
                disabled={!onOpenSegments}
                testID="club-open-segments"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};
