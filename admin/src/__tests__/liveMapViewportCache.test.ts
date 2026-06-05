import { describe, expect, it } from 'vitest';
import {
    clearViewportCache,
    getViewportCache,
    setViewportCache,
    viewportCacheKey,
} from '../modules/analytics/liveMapViewportCache';
import { DEFAULT_LIVE_MAP_FILTERS } from '../modules/analytics/liveMapFilters';

describe('liveMapViewportCache', () => {
    it('viewportCacheKey includes detail, bbox, and filters', () => {
        const key = viewportCacheKey('standard', '19,52,20,53', {
            ...DEFAULT_LIVE_MAP_FILTERS,
            activityType: 'bike',
            citySlug: 'krakow',
        });
        expect(key).toContain('standard|19,52,20,53|');
        expect(key).toContain('activity_type=bike');
        expect(key).toContain('city=krakow');
    });

    it('stores and retrieves viewport snapshots', () => {
        clearViewportCache();
        const key = viewportCacheKey('full', '1,2,3,4', DEFAULT_LIVE_MAP_FILTERS);
        setViewportCache(key, {
            positions: [{ deviceId: 'd1', lat: 52, lng: 21, name: 'A', type: 'bike', speed: 0, course: 0, lastUpdate: '' }],
            meta: { cached: true },
            etag: '"abc"',
        });
        const hit = getViewportCache(key);
        expect(hit?.positions).toHaveLength(1);
        expect(hit?.etag).toBe('"abc"');
        clearViewportCache();
    });
});
