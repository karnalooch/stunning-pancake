import { describe, expect, it } from 'vitest';
import {
    shouldSkipActivityGeneration,
    validateMassForm,
    validateMassPopulation,
} from './massSimForm';

describe('massSimForm validation', () => {
    it('rejects cyclists outside bounds', () => {
        const errors = validateMassPopulation({
            cyclists: 5,
            generateActivities: true,
            activePercent: 29,
            cheatPercent: 6,
            liveEnabled: true,
        });
        expect(errors.cyclists).toBeTruthy();
    });

    it('accepts valid configuration', () => {
        const errors = validateMassForm({
            cyclists: 1000,
            generateActivities: true,
            activePercent: 29,
            cheatPercent: 6,
            liveEnabled: true,
        });
        expect(Object.keys(errors)).toHaveLength(0);
    });

    it('skips activity generation only at the high-scale threshold', () => {
        expect(shouldSkipActivityGeneration(149_999, true)).toBe(false);
        expect(shouldSkipActivityGeneration(150_000, true)).toBe(true);
        expect(shouldSkipActivityGeneration(300_000, false)).toBe(false);
    });
});
