import { describe, expect, it } from 'vitest';
import {
    LIVE_MAP_TIER,
    apiDetailForTier,
    resolveLiveMapTier,
    tierShowsCityHubs,
    tierShowsRiderClusters,
    tierShowsRiderDetail,
} from '../modules/analytics/live-map/engine/liveMapEnterprise';

describe('liveMapEnterprise', () => {
    it('resolves macro / meso / micro bands', () => {
        expect(resolveLiveMapTier(6)).toBe('macro');
        expect(resolveLiveMapTier(9)).toBe('meso');
        expect(resolveLiveMapTier(11.5)).toBe('meso');
        expect(resolveLiveMapTier(12)).toBe('micro');
        expect(resolveLiveMapTier(14)).toBe('micro');
    });

    it('maps API detail to tier', () => {
        expect(apiDetailForTier(7)).toBe('standard');
        expect(apiDetailForTier(10)).toBe('standard');
        expect(apiDetailForTier(13)).toBe('full');
    });

    it('exposes one visualization family per tier', () => {
        expect(tierShowsCityHubs(7)).toBe(true);
        expect(tierShowsRiderClusters(7)).toBe(true);
        expect(tierShowsRiderClusters(10)).toBe(true);
        expect(tierShowsRiderDetail(10)).toBe(false);
        expect(tierShowsRiderDetail(13)).toBe(true);
        expect(LIVE_MAP_TIER.mesoMinZoom).toBe(9);
        expect(LIVE_MAP_TIER.microMinZoom).toBe(12);
    });
});
