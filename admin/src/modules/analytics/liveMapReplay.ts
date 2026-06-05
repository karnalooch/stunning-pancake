import type { LiveMapPosition } from './liveMapMarkers';

export type LiveMapReplayFrame = {
    at: number;
    positions: LiveMapPosition[];
    meta?: Record<string, unknown>;
};

const MAX_FRAMES = 120;

export class LiveMapReplayBuffer {
    private frames: LiveMapReplayFrame[] = [];

    push(positions: LiveMapPosition[], meta?: Record<string, unknown>): void {
        this.frames.push({ at: Date.now(), positions, meta });
        if (this.frames.length > MAX_FRAMES) {
            this.frames.shift();
        }
    }

    getFrames(): LiveMapReplayFrame[] {
        return [...this.frames];
    }

    frameAt(index: number): LiveMapReplayFrame | null {
        if (index < 0 || index >= this.frames.length) return null;
        return this.frames[index];
    }

    get length(): number {
        return this.frames.length;
    }

    clear(): void {
        this.frames = [];
    }
}
