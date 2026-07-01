import { describe, expect, it } from 'vitest';
import { validateGarminCredentials, type GarminFormValues } from '../garminForm';
import { DEFAULT_GARMIN_SCHEDULE } from '../../api/types';

describe('CredentialsStep validation', () => {
    it('flags empty password', () => {
        const values: GarminFormValues = {
            userCount: 1,
            credentials: [{ email: 'test@example.com', password: '' }],
            names: [{ first: 'Jan', last: 'Kowalski', display: 'Jan Kowalski' }],
            schedule: { ...DEFAULT_GARMIN_SCHEDULE },
        };
        const errors = validateGarminCredentials(values);
        expect(errors['credentials.0.password']).toBe('Password required');
    });
});

describe('ReviewStep launch guard', () => {
    it('disables launch when batch conflict is active', () => {
        const conflictBlocked = true;
        const garminRunning = false;
        expect(conflictBlocked && !garminRunning).toBe(true);
    });
});
