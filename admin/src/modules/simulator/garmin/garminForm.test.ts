import { describe, expect, it } from 'vitest';
import {
    validateGarminCredentials,
    validateGarminSchedule,
    type GarminFormValues,
} from './garminForm';
import { DEFAULT_GARMIN_SCHEDULE } from '../api/types';

function baseValues(overrides: Partial<GarminFormValues> = {}): GarminFormValues {
    return {
        userCount: 2,
        credentials: [
            { email: 'a@test.com', password: 'secret' },
            { email: 'b@test.com', password: 'secret' },
        ],
        names: [
            { first: 'A', last: 'B', display: 'A B' },
            { first: 'C', last: 'D', display: 'C D' },
        ],
        schedule: { ...DEFAULT_GARMIN_SCHEDULE },
        ...overrides,
    };
}

describe('garminForm validation', () => {
    it('requires email and password per row', () => {
        const errors = validateGarminCredentials(
            baseValues({ credentials: [{ email: '', password: '' }, { email: 'x@y.com', password: '' }] }),
        );
        expect(errors['credentials.0.email']).toBeTruthy();
        expect(errors['credentials.0.password']).toBeTruthy();
        expect(errors['credentials.1.password']).toBeTruthy();
    });

    it('rejects speed_min >= speed_max', () => {
        const errors = validateGarminSchedule(
            baseValues({ schedule: { ...DEFAULT_GARMIN_SCHEDULE, speed_min: 35, speed_max: 30 } }),
        );
        expect(errors['schedule.speed_max']).toBeTruthy();
    });
});
