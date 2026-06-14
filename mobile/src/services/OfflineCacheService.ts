import type { ActivityItem, CityHubSummary } from './api';
import { getAppStorage } from '../app/storage';

const HISTORY_KEY = 'cache_activity_history';
const CITY_HUB_KEY = 'cache_city_hub';
const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEnvelope<T> = { savedAt: number; data: T };

function read<T>(key: string): T | null {
  const raw = getAppStorage().getString(key);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - env.savedAt > CACHE_TTL_MS) return null;
    return env.data;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  const env: CacheEnvelope<T> = { savedAt: Date.now(), data };
  getAppStorage().set(key, JSON.stringify(env));
}

export const OfflineCacheService = {
  getHistory(): ActivityItem[] | null {
    return read<ActivityItem[]>(HISTORY_KEY);
  },
  setHistory(items: ActivityItem[]): void {
    write(HISTORY_KEY, items);
  },
  getCityHub(): CityHubSummary | null {
    return read<CityHubSummary>(CITY_HUB_KEY);
  },
  setCityHub(summary: CityHubSummary): void {
    write(CITY_HUB_KEY, summary);
  },
};
