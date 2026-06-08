import { describe, it, expect } from 'vitest';
import {
    progressiveLimitForZoom,
    shouldFetchFullLimitAfterFast,
    PROGRESSIVE_FAST_LIMIT,
} from '../modules/analytics/live-map/engine/liveMapViewportFetch';

describe('liveMapViewportFetch', () => {
    it('caps fast limit at PROGRESSIVE_FAST_LIMIT', () => {
        expect(progressiveLimitForZoom(10)).toBe(PROGRESSIVE_FAST_LIMIT);
        expect(progressiveLimitForZoom(6)).toBeLessThanOrEqual(PROGRESSIVE_FAST_LIMIT);
    });

    it('requests full limit when fast response is capped', () => {
        expect(shouldFetchFullLimitAfterFast(1200, 4000, 800, true)).toBe(true);
    });

    it('skips full fetch when fast limit already equals full', () => {
        expect(shouldFetchFullLimitAfterFast(800, 800, 400, false)).toBe(false);
    });

    it('requests full when fast returned at cap count', () => {
        expect(shouldFetchFullLimitAfterFast(1200, 4000, 1200, false)).toBe(true);
    });
});
