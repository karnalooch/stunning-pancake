import { useEffect, useMemo, useState } from 'react';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { withRetry } from '../services/apiRetry';
import { useGameProgress } from './useGameProgress';

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function summarize(list: ActivityItem[]) {
  const rides = list.length;
  const distanceKm = Math.round(
    list.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000,
  );
  const verified = list.filter((a) => a.is_verified).length;
  const latest = list[0] ?? null;

  const bars = WEEK_DAYS.map(() => 0.08);
  const now = new Date();
  for (const item of list) {
    if (!item.start_time) continue;
    const d = new Date(item.start_time);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0 || diffDays > 6) continue;
    const dayIdx = (d.getDay() + 6) % 7;
    const km = (item.distance ?? 0) / 1000;
    const prev = bars[dayIdx] ?? 0.08;
    bars[dayIdx] = Math.min(1, Math.max(prev, km / 30));
  }

  return { rides, distanceKm, verified, latest, weeklyBars: bars };
}

/** Single SSOT for streak (progression) + rides/distance (API/cache). */
export function useRiderStats() {
  const { progression } = useGameProgress();
  const [items, setItems] = useState<ActivityItem[]>(() => OfflineCacheService.getHistory() ?? []);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    withRetry(() => ActivityService.getHistory())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        OfflineCacheService.setHistory(list);
        setItems(list);
        setOffline(false);
      })
      .catch(() => {
        const cached = OfflineCacheService.getHistory();
        if (cached) {
          setItems(cached);
          setOffline(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => summarize(items), [items]);

  return {
    ...stats,
    streakDays: progression.streakDays,
    loading,
    offline,
  };
}
