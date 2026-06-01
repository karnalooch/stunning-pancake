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

    /** Instant update (pan/zoom fetch) — avoids dropping riders mid-interpolation. */
    snapTo(next: LiveMapPosition[]): void {
        this.cancel();
        this.from.clear();
        this.to.clear();
        for (const p of next) {
            if (!p.deviceId || !p.lat || !p.lng) continue;
            this.from.set(p.deviceId, { lng: p.lng, lat: p.lat });
        }
        this.onFrame(next, 1);
    }

    /** Smooth transition between poll updates (GPU-friendly single setData stream). */
    animateToward(next: LiveMapPosition[]): void {
        this.cancel();
        if (next.length > MAX_INTERP_POINTS) {
            this.snapTo(next);
            return;
        }

        const nextMap = new Map<string, Coord>();
        const nextById = new Map<string, LiveMapPosition>();
        for (const p of next) {
            if (!p.deviceId || !p.lat || !p.lng) continue;
            nextMap.set(p.deviceId, { lng: p.lng, lat: p.lat });
            nextById.set(p.deviceId, p);
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
            const ids = new Set([...this.from.keys(), ...nextMap.keys()]);
            for (const id of ids) {
                const target = nextById.get(id);
                if (!target) continue;
                const a = this.from.get(id);
                const b = nextMap.get(id) ?? a;
                if (!b) {
                    blended.push(target);
                    continue;
                }
                if (!a) {
                    blended.push(target);
                    continue;
                }
                blended.push({
                    ...target,
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
