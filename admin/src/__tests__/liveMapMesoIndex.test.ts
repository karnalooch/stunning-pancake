import { describe, it, expect, beforeEach } from 'vitest';
import { MesoClusterIndex, positionsFingerprint } from '../modules/analytics/live-map/engine/liveMapMesoIndex';

describe('liveMapMesoIndex', () => {
    const sample = Array.from({ length: 12 }, (_, i) => ({
        deviceId: `d-${i}`,
        lat: 52.23 + Math.floor(i / 4) * 0.002,
        lng: 21.01 + (i % 4) * 0.002,
        type: 'cycling',
    }));

    beforeEach(() => {
        new MesoClusterIndex().reset();
    });

    it('fingerprint changes when positions change', () => {
        const a = positionsFingerprint(sample);
        const b = positionsFingerprint([...sample, { deviceId: 'x', lat: 52.3, lng: 21.1, type: 'run' }]);
        expect(a).not.toBe(b);
    });

    it('reuses index on zoom-only change', () => {
        const index = new MesoClusterIndex();
        index.ensureLoaded(sample, 10);
        const fpBefore = (index as unknown as { fingerprint: string }).fingerprint;
        index.ensureLoaded(sample, 11);
        const fpAfter = (index as unknown as { fingerprint: string }).fingerprint;
        expect(fpBefore).toBe(fpAfter);
        const z10 = index.getFeatureCollection(sample, 10, [20.9, 52.1, 21.2, 52.35]);
        const z11 = index.getFeatureCollection(sample, 11, [20.9, 52.1, 21.2, 52.35]);
        expect(z10.features.length).toBeGreaterThan(0);
        expect(z11.features.length).toBeGreaterThan(0);
    });
});
