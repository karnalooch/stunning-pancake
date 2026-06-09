import { describe, it, expect } from 'vitest';
import { LiveMapFpsMonitor } from '../modules/analytics/live-map/engine/liveMapPerformance';

describe('LiveMapFpsMonitor', () => {
    it('steps degrade down after consecutive low FPS samples', () => {
        const mon = new LiveMapFpsMonitor();
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 20, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBeNull();
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 18, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBe('labels');
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 16, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBeNull();
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 15, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBe('symbols');
    });

    it('recovers one degrade step after consecutive high FPS samples', () => {
        const mon = new LiveMapFpsMonitor();
        mon.degradeLevel = 'symbols';
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 55, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBeNull();
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 58, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBeNull();
        (mon as unknown as { sample: { fps: number } }).sample = { fps: 60, at: Date.now() };
        expect(mon.evaluateDegrade(28, 34)).toBe('labels');
    });
});
