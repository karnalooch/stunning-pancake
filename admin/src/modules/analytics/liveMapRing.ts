import type { LiveMapPosition } from './liveMapMarkers';
import { pointAlongPolyline, segmentLengthM, type LngLat } from './liveMapPolyline';

export const LIVE_MAP_RING_SIZE = 3;
const MIN_MOVE_M = 0.4;

type RingPoint = LngLat & { t: number };

/** Per-device ring buffer (2–3 points) for polyline interpolation. */
export class DevicePositionRing {
    private points: RingPoint[] = [];
    meta: LiveMapPosition | null = null;

    push(pos: LiveMapPosition, now = performance.now()): void {
        const lat = Number(pos.lat);
        const lng = Number(pos.lng);
        if (!pos.deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        this.meta = pos;
        const last = this.points[this.points.length - 1];
        if (last) {
            const d = segmentLengthM(last, { lng, lat });
            if (d < MIN_MOVE_M) {
                this.points[this.points.length - 1] = { lng, lat, t: now };
                return;
            }
        }
        this.points.push({ lng, lat, t: now });
        while (this.points.length > LIVE_MAP_RING_SIZE) {
            this.points.shift();
        }
    }

    clear(): void {
        this.points = [];
        this.meta = null;
    }

    sample(now = performance.now()): LngLat | null {
        if (this.points.length === 0 || !this.meta) return null;
        if (this.points.length === 1) return this.points[0];

        const first = this.points[0];
        const last = this.points[this.points.length - 1];
        const span = Math.max(1, last.t - first.t);
        const elapsed = Math.max(0, now - first.t);
        let t = Math.min(1, elapsed / span);

        const speed = this.meta.speed ?? 0;
        if (speed > 0.35) {
            let totalLen = 0;
            for (let i = 1; i < this.points.length; i++) {
                totalLen += segmentLengthM(this.points[i - 1], this.points[i]);
            }
            if (totalLen > 1) {
                const sinceLast = Math.max(0, (now - last.t) / 1000);
                const extra = Math.min(sinceLast * speed, 80) / totalLen;
                t = Math.min(1, t + extra * 0.35);
            }
        }

        return pointAlongPolyline(this.points, t) ?? last;
    }
}
