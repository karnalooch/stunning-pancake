/** Client FPS sampling for live-map auto-degrade hints. */

export type FpsSample = { fps: number; at: number };

export class LiveMapFpsMonitor {
    private frames = 0;
    private lastAt = 0;
    private sample: FpsSample = { fps: 60, at: 0 };

    tick(now = performance.now()): FpsSample | null {
        this.frames += 1;
        if (this.lastAt === 0) {
            this.lastAt = now;
            return null;
        }
        const elapsed = now - this.lastAt;
        if (elapsed < 1000) return null;
        const fps = Math.round((this.frames * 1000) / elapsed);
        this.frames = 0;
        this.lastAt = now;
        this.sample = { fps, at: now };
        return this.sample;
    }

    get last(): FpsSample {
        return this.sample;
    }

    shouldSuggestDegrade(threshold = 28): boolean {
        return this.sample.fps > 0 && this.sample.fps < threshold;
    }
}
