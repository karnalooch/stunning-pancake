import { useCallback, useEffect, useMemo, useState } from 'react';

import { summarizeRiderHistory } from '../home/riderStatsSummary';
import { ActivityService, type ActivityItem } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { withRetry } from '../services/apiRetry';
import { useGameProgress } from './useGameProgress';

type RiderHistoryLoad = {
  items: ActivityItem[];
  offline: boolean;
  error: boolean;
};

async function loadRiderHistory(): Promise<RiderHistoryLoad> {
  try {
    const data = await withRetry(() => ActivityService.getHistory());
    const items = Array.isArray(data) ? data : [];
    OfflineCacheService.setHistory(items);
    return { items, offline: false, error: false };
  } catch {
    const cached = OfflineCacheService.getHistory();

    if (Array.isArray(cached)) {
      return { items: cached, offline: true, error: false };
    }

    return { items: [], offline: false, error: true };
  }
}

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
    const result = await loadRiderHistory();
    setItems(result.items);
    setOffline(result.offline);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadRiderHistory().then((result) => {
      if (cancelled) return;
      setItems(result.items);
      setOffline(result.offline);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
