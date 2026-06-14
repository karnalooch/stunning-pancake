import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';

const stylesheet = StyleSheet.create(theme => {
  const c = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 10 },
    card: {
      backgroundColor: c.parchment,
      padding: 16,
      borderWidth: 2,
      borderColor: c.hudOutline,
      borderRadius: 8,
    },
    label: { fontSize: 10, fontWeight: '700', color: c.secondary, textTransform: 'uppercase' },
    val: { fontSize: 30, fontFamily: 'VT323', color: c.onBackground, marginTop: 6 },
    sub: { fontSize: 13, color: c.secondary, marginTop: 2 },
  };
});

function parseDurationSeconds(duration: string | null): number {
  if (!duration) return 0;
  const parts = duration.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

export const PerformanceTrendsScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;
  const [history, setHistory] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const cached = OfflineCacheService.getHistory();
    if (cached?.length) {
      setHistory(cached);
      setOffline(true);
    }
    setLoading(true);
    ActivityService.getHistory()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        OfflineCacheService.setHistory(list);
        setHistory(list);
        setOffline(false);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const recent = history.slice(0, 8);
    const totalDistanceKm = recent.reduce((acc, item) => acc + (item.distance ?? 0) / 1000, 0);
    const totalSeconds = recent.reduce((acc, item) => acc + parseDurationSeconds(item.duration), 0);
    const avgSpeedKmh =
      totalSeconds > 0 ? (totalDistanceKm / totalSeconds) * 3600 : 0;
    return {
      rides: recent.length,
      distanceKm: totalDistanceKm,
      avgSpeedKmh,
    };
  }, [history]);

  return (
    <View style={s.container}>
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
        ) : stats.rides === 0 ? (
          <EmptyState message={t.demo.trendsEmpty} icon="training" hint={t.settings.trends} />
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.label}>{t.profile.rides}</Text>
              <Text style={s.val}>{stats.rides}</Text>
              <Text style={s.sub}>{t.trends.lastActivities}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.label}>{t.profile.distance}</Text>
              <Text style={s.val}>{stats.distanceKm.toFixed(1)} km</Text>
              <Text style={s.sub}>{t.trends.rollingLoad}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.label}>{t.trends.avgSpeed}</Text>
              <Text style={s.val}>{stats.avgSpeedKmh.toFixed(1)} km/h</Text>
              <Text style={s.sub}>{t.trends.computedFromRideTime}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};
