import { describe, it, expect } from 'vitest';
import { resolveInterpDurationMs } from '../modules/analytics/live-map/engine/liveMapInterp';

describe('liveMapInterp', () => {
    it('resolveInterpDurationMs tracks poll interval (~90%)', () => {
        expect(resolveInterpDurationMs(1100)).toBe(990);
        expect(resolveInterpDurationMs(2400)).toBe(2160);
        expect(resolveInterpDurationMs(400)).toBe(450);
        expect(resolveInterpDurationMs(4000)).toBe(2600);
    });
});
