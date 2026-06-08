import { describe, expect, it } from 'vitest';
import { pointAlongPolyline, segmentLengthM } from '../modules/analytics/live-map/engine/liveMapPolyline';

describe('liveMapPolyline', () => {
    it('segmentLengthM is positive for distinct points', () => {
        const d = segmentLengthM({ lng: 21, lat: 52 }, { lng: 21.01, lat: 52.01 });
        expect(d).toBeGreaterThan(10);
    });

    it('pointAlongPolyline at t=0 and t=1', () => {
        const pts = [
            { lng: 21, lat: 52 },
            { lng: 21.01, lat: 52 },
            { lng: 21.02, lat: 52.01 },
        ];
        expect(pointAlongPolyline(pts, 0)).toEqual(pts[0]);
        expect(pointAlongPolyline(pts, 1)).toEqual(pts[2]);
    });

    it('midpoint lies between endpoints', () => {
        const pts = [{ lng: 0, lat: 0 }, { lng: 0.01, lat: 0 }];
        const mid = pointAlongPolyline(pts, 0.5);
        expect(mid!.lng).toBeGreaterThan(0);
        expect(mid!.lng).toBeLessThan(0.01);
    });
});
