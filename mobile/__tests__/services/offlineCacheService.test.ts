import type { ActivityItem } from '../../src/services/api';
import { OfflineCacheService } from '../../src/services/OfflineCacheService';

const mem = new Map<string, string>();

jest.mock('../../src/bootstrap/storage', () => ({
  getAppStorage: () => ({
    getString: (key: string) => mem.get(key),
    set: (key: string, value: string) => {
      mem.set(key, value);
    },
    delete: (key: string) => {
      mem.delete(key);
    },
    clearAll: () => mem.clear(),
    getAllKeys: () => [...mem.keys()],
    contains: (key: string) => mem.has(key),
  }),
}));

function ride(id: number): ActivityItem {
  return {
    id,
    type: 'BIKE',
    start_time: '2026-09-19T08:00:00.000Z',
    end_time: '2026-09-19T09:00:00.000Z',
    distance: 30_000,
    duration: '01:00:00',
    is_verified: true,
    verification_score: 1,
  };
}

describe('OfflineCacheService ride history', () => {
  beforeEach(() => {
    mem.clear();
  });

  test('clearHistory removes cached activity history', () => {
    OfflineCacheService.setHistory([ride(1)]);
    expect(OfflineCacheService.getHistory()?.map((item) => item.id)).toEqual([1]);

    OfflineCacheService.clearHistory();

    expect(OfflineCacheService.getHistory()).toBeNull();
  });
});
