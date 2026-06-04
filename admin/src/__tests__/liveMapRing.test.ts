import { describe, expect, it } from 'vitest';
import { DevicePositionRing, LIVE_MAP_RING_SIZE } from '../modules/analytics/liveMapRing';
import type { LiveMapPosition } from '../modules/analytics/liveMapMarkers';

function pos(id: string, lng: number, lat: number): LiveMapPosition {
    return {
        deviceId: id,
        name: id,
        type: 'bike',
        lng,
        lat,
        speed: 5,
        course: 90,
        lastUpdate: '',
    };
}

describe('DevicePositionRing', () => {
    it('retains recent path (ring size capped)', () => {
        const ring = new DevicePositionRing();
        let t = 1000;
        for (let i = 0; i < LIVE_MAP_RING_SIZE + 2; i++) {
            ring.push(pos('1', 21 + i * 0.01, 52), t);
            t += 400;
        }
        const c = ring.sample(t - 200);
        expect(c!.lng).toBeGreaterThan(21.02);
    });

    it('sample returns coordinate along path', () => {
        const ring = new DevicePositionRing();
        ring.push(pos('1', 21, 52), 1000);
        ring.push(pos('1', 21.01, 52), 1500);
        const c = ring.sample(1250);
        expect(c).not.toBeNull();
        expect(c!.lng).toBeGreaterThan(21);
        expect(c!.lng).toBeLessThan(21.01);
    });
});
