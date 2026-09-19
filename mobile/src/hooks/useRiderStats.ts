import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { withRetry } from '../services/apiRetry';
import { useGameProgress } from './useGameProgress';

import { summarizeRiderHistory } from '../home/riderStatsSummary';

/** Single SSOT for streak (progression) + rides/distance (API/cache). */
export function useRiderStats() {
  const { progression } = useGameProgress();
  const [items, setItems] = useState<ActivityItem[]>(
    () => OfflineCacheService.getHistory() ?? [],
  );
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const data = await withRetry(() => ActivityService.getHistory());
      const list = Array.isArray(data) ? data : [];
      OfflineCacheService.setHistory(list);
      setItems(list);
      setOffline(false);
      setError(false);
    } catch {
      const cached = OfflineCacheService.getHistory();

      if (Array.isArray(cached)) {
        setItems(cached);
        setOffline(true);
        setError(false);
      } else {
        setItems([]);
        setOffline(false);
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => summarizeRiderHistory(items), [items]);

  return {
    ...stats,
    streakDays: progression.streakDays,
    loading,
    offline,
    error,
    refresh,
  };
}
