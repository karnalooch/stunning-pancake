import type { LiveMapPosition } from './liveMapMarkers';
import { DevicePositionRing } from './liveMapRing';

const MAX_INTERP_POINTS = 4000;
const SET_DATA_MIN_INTERVAL_MS = 33;

export type LiveInterpOptions = {
    /** Legacy — ignored; polyline ring uses wall-clock sampling. */
    durationMs?: number;
};

/** Clamp client blend window to poll cadence (used for status / docs). */
export function resolveInterpDurationMs(pollIntervalMs: number): number {
    const ms = Math.round(pollIntervalMs * 0.9);
    return Math.max(450, Math.min(2600, ms));
}

/**
 * GPU-friendly motion: 2–3 point ring per device, interpolate along polyline (smooth corners).
 */
export class LivePositionInterpolator {
    private rings = new Map<string, DevicePositionRing>();
    private rafId: number | null = null;
    private lastPushAt = 0;
    private onFrame: (positions: LiveMapPosition[], t: number) => void;

    constructor(onFrame: (positions: LiveMapPosition[], t: number) => void) {
        this.onFrame = onFrame;
    }

    cancel(): void {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    private buildPositions(now: number): LiveMapPosition[] {
        const out: LiveMapPosition[] = [];
        for (const ring of this.rings.values()) {
            const coord = ring.sample(now);
            const meta = ring.meta;
            if (!coord || !meta) continue;
            out.push({ ...meta, lng: coord.lng, lat: coord.lat });
        }
        return out;
    }

    private pushFrame(t: number, force = false): void {
        const now = performance.now();
        if (!force && now - this.lastPushAt < SET_DATA_MIN_INTERVAL_MS) return;
        this.lastPushAt = now;
        this.onFrame(this.buildPositions(now), t);
    }

    private ensureLoop(): void {
        if (this.rafId != null) return;
        const tick = (now: number) => {
            this.pushFrame(1);
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    /** Instant update (pan/zoom fetch). */
    snapTo(next: LiveMapPosition[]): void {
        this.cancel();
        this.rings.clear();
        if (next.length > MAX_INTERP_POINTS) {
            const now = performance.now();
            for (const p of next.slice(0, MAX_INTERP_POINTS)) {
                if (!p.deviceId || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
                const ring = new DevicePositionRing();
                ring.push(p, now);
                this.rings.set(p.deviceId, ring);
            }
            this.pushFrame(1, true);
            return;
        }
        const now = performance.now();
        for (const p of next) {
            if (!p.deviceId || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
            const ring = new DevicePositionRing();
            ring.push(p, now);
            this.rings.set(p.deviceId, ring);
        }
        this.pushFrame(1, true);
    }

    /** SSE / HTTP snapshot — append to per-device rings. */
    ingestSnapshot(next: LiveMapPosition[]): void {
        if (next.length > MAX_INTERP_POINTS) {
            this.snapTo(next);
            return;
        }
        const now = performance.now();
        const seen = new Set<string>();
        for (const p of next) {
            if (!p.deviceId || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
            seen.add(p.deviceId);
            let ring = this.rings.get(p.deviceId);
            if (!ring) {
                ring = new DevicePositionRing();
                this.rings.set(p.deviceId, ring);
            }
            ring.push(p, now);
        }
        for (const id of [...this.rings.keys()]) {
            if (!seen.has(id)) this.rings.delete(id);
        }
        this.pushFrame(1, true);
        this.ensureLoop();
    }

    /** Single rider from optional telemetry WS broadcast. */
    pushDelta(p: LiveMapPosition): void {
        if (!p.deviceId || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
        let ring = this.rings.get(p.deviceId);
        if (!ring) {
            ring = new DevicePositionRing();
            this.rings.set(p.deviceId, ring);
        }
        ring.push(p, performance.now());
        this.ensureLoop();
    }

    /** @deprecated use ingestSnapshot — kept for call-site compat */
    animateToward(next: LiveMapPosition[], _opts?: LiveInterpOptions): void {
        this.ingestSnapshot(next);
    }
}
