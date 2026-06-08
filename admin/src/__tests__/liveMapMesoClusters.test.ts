import { describe, it, expect } from 'vitest';
import { buildMesoClusterFeatureCollection } from '../modules/analytics/live-map/engine/liveMapMesoClusters';

describe('liveMapMesoClusters', () => {
    it('builds cluster features for dense grid at z=10', () => {
        const positions = Array.from({ length: 24 }, (_, i) => ({
            deviceId: `d-${i}`,
            lat: 52.23 + Math.floor(i / 6) * 0.003,
            lng: 21.01 + (i % 6) * 0.003,
            type: 'cycling',
            speed: 3,
        }));
        const fc = buildMesoClusterFeatureCollection(positions, 10, [20.9, 52.1, 21.2, 52.35]);
        expect(fc.features.length).toBeGreaterThan(0);
        const clusters = fc.features.filter((f) => f.properties?.point_count != null);
        expect(clusters.length).toBeGreaterThan(0);
    });
});
