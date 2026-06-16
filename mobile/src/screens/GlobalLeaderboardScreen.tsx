import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { ActivityService, type LeaderboardEntry } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { PixelText } from '../components/PixelText';
import { getVisionLeaderboardFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create(theme => {
  const c = theme.colors as Record<string, string>;
  return {
    ct: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rank: {
      width: 32,
      fontSize: 18,
      fontFamily: 'VT323',
      color: c.secondary,
    },
    name: {
      flex: 1,
      fontSize: 12,
      color: c.onBackground,
    },
    score: {
      fontSize: 16,
      fontFamily: 'VT323',
      color: c.primary,
    },
  };
});

export const GlobalLeaderboardScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const fixture = getVisionLeaderboardFixture(isVisionFixtures());
    if (fixture) {
      setEntries(fixture as unknown as LeaderboardEntry[]);
      setOffline(false);
      setLoading(false);
      return;
    }
    const cached = OfflineCacheService.getCityHub();
    if (cached?.leaderboard?.length) {
      setEntries(cached.leaderboard);
      setOffline(true);
    }
    setLoading(true);
    ActivityService.getCityHubSummary()
      .then((summary) => {
        OfflineCacheService.setCityHub(summary);
        setEntries(summary.leaderboard ?? []);
        setOffline(false);
      })
      .catch(() => {
        setOffline(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.ct}>
      <ScrollView contentContainerStyle={s.content}>
        {offline ? (
          <EdgeStateBanner
            title={t.errors.network}
            message={t.errors.offlineCache}
            variant="offline"
          />
        ) : null}
        {loading ? (
          <SkeletonBlock height={220} />
        ) : entries.length === 0 ? (
          <EmptyState message={t.demo.leaderboardEmpty} icon="leaderboard" hint={t.settings.globalLb} />
        ) : (
          entries.slice(0, 20).map((entry) => (
            <OrnateFrame
              key={`${entry.rank}-${entry.username}`}
              padding={12}
              tone={entry.is_me ? 'surface' : 'parchment'}
            >
              <View style={s.row}>
                <Text style={s.rank}>{entry.rank}</Text>
                <PixelText style={s.name}>{entry.is_me ? t.compete.you : entry.username}</PixelText>
                <Text style={s.score}>
                  {entry.score_km != null
                    ? `${entry.score_km.toFixed(1)} km`
                    : `${entry.points}`}
                </Text>
              </View>
            </OrnateFrame>
          ))
        )}
      </ScrollView>
    </View>
  );
};
