import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LIVE_MAP_FILTERS,
    filtersToApiParams,
    filtersToSearchParams,
    mergeFilters,
    parseFiltersFromSearch,
} from '../modules/analytics/liveMapFilters';

describe('liveMapFilters', () => {
    it('maps activity and city to API params', () => {
        expect(filtersToApiParams({ ...DEFAULT_LIVE_MAP_FILTERS, activityType: 'bike', citySlug: 'krakow' })).toEqual({
            activity_type: 'bike',
            city: 'krakow',
        });
    });

    it('parses URL search params', () => {
        expect(parseFiltersFromSearch('activity=bike&city=krakow&presentation=1')).toEqual({
            activityType: 'bike',
            citySlug: 'krakow',
            presentationMode: true,
        });
    });

    it('serializes filters to hash query', () => {
        const qs = filtersToSearchParams({ ...DEFAULT_LIVE_MAP_FILTERS, activityType: 'run' }, 10.5);
        expect(qs).toContain('activity=run');
        expect(qs).toContain('z=10.5');
    });

    it('mergeFilters preserves defaults', () => {
        const merged = mergeFilters(DEFAULT_LIVE_MAP_FILTERS, { citySlug: 'warszawa' });
        expect(merged.citySlug).toBe('warszawa');
        expect(merged.activityType).toBe('all');
    });
});
