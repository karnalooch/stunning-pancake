import type { LiveMapPosition } from './liveMapMarkers';

const MAX_INTERP_POINTS = 4000;
const INTERP_MS = 320;

type Coord = { lng: number; lat: number };

export class LivePositionInterpolator {
    private from = new Map<string, Coord>();
    private to = new Map<string, Coord>();
    private rafId: number | null = null;
    private startedAt = 0;

    constructor(
        private onFrame: (positions: LiveMapPosition[], t: number) => void,
    ) {}

    cancel(): void {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /** Smooth transition between poll updates (GPU-friendly single setData stream). */
    animateToward(next: LiveMapPosition[]): void {
        this.cancel();
        if (next.length > MAX_INTERP_POINTS) {
            this.from.clear();
            this.to.clear();
            this.onFrame(next, 1);
            return;
        }

        const nextMap = new Map<string, Coord>();
        for (const p of next) {
            if (!p.deviceId || !p.lat || !p.lng) continue;
            nextMap.set(p.deviceId, { lng: p.lng, lat: p.lat });
        }

        if (this.from.size === 0) {
            this.from = nextMap;
            this.onFrame(next, 1);
            return;
        }

        this.to = nextMap;
        this.startedAt = performance.now();

        const tick = () => {
            const elapsed = performance.now() - this.startedAt;
            const t = Math.min(1, elapsed / INTERP_MS);
            const eased = t * (2 - t);
            const blended: LiveMapPosition[] = [];
            for (const p of next) {
                if (!p.deviceId) continue;
                const a = this.from.get(p.deviceId);
                const b = this.to.get(p.deviceId) ?? a;
                if (!b) {
                    blended.push(p);
                    continue;
                }
                if (!a) {
                    blended.push(p);
                    continue;
                }
                blended.push({
                    ...p,
                    lng: a.lng + (b.lng - a.lng) * eased,
                    lat: a.lat + (b.lat - a.lat) * eased,
                });
            }
            this.onFrame(blended, eased);
            if (t < 1) {
                this.rafId = requestAnimationFrame(tick);
            } else {
                this.from = this.to;
                this.rafId = null;
            }
        };
        this.rafId = requestAnimationFrame(tick);
    }
}
