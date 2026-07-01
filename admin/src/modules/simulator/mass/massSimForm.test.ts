import { describe, expect, it } from 'vitest';
import { validateMassForm, validateMassPopulation } from './massSimForm';

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
});
