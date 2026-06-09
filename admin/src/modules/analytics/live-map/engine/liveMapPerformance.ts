/** MapLibre render FPS + hysteresis auto-degrade for live-map. */

export type FpsSample = { fps: number; at: number };

export type PerformanceDegradeLevel = 'none' | 'labels' | 'symbols';

type MapRenderHost = {
    on: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
};

export class LiveMapFpsMonitor {
    private frames = 0;
    private lastAt = 0;
    private sample: FpsSample = { fps: 60, at: 0 };
    private boundMap: MapRenderHost | null = null;
    private onRender = () => {
        this.frames += 1;
        const now = performance.now();
        if (this.lastAt === 0) {
            this.lastAt = now;
            return;
        }
        const elapsed = now - this.lastAt;
        if (elapsed < 1000) return;
        this.sample = { fps: Math.round((this.frames * 1000) / elapsed), at: now };
        this.frames = 0;
        this.lastAt = now;
    };

    private lowStreak = 0;
    private highStreak = 0;
    degradeLevel: PerformanceDegradeLevel = 'none';

    bindMap(map: MapRenderHost): void {
        this.unbindMap();
        this.boundMap = map;
        map.on('render', this.onRender);
    }

    unbindMap(): void {
        this.boundMap?.off?.('render', this.onRender);
        this.boundMap = null;
    }

    get last(): FpsSample {
        return this.sample;
    }

    shouldSuggestDegrade(threshold = 28): boolean {
        return this.sample.fps > 0 && this.sample.fps < threshold;
    }

    /**
     * Step down after 2 consecutive low samples; recover one step after 3 high samples.
     * Returns new level when it changes.
     */
    evaluateDegrade(
        lowThreshold = 28,
        recoverThreshold = 34,
    ): PerformanceDegradeLevel | null {
        const fps = this.sample.fps;
        if (fps <= 0) return null;

        if (fps < lowThreshold) {
            this.lowStreak += 1;
            this.highStreak = 0;
        } else if (fps >= recoverThreshold) {
            this.highStreak += 1;
            this.lowStreak = 0;
        } else {
            this.lowStreak = 0;
            this.highStreak = 0;
        }

        const prev = this.degradeLevel;
        if (this.lowStreak >= 2) {
            this.lowStreak = 0;
            if (this.degradeLevel === 'none') this.degradeLevel = 'labels';
            else if (this.degradeLevel === 'labels') this.degradeLevel = 'symbols';
        }
        if (this.highStreak >= 3) {
            this.highStreak = 0;
            if (this.degradeLevel === 'symbols') this.degradeLevel = 'labels';
            else if (this.degradeLevel === 'labels') this.degradeLevel = 'none';
        }

        return this.degradeLevel !== prev ? this.degradeLevel : null;
    }

    resetDegrade(): void {
        this.degradeLevel = 'none';
        this.lowStreak = 0;
        this.highStreak = 0;
    }
}
