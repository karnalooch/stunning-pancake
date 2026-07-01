import { describe, expect, it } from 'vitest';
import { getWizardNextIndex } from './useWizard';

describe('useWizard transitions', () => {
    const steps = [
        { id: 'a', fields: ['name'] },
        { id: 'b' },
        { id: 'c', canLeave: (v: { ok: boolean }) => v.ok },
    ];

    it('advances when validation passes', () => {
        expect(
            getWizardNextIndex({
                steps,
                current: 0,
                values: { ok: true },
                validateFields: () => true,
            }),
        ).toBe(1);
    });

    it('blocks next when canLeave is false', () => {
        expect(
            getWizardNextIndex({
                steps,
                current: 2,
                values: { ok: false },
            }),
        ).toBeNull();
    });

    it('blocks next when validation fails', () => {
        expect(
            getWizardNextIndex({
                steps,
                current: 0,
                values: { ok: true },
                validateFields: () => false,
            }),
        ).toBeNull();
    });
});
