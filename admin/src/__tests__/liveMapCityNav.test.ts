import { describe, it, expect, beforeEach } from 'vitest';
import {
    cityHasMesoViewportCache,
    mesoBboxForCitySlug,
    cityFlyParams,
    mesoFlyZoom,
} from '../modules/analytics/live-map/engine/liveMapCityNav';
import { DEFAULT_LIVE_MAP_FILTERS } from '../modules/analytics/live-map/engine/liveMapFilters';
import { setViewportCache, clearViewportCache, viewportCacheKey } from '../modules/analytics/live-map/engine/liveMapViewportCache';
import { apiDetailForZoom } from '../modules/analytics/live-map/engine/liveMapZoom';

describe('liveMapCityNav', () => {
    beforeEach(() => {
        clearViewportCache();
    });

    it('mesoBboxForCitySlug returns padded bbox', () => {
        const bbox = mesoBboxForCitySlug('warszawa');
        expect(bbox).toMatch(/^[\d.-]+,[\d.-]+,[\d.-]+,[\d.-]+$/);
    });

    it('cityHasMesoViewportCache true when SWR populated', () => {
        const slug = 'warszawa';
        const bbox = mesoBboxForCitySlug(slug)!;
        const detail = apiDetailForZoom(mesoFlyZoom());
        const key = viewportCacheKey(detail, bbox, { ...DEFAULT_LIVE_MAP_FILTERS, citySlug: slug });
        setViewportCache(key, {
            positions: [{ deviceId: '1', lat: 52.23, lng: 21.01, type: 'bike' }],
            meta: null,
        });
        expect(cityHasMesoViewportCache(slug, DEFAULT_LIVE_MAP_FILTERS)).toBe(true);
    });

    it('cityFlyParams instant when cache warm', () => {
        const slug = 'krakow';
        const bbox = mesoBboxForCitySlug(slug)!;
        const detail = apiDetailForZoom(mesoFlyZoom());
        const key = viewportCacheKey(detail, bbox, { ...DEFAULT_LIVE_MAP_FILTERS, citySlug: slug });
        setViewportCache(key, {
            positions: [{ deviceId: '9', lat: 50.06, lng: 19.94, type: 'run' }],
            meta: null,
        });
        const fly = cityFlyParams(slug, DEFAULT_LIVE_MAP_FILTERS);
        expect(fly?.instant).toBe(true);
        expect(fly?.duration).toBe(0);
    });
});
