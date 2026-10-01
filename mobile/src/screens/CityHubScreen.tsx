import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Metric, PrimaryButton } from '../components/product';
import { RoadbookPage, RoadbookSection, RoadbookRow, RoadbookNotice, roadbookStyles as s } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionCityHubFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useI18n } from '../i18n/useI18n';
import { ActivityService, type CityHubSummary } from '../services/api';
import { withRetry, isOfflineTransportError } from '../services/apiRetry';
import { OfflineCacheService } from '../services/OfflineCacheService';

export const CityHubScreen: React.FC<{
  user?: { username: string } | null; onOpenStartRide?: () => void;
  onOpenLeaderboard?: () => void; onOpenClubs?: () => void; onOpenSegments?: () => void;
}> = ({ onOpenStartRide, onOpenLeaderboard, onOpenClubs, onOpenSegments }) => {
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const fixturesEnabled = isVisionFixtures();
  const fixture = getVisionCityHubFixture(fixturesEnabled);
  const fixtureSummary = useMemo<CityHubSummary>(() => ({
    active_event: null,
    city_of_week: { tenant_id: 'fixture_lublin', name: fixture?.cityOfWeek.name ?? 'Lublin', score_km: (fixture?.cityWars.left.score ?? 1240) / 10 },
    city_wars: { event_id: 1,
      tenant_a: { id: 'fixture_lublin', name: fixture?.cityWars.left.name ?? 'Lublin', score: fixture?.cityWars.left.score ?? 1240 },
      tenant_b: { id: 'fixture_warszawa', name: fixture?.cityWars.right.name ?? 'Warszawa', score: fixture?.cityWars.right.score ?? 1180 },
      leader: (fixture?.cityWars.left.score ?? 1240) >= (fixture?.cityWars.right.score ?? 1180)
        ? (fixture?.cityWars.left.name ?? 'Lublin') : (fixture?.cityWars.right.name ?? 'Warszawa'),
      delta: Math.abs((fixture?.cityWars.left.score ?? 1240) - (fixture?.cityWars.right.score ?? 1180)) },
    leaderboard: (fixture?.leaderboard ?? []).map((entry) => ({ rank: entry.rank, username: entry.name, points: entry.score, score_km: entry.score, is_me: false })),
    my_rank: null,
    quests: (fixture?.quests ?? []).map((quest) => ({ id: quest.id, name: quest.title, category: 'QUEST',
      description: `${quest.distanceKm.toFixed(2)} km`, latitude: null, longitude: null })),
  }), [fixture]);
  const [cityHubLive, setCityHubLive] = useState<CityHubSummary | null>(() => fixturesEnabled ? null : OfflineCacheService.getCityHub());
  const [loading, setLoading] = useState(!fixturesEnabled);
  const [loadError, setLoadError] = useState(false);
  const [usingCached, setUsingCached] = useState(!fixturesEnabled && cityHubLive !== null);
  const alive = useRef(false);
  const flight = useRef(0);
  const readCityHub = useCallback(() => {
    if (fixturesEnabled) return;
    const request = ++flight.current;
    return withRetry(() => ActivityService.getCityHubSummary()).then((summary) => {
      if (!alive.current || request !== flight.current) return;
      OfflineCacheService.setCityHub(summary);
      setCityHubLive(summary); setUsingCached(false); setLoadError(false);
    }).catch((error: unknown) => {
      if (alive.current && request === flight.current) {
        setLoadError(true);
        if (!isOfflineTransportError(error)) { setCityHubLive(null); setUsingCached(false); }
      }
    }).finally(() => {
      if (alive.current && request === flight.current) setLoading(false);
    });
  }, [fixturesEnabled]);
  useEffect(() => {
    alive.current = true;
    void readCityHub();
    return () => { alive.current = false; flight.current += 1; };
  }, [readCityHub]);
  const retryCityHub = () => { setLoading(true); setLoadError(false); void readCityHub(); };
  const effectiveCityHub = fixturesEnabled ? fixtureSummary : cityHubLive;
  const event = effectiveCityHub?.active_event;
  const cityOfWeek = effectiveCityHub?.city_of_week;
  const wars = effectiveCityHub?.city_wars;
  const leaderboard = effectiveCityHub?.leaderboard ?? [];
  const quests = effectiveCityHub?.quests ?? [];
  return <RoadbookPage title={copy.club} subtitle={copy.community} testID="roadbook-club" sampleLabel={fixturesEnabled ? copy.sample : undefined}>
    <Text style={s.body}>{copy.communityBody}</Text>
    <RoadbookSection>
      <RoadbookRow label={t.compete.clubs} onPress={onOpenClubs} testID="club-open-clubs" />
      <RoadbookRow label={t.compete.segments} onPress={onOpenSegments} testID="club-open-segments" />
      <RoadbookRow label={t.compete.leaderboard} onPress={onOpenLeaderboard} testID="club-open-global-leaderboard" />
    </RoadbookSection>
    {!fixturesEnabled && usingCached ? <RoadbookNotice testID="club-cached-state"
      title={loadError ? t.compete.cachedOfflineTitle : t.compete.refreshingCached}
      message={loadError ? t.compete.cachedOfflineBody : t.compete.refreshingCachedBody} /> : null}
    {loadError ? <RoadbookNotice error testID="club-load-error" title={t.compete.loadError} message={t.compete.loadErrorHint}
      action={<PrimaryButton label={t.common.retry} variant="secondary" onPress={retryCityHub} testID="club-retry" />} /> : null}
    {loading && !effectiveCityHub ? <SkeletonBlock height={220} /> : effectiveCityHub ? <>
      <RoadbookSection title={copy.event}>
        {event ? <RoadbookNotice testID="club-current-event" title={event.title}
          message={`${event.sport_filter} · ${event.start_date} — ${event.end_date}`} /> : <Text style={s.body}>{copy.noEvent}</Text>}
      </RoadbookSection>
      <RoadbookSection title={copy.communityActivity}>
        {cityOfWeek ? <View testID="club-city-of-week" style={s.stack}><Text style={s.caption}>{t.compete.cityOfWeek}</Text>
          <Metric label={cityOfWeek.name} value={`${cityOfWeek.score_km.toFixed(1)} km`} /></View>
          : <Text testID="club-city-of-week-empty" style={s.body}>{t.compete.noCityOfWeek}</Text>}
        {wars ? <View testID="club-city-wars" style={s.stack}>
          <Text style={s.caption}>{t.compete.cityWars}</Text><View style={s.metrics}>
            <View style={s.metric}><Metric label={wars.tenant_a.name} value={`${Math.round(wars.tenant_a.score)} ${t.compete.vpUnit}`} /></View>
            <View style={s.metric}><Metric label={wars.tenant_b.name} value={`${Math.round(wars.tenant_b.score)} ${t.compete.vpUnit}`} /></View>
          </View><Text style={s.body}>{t.compete.lead}: {wars.leader} · +{wars.delta.toFixed(2)} {t.compete.vpUnit}</Text>
        </View> : <Text testID="club-city-wars-empty" style={s.body}>{t.compete.waitingBattle}</Text>}
      </RoadbookSection>
      <RoadbookSection title={t.compete.leaderboard} testID="club-leaderboard">
        {leaderboard.length ? leaderboard.slice(0, 10).map((entry) => <RoadbookRow key={`${entry.rank}-${entry.username}`}
          label={`#${entry.rank} · ${entry.is_me ? t.compete.you : entry.username}`}
          detail={entry.score_km != null ? `${entry.score_km.toFixed(1)} km` : entry.points.toLocaleString()} />)
          : <Text style={s.body}>{t.compete.empty}</Text>}
      </RoadbookSection>
      <RoadbookSection title={t.compete.nearbyQuests}>
        {quests.length ? quests.map((quest) => <View key={quest.id} testID={`club-quest-${quest.id}`} style={s.stack}>
          <RoadbookRow label={quest.name} detail={quest.description || quest.category} />
          <Text style={s.caption}>{quest.latitude != null && quest.longitude != null
            ? `${quest.latitude.toFixed(3)}, ${quest.longitude.toFixed(3)}` : t.compete.noGeoData}</Text>
          <PrimaryButton label={t.dashboard.startRide} variant="secondary" onPress={() => onOpenStartRide?.()}
            disabled={!onOpenStartRide} testID={`club-challenge-start-${quest.id}`} />
        </View>) : <Text testID="club-quests-empty" style={s.body}>{t.compete.noQuests}</Text>}
      </RoadbookSection>
    </> : null}
  </RoadbookPage>;
};
